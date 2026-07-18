begin;

-- Reconcilia reservas históricas que foram confirmadas depois da primeira
-- execução do backfill. O corte preserva a regra atual: somente compras feitas
-- pelo app geram novos pontos a partir da implantação do programa.

set local lock_timeout = '10s';
set local statement_timeout = '60s';

lock table public.points_transactions in share row exclusive mode;
lock table public.clients in share row exclusive mode;

with eligible_reservations as (
  select
    r.id as reservation_id,
    r.client_id,
    floor(
      case
        when coalesce(r.valor_pago, 0) > 0 then r.valor_pago
        else coalesce(a.price, 0)
      end
    )::integer as points
  from public.reservas r
  inner join public.agendas a on a.id = r.agenda_id
  where r.status_pagamento = 'pago'
    and r.created_at < timestamptz '2026-07-17 00:00:00-03'
    and floor(
      case
        when coalesce(r.valor_pago, 0) > 0 then r.valor_pago
        else coalesce(a.price, 0)
      end
    )::integer > 0
    and not exists (
      select 1
      from public.points_transactions existing_backfill
      where existing_backfill.provider_payment_id = 'LEGACY_TRAIL:' || r.id::text
        and existing_backfill.description = 'Compra de trilha (retroativo)'
    )
    and not exists (
      select 1
      from public.points_transactions current_award
      where r.nsu_transacao is not null
        and current_award.client_id = r.client_id
        and current_award.provider_payment_id = r.nsu_transacao
        and current_award.description in ('Compra de trilha', 'Compra de trilha pelo app')
        and current_award.points > 0
    )
),
inserted_transactions as (
  insert into public.points_transactions (
    client_id,
    points,
    description,
    provider_payment_id
  )
  select
    eligible.client_id,
    eligible.points,
    'Compra de trilha (retroativo)',
    'LEGACY_TRAIL:' || eligible.reservation_id::text
  from eligible_reservations eligible
  on conflict (provider_payment_id, description) do nothing
  returning client_id, points
),
points_by_client as (
  select client_id, sum(points)::integer as points
  from inserted_transactions
  group by client_id
),
updated_clients as (
  update public.clients client
  set pontos = coalesce(client.pontos, 0) + totals.points
  from points_by_client totals
  where client.id = totals.client_id
  returning client.id
),
summary as (
  select
    count(*)::integer as transactions_created,
    coalesce(sum(points), 0)::integer as points_awarded,
    count(distinct client_id)::integer as clients_credited
  from inserted_transactions
)
insert into public.audit_logs (action, resource_type, metadata)
select
  'legacy_trail_points_reconciliation',
  'points_transactions',
  jsonb_build_object(
    'transactions_created', summary.transactions_created,
    'points_awarded', summary.points_awarded,
    'clients_credited', summary.clients_credited,
    'clients_updated', (select count(*) from updated_clients),
    'legacy_cutoff', '2026-07-17T00:00:00-03:00'
  )
from summary
where summary.transactions_created > 0;

commit;
