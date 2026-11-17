-- =====================================================================
-- O Pimentão — instalação do banco (Supabase)
-- Cole tudo no SQL Editor do Supabase e clique em RUN. Pode rodar de novo
-- sem perder dados.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- Todos os registros do sistema (produtos, vendas, entradas...) ficam aqui.
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  primary key (col, id)
);

-- Usuários do sistema (login por nome + senha)
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  login text not null unique,
  nome text not null,
  papel text not null check (papel in ('gestor', 'operador')),
  telefone text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.docs enable row level security;
alter table public.usuarios enable row level security;

create or replace function public.sou_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and ativo);
$$;
create or replace function public.sou_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and ativo and papel = 'gestor');
$$;

drop policy if exists docs_ler on public.docs;
drop policy if exists docs_criar on public.docs;
drop policy if exists docs_alterar on public.docs;
create policy docs_ler on public.docs for select to authenticated using (public.sou_ativo());
create policy docs_criar on public.docs for insert to authenticated with check (public.sou_ativo());
create policy docs_alterar on public.docs for update to authenticated using (public.sou_ativo()) with check (public.sou_ativo());
-- (sem política de apagar: nada é apagado, tudo é cancelado por estorno)

drop policy if exists usuarios_ler on public.usuarios;
create policy usuarios_ler on public.usuarios for select to authenticated using (public.sou_ativo() or id = auth.uid());

-- junta campos num registro sem apagar os outros (usado para cancelar, resolver etc.)
create or replace function public.doc_juntar(p_col text, p_id text, p_dados jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.docs set data = data || p_dados, atualizado = now() where col = p_col and id = p_id;
  if not found then raise exception 'Registro não encontrado'; end if;
end $$;

-- e-mail interno a partir do login (o usuário nunca vê)
create or replace function public._email_de(p_login text) returns text
language sql immutable as $$ select lower(p_login) || '@usuarios.opimentao.app' $$;

create or replace function public._criar_auth(p_login text, p_senha text) returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
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
end $$;

-- Primeiro acesso: só funciona enquanto não existe nenhum usuário. Cria o gestor.
create or replace function public.primeiro_acesso(p_login text, p_nome text, p_senha text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid;
begin
  if exists (select 1 from public.usuarios) then raise exception 'O primeiro acesso já foi feito. Entre com seu usuário.'; end if;
  uid := public._criar_auth(lower(trim(p_login)), p_senha);
  insert into public.usuarios (id, login, nome, papel) values (uid, lower(trim(p_login)), trim(p_nome), 'gestor');
end $$;

create or replace function public.precisa_primeiro_acesso() returns boolean
language sql stable security definer set search_path = public as $$ select not exists (select 1 from public.usuarios) $$;

-- Gestor cadastra usuário
create or replace function public.criar_usuario(p_login text, p_nome text, p_senha text, p_papel text, p_telefone text default '') returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid;
begin
  if not public.sou_gestor() then raise exception 'Só o gestor cadastra usuários.'; end if;
  if p_papel not in ('gestor', 'operador') then raise exception 'Papel inválido.'; end if;
  if length(trim(p_nome)) < 2 then raise exception 'Informe o nome.'; end if;
  uid := public._criar_auth(lower(trim(p_login)), p_senha);
  insert into public.usuarios (id, login, nome, papel, telefone) values (uid, lower(trim(p_login)), trim(p_nome), p_papel, coalesce(trim(p_telefone), ''));
  return uid;
end $$;

-- Gestor troca a senha de qualquer um; cada um pode trocar a própria
create or replace function public.trocar_senha(p_id uuid, p_senha text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not (public.sou_gestor() or (p_id = auth.uid() and public.sou_ativo())) then raise exception 'Só o gestor troca a senha de outra pessoa.'; end if;
  if length(p_senha) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;

-- Gestor altera nome, papel, telefone, ativo
create or replace function public.alterar_usuario(p_id uuid, p_nome text, p_papel text, p_telefone text, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_gestor() then raise exception 'Só o gestor altera usuários.'; end if;
  if p_papel not in ('gestor', 'operador') then raise exception 'Papel inválido.'; end if;
  if (p_papel <> 'gestor' or not p_ativo)
     and not exists (select 1 from public.usuarios where ativo and papel = 'gestor' and id <> p_id) then
    raise exception 'Precisa ficar pelo menos um gestor ativo.';
  end if;
  update public.usuarios set nome = trim(p_nome), papel = p_papel, telefone = coalesce(trim(p_telefone), ''), ativo = p_ativo where id = p_id;
end $$;

revoke all on function public._criar_auth(text, text) from public, anon, authenticated;
grant execute on function public.primeiro_acesso(text, text, text) to anon, authenticated;
grant execute on function public.precisa_primeiro_acesso() to anon, authenticated;
grant execute on function public.criar_usuario(text, text, text, text, text) to authenticated;
grant execute on function public.trocar_senha(uuid, text) to authenticated;
grant execute on function public.alterar_usuario(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.doc_juntar(text, text, jsonb) to authenticated;
grant select, insert, update on public.docs to authenticated;
grant select on public.usuarios to authenticated;

-- atualização em tempo real entre os computadores/celulares
do $$ begin
  begin alter publication supabase_realtime add table public.docs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.usuarios; exception when others then null; end;
end $$;

-- data/hora de alteração sempre do servidor
create or replace function public._tocar() returns trigger language plpgsql as $$
begin new.atualizado := now(); return new; end $$;
drop trigger if exists docs_tocar on public.docs;
create trigger docs_tocar before insert or update on public.docs for each row execute function public._tocar();
