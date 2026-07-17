begin;

-- Pontua reservas de trilhas pagas antes da implantação do extrato de pontos.
--
-- Regra:
--   1 ponto para cada R$ 1,00 pago, sem arredondar para cima.
--   Quando uma reserva histórica não possui valor_pago, usa o preço da agenda.
--
-- Segurança:
--   - somente reservas com status_pagamento = 'pago';
--   - não altera nem substitui o saldo de pontos já existente;
--   - cria uma transação rastreável por reserva;
--   - pode ser executado novamente sem duplicar pontos;
--   - ignora reservas que já receberam pontos pelo fluxo atual do Asaas.

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
        and current_award.description = 'Compra de trilha'
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
  select
    client_id,
    sum(points)::integer as points
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
backfill_summary as (
  select
    count(*)::integer as transactions_created,
    coalesce(sum(points), 0)::integer as points_awarded,
    count(distinct client_id)::integer as clients_credited
  from inserted_transactions
)
insert into public.audit_logs (
  action,
  resource_type,
  metadata
)
select
  'legacy_trail_points_backfill',
  'points_transactions',
  jsonb_build_object(
    'transactions_created', summary.transactions_created,
    'points_awarded', summary.points_awarded,
    'clients_credited', summary.clients_credited,
    'clients_updated', (select count(*) from updated_clients),
    'rule', '1 point per paid BRL, rounded down',
    'fallback', 'agenda price when reservation paid value is zero'
  )
from backfill_summary summary
where summary.transactions_created > 0;

commit;

-- Conferência após a execução:
--
-- select
--   count(*) as transacoes_criadas,
--   count(distinct client_id) as clientes_pontuados,
--   sum(points) as pontos_distribuidos
-- from public.points_transactions
-- where description = 'Compra de trilha (retroativo)';
