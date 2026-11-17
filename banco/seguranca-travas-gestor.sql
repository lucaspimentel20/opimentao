-- =====================================================================
-- O Pimentão — travas de gestor no banco (17/11/2026)
-- Antes: as regras "só o gestor" existiam só na tela.
-- Agora: o próprio banco recusa, para quem não é gestor:
--   • config (Pix, link): qualquer alteração
--   • produtos: criar, mudar nome/ativo/preços/margem/mínimo (a Entrada pode
--     atualizar só o peso da caixa)
--   • vendas: desconto acima de 5%, cancelar, reabrir, mexer em venda
--     cancelada ou alterar itens/valores (só o endereço de entrega muda)
--   • compras (entradas): cancelar ou corrigir uma entrada já lançada
--   • clientes: limite de fiado
--   • recebimentos: estorno
--   • conferências: resolver divergência
--   • caixaria e estoque: ajuste de caixaria e correção pelo recebimento
--   • sessões (caixa): alterar um caixa já fechado
-- Gestor e o painel do Supabase (sem usuário logado) não são afetados.
-- =====================================================================
create or replace function public._docs_regras()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n jsonb := new.data;
  o jsonb := case when tg_op = 'UPDATE' then old.data else null end;
  campo text;
begin
  -- painel do Supabase / service role / gestor: livre
  if auth.uid() is null or public.sou_gestor() then
    return new;
  end if;

  if new.col = 'config' then
    raise exception 'Só o gestor altera as configurações.';
  end if;

  if new.col = 'produtos' then
    if o is null then raise exception 'Só o gestor cadastra produtos.'; end if;
    foreach campo in array array['nome','ativo','precoCx','precoKg','margem','minimoG'] loop
      if (n -> campo) is distinct from (o -> campo) then
        raise exception 'Só o gestor altera nome, preço ou margem do produto.';
      end if;
    end loop;
  end if;

  if new.col = 'vendas' then
    if o is null then
      if n ->> 'status' = 'cancelada' then raise exception 'Só o gestor cancela vendas.'; end if;
      if coalesce((n ->> 'desconto')::numeric, 0) > coalesce((n ->> 'subtotal')::numeric, 0) * 0.05 then
        raise exception 'Desconto acima de 5%%: só o gestor pode dar.';
      end if;
    else
      if (n - 'entrega') is distinct from (o - 'entrega') then
        if n ->> 'status' = 'cancelada' and coalesce(o ->> 'status', '') <> 'cancelada' then
          raise exception 'Só o gestor cancela ou reabre vendas.';
        end if;
        raise exception 'Só o gestor altera uma venda já feita.';
      end if;
    end if;
  end if;

  if new.col = 'compras' and o is not null and n is distinct from o then
    raise exception 'Só o gestor corrige ou cancela uma entrada.';
  end if;

  if new.col = 'clientes' then
    if (o is null and coalesce((n ->> 'limite')::numeric, 0) <> 0)
       or (o is not null and (n -> 'limite') is distinct from (o -> 'limite')) then
      raise exception 'Só o gestor altera o limite de fiado.';
    end if;
  end if;

  if new.col = 'recebimentos' and o is not null and (n -> 'estorno') is distinct from (o -> 'estorno') then
    raise exception 'Só o gestor estorna recebimentos.';
  end if;

  if new.col = 'conferencias' and o is not null and (n -> 'resolucao') is distinct from (o -> 'resolucao') then
    raise exception 'Só o gestor resolve divergências.';
  end if;

  if new.col = 'movCaixaria' and n ->> 'tipo' = 'ajuste' then
    raise exception 'Só o gestor faz ajuste de caixaria.';
  end if;

  if new.col = 'movEstoque' and n ->> 'tipo' = 'ajuste' and coalesce(n ->> 'compraId', '') <> '' then
    raise exception 'Só o gestor corrige estoque pelo recebimento.';
  end if;

  if new.col = 'sessoes' and o is not null and (o -> 'fechamento') is not null
     and jsonb_typeof(o -> 'fechamento') <> 'null' and n is distinct from o then
    raise exception 'Este caixa já foi fechado. Só o gestor altera.';
  end if;

  return new;
end $$;

drop trigger if exists docs_regras on public.docs;
create trigger docs_regras before insert or update on public.docs
  for each row execute function public._docs_regras();

-- limpeza: função usada uma vez só na migração da versão antiga
drop trigger if exists usuarios_migrar on public.usuarios;
drop function if exists public._migrar_lucas();
