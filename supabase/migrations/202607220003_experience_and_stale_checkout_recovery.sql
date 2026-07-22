begin;

-- Experiencia e permanente: usar pontos em descontos nao reduz o nivel.
alter table public.clients
  add column if not exists experiencia integer not null default 0
  check (experiencia >= 0);

create table if not exists public.experience_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  experience integer not null,
  description text not null,
  points_transaction_id uuid unique references public.points_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists experience_transactions_client_idx
  on public.experience_transactions(client_id, created_at desc);

alter table public.experience_transactions enable row level security;
revoke all on public.experience_transactions from anon, authenticated;

drop policy if exists "experience own read" on public.experience_transactions;
create policy "experience own read"
  on public.experience_transactions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.clients client
      where client.id = client_id and client.auth_user_id = auth.uid()
    )
  );

create or replace function public.sync_experience_from_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts_as_experience boolean;
begin
  v_counts_as_experience :=
    new.description like 'Compra de trilha%'
    or new.description = 'Compra na loja'
    or new.description = 'Estorno de pontos da trilha'
    or new.description = 'Estorno de pontos da trilha comprada pelo app'
    or new.description = 'Estorno de pontos da compra na loja'
    or new.description like 'Estorno de pontos por altera% da reserva%'
    or (new.description = 'Saldo inicial reconciliado' and new.points > 0);

  if not v_counts_as_experience or new.points = 0 then return new; end if;

  insert into public.experience_transactions (
    client_id, experience, description, points_transaction_id
  ) values (
    new.client_id, new.points, new.description, new.id
  ) on conflict (points_transaction_id) do nothing;

  if found then
    update public.clients
    set experiencia = greatest(0, coalesce(experiencia, 0) + new.points)
    where id = new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists points_transactions_experience on public.points_transactions;
create trigger points_transactions_experience
after insert on public.points_transactions
for each row execute function public.sync_experience_from_points();

-- ReconstrÃ³i XP das compras e estornos jÃ¡ registrados, sem contar gasto de
-- pontos, reserva de checkout ou devoluÃ§Ã£o de saldo como nova experiÃªncia.
insert into public.experience_transactions (
  client_id, experience, description, points_transaction_id, created_at
)
select
  point_entry.client_id,
  point_entry.points,
  point_entry.description,
  point_entry.id,
  point_entry.created_at
from public.points_transactions point_entry
where point_entry.points <> 0
  and (
    point_entry.description like 'Compra de trilha%'
    or point_entry.description = 'Compra na loja'
    or point_entry.description = 'Estorno de pontos da trilha'
    or point_entry.description = 'Estorno de pontos da trilha comprada pelo app'
    or point_entry.description = 'Estorno de pontos da compra na loja'
    or point_entry.description like 'Estorno de pontos por altera% da reserva%'
  )
on conflict (points_transaction_id) do nothing;

update public.clients client
set experiencia = greatest(0, coalesce(summary.experience, 0))
from (
  select client_id, sum(experience)::integer as experience
  from public.experience_transactions
  group by client_id
) summary
where client.id = summary.client_id;

-- Alguns saldos existiam antes da criaÃ§Ã£o do extrato. Registra a diferenÃ§a
-- como saldo inicial para que saldo e extrato voltem a fechar.
with ledger as (
  select
    client.id as client_id,
    coalesce(client.pontos, 0)::integer as balance,
    coalesce(sum(point_entry.points), 0)::integer as ledger_balance
  from public.clients client
  left join public.points_transactions point_entry on point_entry.client_id = client.id
  group by client.id
), differences as (
  select client_id, balance - ledger_balance as difference
  from ledger
  where balance <> ledger_balance
)
insert into public.points_transactions (
  client_id, points, description, provider_payment_id
)
select
  client_id,
  difference,
  'Saldo inicial reconciliado',
  'POINTS_OPENING:' || client_id::text
from differences
on conflict (provider_payment_id, description) do nothing;

-- Libera somente checkouts InfinitePay abandonados hÃ¡ mais de 24 horas e
-- sem transaction_nsu. Um checkout que chegou a iniciar uma transaÃ§Ã£o nÃ£o
-- Ã© tocado automaticamente.
create or replace function public.release_stale_app_checkouts(
  p_owner_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale record;
  released_count integer := 0;
  was_released boolean;
begin
  for stale in
    select
      benefit.id as benefit_id,
      benefit.reservation_ids,
      checkout.id as checkout_id,
      checkout.order_nsu
    from public.trail_checkout_benefits benefit
    join public.infinitepay_checkouts checkout
      on benefit.payment_id = 'IP:' || checkout.order_nsu
    where benefit.status = 'held'
      and (p_owner_id is null or benefit.owner_id = p_owner_id)
      and checkout.status in ('creating', 'pending')
      and checkout.transaction_nsu is null
      and checkout.updated_at < now() - interval '24 hours'
    for update of benefit, checkout
  loop
    select public.release_app_trail_checkout(stale.benefit_id) into was_released;
    if was_released then
      update public.infinitepay_checkouts
      set status = 'expired', updated_at = now()
      where id = stale.checkout_id and status in ('creating', 'pending');

      update public.reservas
      set nsu_transacao = null
      where id = any(stale.reservation_ids)
        and status_pagamento = 'pendente'
        and nsu_transacao = 'IP:' || stale.order_nsu;

      released_count := released_count + 1;
    end if;
  end loop;
  return released_count;
end;
$$;

revoke all on function public.release_stale_app_checkouts(uuid)
  from public, anon, authenticated;
grant execute on function public.release_stale_app_checkouts(uuid) to service_role;

-- Corrige imediatamente reservas abandonadas que jÃ¡ atendem aos critÃ©rios.
select public.release_stale_app_checkouts(null);

insert into public.audit_logs (action, resource_type, metadata)
values (
  'gamification.experience_enabled',
  'clients',
  jsonb_build_object(
    'experience_is_permanent', true,
    'points_remain_spendable', true,
    'stale_checkout_release_hours', 24
  )
);

commit;
