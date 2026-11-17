-- O Pimentão — funções, regras de acesso (RLS) e gatilhos como estão HOJE no Supabase
-- Projeto Supabase: "opimentao" (id manwesybtfxcnjdzwskf, região São Paulo)
-- Extraído direto do banco em 16/11/2026. As tabelas e permissões estão em instalar.sql.

-- ===== Funções auxiliares (internas) =====
CREATE OR REPLACE FUNCTION public._criar_auth(p_login text, p_senha text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare uid uuid := gen_random_uuid(); em text := public._email_de(p_login);
begin
  if p_login !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Usuário inválido: use só letras, números e ponto (sem espaço nem acento).'; end if;
  if length(p_senha) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  if exists (select 1 from public.usuarios where login = lower(p_login)) or exists (select 1 from auth.users where email = em) then
    raise exception 'Já existe um usuário com esse nome de login.';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_senha, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  return uid;
end $function$;

CREATE OR REPLACE FUNCTION public._email_de(p_login text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select lower(p_login) || '@usuarios.opimentao.app' $function$;

-- Usada uma vez só: trocou o código do usuário da versão antiga pelo gestor novo no primeiro acesso.
CREATE OR REPLACE FUNCTION public._migrar_lucas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.papel = 'gestor' and (select count(*) from public.usuarios) = 1 then
    update public.docs set data = replace(data::text, 'u_7wDYTiUWUHJv1ux7yIqCEA', new.id::text)::jsonb
      where data::text like '%u_7wDYTiUWUHJv1ux7yIqCEA%';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public._tocar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.atualizado := now(); return new; end $function$;

-- ===== Quem é quem =====
CREATE OR REPLACE FUNCTION public.sou_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.usuarios where id = auth.uid() and ativo);
$function$;

CREATE OR REPLACE FUNCTION public.sou_gestor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.usuarios where id = auth.uid() and ativo and papel = 'gestor');
$function$;

-- ===== Funções chamadas pelo sistema (rpc) =====
CREATE OR REPLACE FUNCTION public.precisa_primeiro_acesso()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select not exists (select 1 from public.usuarios) $function$;

CREATE OR REPLACE FUNCTION public.primeiro_acesso(p_login text, p_nome text, p_senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare uid uuid;
begin
  if exists (select 1 from public.usuarios) then raise exception 'O primeiro acesso já foi feito. Entre com seu usuário.'; end if;
  uid := public._criar_auth(lower(trim(p_login)), p_senha);
  insert into public.usuarios (id, login, nome, papel) values (uid, lower(trim(p_login)), trim(p_nome), 'gestor');
end $function$;

CREATE OR REPLACE FUNCTION public.criar_usuario(p_login text, p_nome text, p_senha text, p_papel text, p_telefone text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare uid uuid;
begin
  if not public.sou_gestor() then raise exception 'Só o gestor cadastra usuários.'; end if;
  if p_papel not in ('gestor', 'operador') then raise exception 'Papel inválido.'; end if;
  if length(trim(p_nome)) < 2 then raise exception 'Informe o nome.'; end if;
  uid := public._criar_auth(lower(trim(p_login)), p_senha);
  insert into public.usuarios (id, login, nome, papel, telefone) values (uid, lower(trim(p_login)), trim(p_nome), p_papel, coalesce(trim(p_telefone), ''));
  return uid;
end $function$;

CREATE OR REPLACE FUNCTION public.alterar_usuario(p_id uuid, p_nome text, p_papel text, p_telefone text, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.sou_gestor() then raise exception 'Só o gestor altera usuários.'; end if;
  if p_papel not in ('gestor', 'operador') then raise exception 'Papel inválido.'; end if;
  if (p_papel <> 'gestor' or not p_ativo)
     and not exists (select 1 from public.usuarios where ativo and papel = 'gestor' and id <> p_id) then
    raise exception 'Precisa ficar pelo menos um gestor ativo.';
  end if;
  update public.usuarios set nome = trim(p_nome), papel = p_papel, telefone = coalesce(trim(p_telefone), ''), ativo = p_ativo where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.trocar_senha(p_id uuid, p_senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  if not (public.sou_gestor() or (p_id = auth.uid() and public.sou_ativo())) then raise exception 'Só o gestor troca a senha de outra pessoa.'; end if;
  if length(p_senha) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $function$;

-- junta campos novos num registro sem apagar os outros (usado em cancelar, fechar caixa, corrigir entrada…)
CREATE OR REPLACE FUNCTION public.doc_juntar(p_col text, p_id text, p_dados jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.docs set data = data || p_dados, atualizado = now() where col = p_col and id = p_id;
  if not found then raise exception 'Registro não encontrado'; end if;
end $function$;

-- ===== Regras de acesso (RLS) =====
-- Ninguém apaga nada (não existe política de DELETE).
CREATE POLICY docs_ler     ON public.docs     FOR SELECT TO authenticated USING (sou_ativo());
CREATE POLICY docs_criar   ON public.docs     FOR INSERT TO authenticated WITH CHECK (sou_ativo());
CREATE POLICY docs_alterar ON public.docs     FOR UPDATE TO authenticated USING (sou_ativo()) WITH CHECK (sou_ativo());
CREATE POLICY usuarios_ler ON public.usuarios FOR SELECT TO authenticated USING ((sou_ativo() OR (id = auth.uid())));

-- ===== Gatilhos =====
CREATE TRIGGER docs_tocar       BEFORE INSERT OR UPDATE ON public.docs     FOR EACH ROW EXECUTE FUNCTION _tocar();
CREATE TRIGGER usuarios_migrar  AFTER INSERT            ON public.usuarios FOR EACH ROW EXECUTE FUNCTION _migrar_lucas();
