begin;

-- Balanceamento financeiro do programa de fidelidade.
--
-- Princípios:
--   1. Pontos existentes não mudam de valor: 200 pontos = R$ 1,00.
--   2. A emissão futura varia conforme cobertura, margem e custos confirmados.
--   3. O resgate nunca ultrapassa a margem estimada da compra.
--   4. Trilhas sem custos confirmados não aceitam desconto por pontos.
--   5. Toda decisão automática de emissão fica registrada e é idempotente.

create table if not exists public.loyalty_program_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  points_per_brl_discount integer not null default 200
    check (points_per_brl_discount between 100 and 10000),
  base_points_per_brl_earned numeric(8,4) not null default 1
    check (base_points_per_brl_earned between 0 and 10),
  minimum_margin_percent numeric(7,4) not null default 0.20
    check (minimum_margin_percent between 0 and 0.80),
  provider_fee_percent numeric(7,4) not null default 0.06
    check (provider_fee_percent between 0 and 0.30),
  provider_fixed_fee numeric(12,2) not null default 2
    check (provider_fixed_fee between 0 and 100),
  max_order_discount_percent numeric(7,4) not null default 0.05
    check (max_order_discount_percent between 0 and 0.30),
  reserve_coverage_ratio numeric(7,4) not null default 1.25
    check (reserve_coverage_ratio between 1 and 5),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.loyalty_program_config (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.agendas
  add column if not exists loyalty_costs_confirmed_at timestamptz,
  add column if not exists loyalty_costs_confirmed_by uuid
    references auth.users(id) on delete set null,
  add column if not exists loyalty_variable_cost_per_person numeric(12,2)
    not null default 0 check (loyalty_variable_cost_per_person >= 0),
  add column if not exists loyalty_safety_buffer numeric(12,2)
    not null default 0 check (loyalty_safety_buffer >= 0);

create table if not exists public.loyalty_award_decisions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider_payment_id text not null,
  description text not null,
  paid_amount numeric(12,2) not null check (paid_amount >= 0),
  awarded_points integer not null check (awarded_points >= 0),
  award_rate numeric(8,4) not null check (award_rate >= 0),
  financial_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_payment_id, description)
);

create index if not exists loyalty_award_decisions_client_idx
  on public.loyalty_award_decisions(client_id, created_at desc);

create table if not exists public.loyalty_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('healthy', 'watch', 'blocked')),
  outstanding_points bigint not null,
  points_liability numeric(14,2) not null,
  cashback_liability numeric(14,2) not null,
  estimated_gross_revenue numeric(14,2) not null,
  declared_costs numeric(14,2) not null,
  estimated_provider_fees numeric(14,2) not null,
  protected_margin numeric(14,2) not null,
  available_reward_reserve numeric(14,2) not null,
  required_reward_reserve numeric(14,2) not null,
  coverage_ratio numeric(14,4),
  sold_agendas integer not null,
  cost_confirmed_agendas integer not null,
  cost_completeness_ratio numeric(7,4) not null,
  current_award_rate numeric(8,4) not null,
  triggered_by text,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_balance_snapshots_created_idx
  on public.loyalty_balance_snapshots(created_at desc);

alter table public.loyalty_program_config enable row level security;
alter table public.loyalty_award_decisions enable row level security;
alter table public.loyalty_balance_snapshots enable row level security;

revoke all on public.loyalty_program_config from anon, authenticated;
revoke all on public.loyalty_award_decisions from anon, authenticated;
revoke all on public.loyalty_balance_snapshots from anon, authenticated;

create or replace function public.get_loyalty_financial_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  config public.loyalty_program_config%rowtype;
  outstanding_points bigint := 0;
  points_liability numeric(14,2) := 0;
  cashback_liability numeric(14,2) := 0;
  gross_revenue numeric(14,2) := 0;
  declared_costs numeric(14,2) := 0;
  provider_fees numeric(14,2) := 0;
  protected_margin numeric(14,2) := 0;
  available_reserve numeric(14,2) := 0;
  required_reserve numeric(14,2) := 0;
  coverage_ratio numeric(14,4);
  sold_agendas integer := 0;
  confirmed_agendas integer := 0;
  completeness numeric(7,4) := 0;
  payment_count integer := 0;
  coverage_factor numeric(8,4) := 0;
  award_rate numeric(8,4) := 0;
  health text := 'blocked';
begin
  select * into config
  from public.loyalty_program_config
  where singleton = true;

  select
    coalesce(sum(greatest(client.pontos, 0)), 0)::bigint,
    coalesce(
      sum(
        floor(
          greatest(client.pontos, 0)::numeric
          / greatest(config.points_per_brl_discount, 1)
          * 100
        ) / 100
      ),
      0
    )::numeric(14,2),
    coalesce(sum(greatest(client.cashback_saldo, 0)), 0)::numeric(14,2)
  into outstanding_points, points_liability, cashback_liability
  from public.clients client;

  select
    coalesce(sum(
      case
        when reservation.valor_original > 0 then reservation.valor_original
        when reservation.valor_pago > 0 then reservation.valor_pago
        else agenda.price
      end
    ), 0)::numeric(14,2),
    count(distinct coalesce(
      nullif(reservation.nsu_transacao, ''),
      reservation.id::text
    ))::integer,
    count(distinct reservation.agenda_id)::integer,
    count(distinct reservation.agenda_id)
      filter (where agenda.loyalty_costs_confirmed_at is not null)::integer
  into gross_revenue, payment_count, sold_agendas, confirmed_agendas
  from public.reservas reservation
  join public.agendas agenda on agenda.id = reservation.agenda_id
  where reservation.status_pagamento = 'pago';

  select coalesce(sum(cost.valor_custo), 0)::numeric(14,2)
  into declared_costs
  from public.trilha_custos cost
  where exists (
    select 1
    from public.reservas reservation
    where reservation.agenda_id = cost.agenda_id
      and reservation.status_pagamento = 'pago'
  );

  completeness := case
    when sold_agendas = 0 then 0
    else confirmed_agendas::numeric / sold_agendas
  end;
  provider_fees := round(
    gross_revenue * config.provider_fee_percent
    + payment_count * config.provider_fixed_fee,
    2
  );
  protected_margin := round(gross_revenue * config.minimum_margin_percent, 2);
  available_reserve := greatest(
    round(gross_revenue - declared_costs - provider_fees - protected_margin, 2),
    0
  );
  required_reserve := round(
    (points_liability + cashback_liability) * config.reserve_coverage_ratio,
    2
  );
  coverage_ratio := case
    when points_liability + cashback_liability = 0 then null
    else round(
      available_reserve / (points_liability + cashback_liability),
      4
    )
  end;

  coverage_factor := case
    when available_reserve <= 0 then 0
    when points_liability + cashback_liability = 0 then 1
    when coverage_ratio >= config.reserve_coverage_ratio * 2 then 1
    when coverage_ratio >= config.reserve_coverage_ratio then 0.5
    else 0
  end;

  award_rate := case
    when not config.enabled then 0
    when sold_agendas = 0 then 0
    when completeness < 0.80 then 0
    else round(
      config.base_points_per_brl_earned
      * least(completeness, 1)
      * coverage_factor,
      4
    )
  end;

  health := case
    when not config.enabled or award_rate = 0 then 'blocked'
    when completeness < 1 or (
      coverage_ratio is not null
      and coverage_ratio < config.reserve_coverage_ratio * 2
    ) then 'watch'
    else 'healthy'
  end;

  return jsonb_build_object(
    'status', health,
    'enabled', config.enabled,
    'outstanding_points', outstanding_points,
    'points_liability', points_liability,
    'cashback_liability', cashback_liability,
    'estimated_gross_revenue', gross_revenue,
    'declared_costs', declared_costs,
    'estimated_provider_fees', provider_fees,
    'protected_margin', protected_margin,
    'available_reward_reserve', available_reserve,
    'required_reward_reserve', required_reserve,
    'coverage_ratio', coverage_ratio,
    'sold_agendas', sold_agendas,
    'cost_confirmed_agendas', confirmed_agendas,
    'cost_completeness_ratio', completeness,
    'current_award_rate', award_rate,
    'config', jsonb_build_object(
      'points_per_brl_discount', config.points_per_brl_discount,
      'base_points_per_brl_earned', config.base_points_per_brl_earned,
      'minimum_margin_percent', config.minimum_margin_percent,
      'provider_fee_percent', config.provider_fee_percent,
      'provider_fixed_fee', config.provider_fixed_fee,
      'max_order_discount_percent', config.max_order_discount_percent,
      'reserve_coverage_ratio', config.reserve_coverage_ratio,
      'updated_at', config.updated_at
    ),
    'calculated_at', now()
  );
end;
$$;

create or replace function public.loyalty_points_for_amount(p_paid_amount numeric)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  summary jsonb;
  award_rate numeric(8,4);
begin
  if p_paid_amount is null or p_paid_amount <= 0 then return 0; end if;
  summary := public.get_loyalty_financial_summary();
  award_rate := coalesce((summary->>'current_award_rate')::numeric, 0);
  return greatest(floor(p_paid_amount * award_rate)::integer, 0);
end;
$$;

create or replace function public.quote_app_trail_points(
  p_reservation_ids uuid[],
  p_owner_id uuid,
  p_gross_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  config public.loyalty_program_config%rowtype;
  summary jsonb;
  client_points integer := 0;
  client_discount numeric(12,2) := 0;
  order_discount_cap numeric(12,2) := 0;
  margin_headroom numeric(12,2) := 0;
  global_headroom numeric(14,2) := 0;
  allowed_discount numeric(12,2) := 0;
  allowed_points integer := 0;
  agenda_row record;
  order_people integer;
  paid_people integer;
  projected_people integer;
  agenda_cost numeric(14,2);
  agenda_gross numeric(14,2);
  allocated_cost numeric(14,2);
  all_costs_confirmed boolean := true;
  reason text := 'available';
begin
  if cardinality(p_reservation_ids) is null
     or cardinality(p_reservation_ids) = 0
     or cardinality(p_reservation_ids) > 20
     or p_gross_amount is null
     or p_gross_amount <= 0 then
    raise exception 'Dados inválidos para cotação de pontos';
  end if;

  select * into config
  from public.loyalty_program_config
  where singleton = true;

  select greatest(coalesce(client.pontos, 0), 0)
  into client_points
  from public.clients client
  where client.id = p_owner_id;
  if not found then raise exception 'Cliente não encontrado'; end if;

  for agenda_row in
    select
      agenda.id,
      agenda.price,
      agenda.loyalty_costs_confirmed_at,
      agenda.loyalty_variable_cost_per_person,
      agenda.loyalty_safety_buffer,
      count(reservation.id)::integer as checkout_people
    from public.reservas reservation
    join public.agendas agenda on agenda.id = reservation.agenda_id
    where reservation.id = any(p_reservation_ids)
      and reservation.checkout_owner_id = p_owner_id
      and reservation.status_pagamento = 'pendente'
    group by agenda.id
  loop
    order_people := agenda_row.checkout_people;
    if agenda_row.loyalty_costs_confirmed_at is null then
      all_costs_confirmed := false;
      continue;
    end if;

    select count(*)::integer
    into paid_people
    from public.reservas reservation
    where reservation.agenda_id = agenda_row.id
      and reservation.status_pagamento = 'pago';

    select coalesce(sum(cost.valor_custo), 0)
    into agenda_cost
    from public.trilha_custos cost
    where cost.agenda_id = agenda_row.id;

    projected_people := greatest(paid_people + order_people, 1);
    agenda_gross := round(agenda_row.price * order_people, 2);
    allocated_cost := round(
      (
        agenda_cost + agenda_row.loyalty_safety_buffer
      ) * order_people / projected_people
      + agenda_row.loyalty_variable_cost_per_person * order_people,
      2
    );
    margin_headroom := margin_headroom + greatest(
      agenda_gross
      - allocated_cost
      - agenda_gross * config.minimum_margin_percent,
      0
    );
  end loop;

  if not config.enabled then
    reason := 'program_disabled';
  elsif not all_costs_confirmed then
    reason := 'costs_not_confirmed';
  else
    margin_headroom := greatest(
      round(
        margin_headroom
        - p_gross_amount * config.provider_fee_percent
        - config.provider_fixed_fee,
        2
      ),
      0
    );
    summary := public.get_loyalty_financial_summary();
    global_headroom := greatest(
      coalesce((summary->>'available_reward_reserve')::numeric, 0)
      - coalesce((summary->>'required_reward_reserve')::numeric, 0),
      0
    );
    client_discount := floor(
      client_points::numeric
      / greatest(config.points_per_brl_discount, 1)
      * 100
    ) / 100;
    order_discount_cap := floor(
      p_gross_amount * config.max_order_discount_percent * 100
    ) / 100;
    allowed_discount := greatest(
      least(
        client_discount,
        order_discount_cap,
        margin_headroom,
        global_headroom
      ),
      0
    );
    allowed_points := floor(
      allowed_discount * config.points_per_brl_discount
    )::integer;
    allowed_discount := floor(
      allowed_points::numeric
      / config.points_per_brl_discount
      * 100
    ) / 100;

    if allowed_discount <= 0 then
      reason := case
        when global_headroom <= 0 then 'reserve_not_covered'
        when margin_headroom <= 0 then 'margin_not_available'
        else 'insufficient_points'
      end;
    end if;
  end if;

  return jsonb_build_object(
    'max_points', allowed_points,
    'max_discount', allowed_discount,
    'margin_headroom', margin_headroom,
    'global_headroom', global_headroom,
    'reason', reason,
    'costs_confirmed', all_costs_confirmed,
    'points_per_brl_discount', config.points_per_brl_discount,
    'calculated_at', now()
  );
end;
$$;

create or replace function public.prepare_app_trail_checkout(
  p_reservation_ids uuid[],
  p_owner_id uuid,
  p_gross_amount numeric,
  p_use_cashback boolean,
  p_use_points boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_count integer;
  v_batch_id uuid;
  v_other_batch_id uuid;
  v_client public.clients%rowtype;
  v_cashback numeric(12,2) := 0;
  v_points integer := 0;
  v_points_discount numeric(12,2) := 0;
  v_remaining numeric(12,2);
  v_benefit_id uuid;
  v_quote jsonb;
begin
  if cardinality(p_reservation_ids) = 0 or cardinality(p_reservation_ids) > 20 then
    raise exception 'Reservas inválidas';
  end if;
  if p_gross_amount is null or p_gross_amount < 0 then
    raise exception 'Valor do checkout inválido';
  end if;

  perform 1 from public.reservas where id = any(p_reservation_ids) for update;
  select
    count(*),
    min(checkout_batch_id::text)::uuid,
    max(checkout_batch_id::text)::uuid
  into v_reservation_count, v_batch_id, v_other_batch_id
  from public.reservas
  where id = any(p_reservation_ids)
    and checkout_owner_id = p_owner_id
    and status_pagamento = 'pendente'
    and purchase_channel = 'app'
    and nsu_transacao is null;

  if v_reservation_count <> cardinality(p_reservation_ids)
     or v_batch_id is null
     or v_batch_id <> v_other_batch_id then
    raise exception 'Reservas do aplicativo inválidas ou já processadas';
  end if;

  select * into v_client from public.clients where id = p_owner_id for update;
  if v_client.id is null then raise exception 'Cliente não encontrado'; end if;

  v_remaining := round(p_gross_amount, 2);
  if p_use_cashback then
    v_cashback := least(
      greatest(coalesce(v_client.cashback_saldo, 0), 0),
      v_remaining
    );
    v_remaining := v_remaining - v_cashback;
  end if;

  v_quote := public.quote_app_trail_points(
    p_reservation_ids,
    p_owner_id,
    p_gross_amount
  );
  if p_use_points then
    v_points := least(
      coalesce((v_quote->>'max_points')::integer, 0),
      floor(
        v_remaining
        * (
          select points_per_brl_discount
          from public.loyalty_program_config
          where singleton = true
        )
      )::integer
    );
    v_points_discount := floor(
      v_points::numeric
      / (
        select points_per_brl_discount
        from public.loyalty_program_config
        where singleton = true
      )
      * 100
    ) / 100;
    v_remaining := v_remaining - v_points_discount;
  end if;

  insert into public.trail_checkout_benefits (
    batch_id, owner_id, reservation_ids, gross_amount,
    cashback_used, points_used, points_discount_value, amount_due
  ) values (
    v_batch_id, p_owner_id, p_reservation_ids, round(p_gross_amount, 2),
    round(v_cashback, 2), v_points, v_points_discount,
    greatest(round(v_remaining, 2), 0)
  ) returning id into v_benefit_id;

  update public.clients
  set cashback_saldo = coalesce(cashback_saldo, 0) - v_cashback,
      pontos = coalesce(pontos, 0) - v_points
  where id = p_owner_id;

  if v_cashback > 0 then
    insert into public.wallet_transactions (
      client_id, type, amount, description, provider, provider_payment_id
    ) values (
      p_owner_id, 'debit', v_cashback,
      'Cashback reservado no checkout da trilha',
      'INTERNAL', 'TRAIL_BENEFIT:' || v_benefit_id::text
    );
  end if;
  if v_points > 0 then
    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      p_owner_id, -v_points,
      'Pontos reservados no checkout da trilha',
      'TRAIL_BENEFIT:' || v_benefit_id::text
    );
  end if;

  return jsonb_build_object(
    'benefit_id', v_benefit_id,
    'batch_id', v_batch_id,
    'gross_amount', round(p_gross_amount, 2),
    'cashback_used', round(v_cashback, 2),
    'points_used', v_points,
    'points_discount_value', v_points_discount,
    'amount_due', greatest(round(v_remaining, 2), 0),
    'points_limit_reason', v_quote->>'reason',
    'points_margin_limit', v_quote->'max_discount'
  );
exception
  when unique_violation then
    raise exception 'Este checkout já possui um pagamento em andamento';
end;
$$;

create or replace function public.award_points_from_asaas(
  p_client_id uuid,
  p_payment_id text,
  p_points integer,
  p_description text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  summary jsonb;
  award_rate numeric(8,4);
  awarded_points integer;
  decision_id uuid;
  inserted_id uuid;
begin
  if p_points <= 0 then return false; end if;
  summary := public.get_loyalty_financial_summary();
  award_rate := coalesce((summary->>'current_award_rate')::numeric, 0);
  awarded_points := greatest(floor(p_points * award_rate)::integer, 0);

  insert into public.loyalty_award_decisions (
    client_id,
    provider_payment_id,
    description,
    paid_amount,
    awarded_points,
    award_rate,
    financial_snapshot
  ) values (
    p_client_id,
    p_payment_id,
    p_description,
    p_points,
    awarded_points,
    award_rate,
    summary
  )
  on conflict (provider_payment_id, description) do nothing
  returning id into decision_id;

  if decision_id is null or awarded_points <= 0 then return false; end if;

  insert into public.points_transactions (
    client_id, points, description, provider_payment_id
  ) values (
    p_client_id, awarded_points, p_description, p_payment_id
  )
  on conflict (provider_payment_id, description) do nothing
  returning id into inserted_id;

  if inserted_id is null then return false; end if;
  update public.clients
  set pontos = coalesce(pontos, 0) + awarded_points
  where id = p_client_id;
  return true;
end;
$$;

-- Atualiza a regra das vendas manuais para usar a mesma taxa dinâmica.
create or replace function public.admin_update_reservation_payment(
  p_reservation_id uuid,
  p_status text,
  p_amount numeric,
  p_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.reservas%rowtype;
  reward_key text;
  reward_client_id uuid;
  expected_points integer := 0;
  recorded_points integer := 0;
  points_delta integer := 0;
  reference_amount numeric(12,2) := 0;
  applied_rate numeric(8,4);
begin
  if p_status not in ('pendente', 'pago', 'atrasado', 'cancelado', 'estornado', 'expirado') then
    raise exception 'Status de pagamento inválido';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'Valor pago inválido';
  end if;
  if nullif(trim(p_method), '') is null or length(p_method) > 50 then
    raise exception 'Método de pagamento inválido';
  end if;

  select * into reservation_row
  from public.reservas
  where id = p_reservation_id
  for update;
  if reservation_row.id is null then raise exception 'Reserva não encontrada'; end if;

  update public.reservas
  set status_pagamento = p_status,
      valor_pago = round(p_amount, 2),
      metodo_pagamento = upper(trim(p_method))
  where id = p_reservation_id;

  if reservation_row.purchase_channel = 'admin'
     or nullif(trim(coalesce(reservation_row.nsu_transacao, '')), '') is null then
    reward_key := 'LEGACY_TRAIL:' || p_reservation_id::text;
    reward_client_id := reservation_row.client_id;

    select case
      when p_status <> 'pago' then 0
      when upper(trim(p_method)) = 'CORTESIA' then 0
      when p_amount > 0 then p_amount
      else coalesce(agenda.price, 0)
    end
    into reference_amount
    from public.agendas agenda
    where agenda.id = reservation_row.agenda_id;

  else
    reward_key := reservation_row.nsu_transacao;
    perform 1
    from public.reservas reservation
    where reservation.nsu_transacao = reward_key
    for update;

    select point_entry.client_id
    into reward_client_id
    from public.points_transactions point_entry
    where point_entry.provider_payment_id = reward_key
      and point_entry.points > 0
    order by point_entry.created_at asc
    limit 1;

    reward_client_id := coalesce(
      reward_client_id,
      reservation_row.checkout_owner_id,
      reservation_row.client_id
    );

    select coalesce(sum(reservation.valor_pago), 0)
    into reference_amount
    from public.reservas reservation
    where reservation.nsu_transacao = reward_key
      and reservation.status_pagamento = 'pago';
  end if;

  select coalesce(sum(point_entry.points), 0)::integer
  into recorded_points
  from public.points_transactions point_entry
  where point_entry.client_id = reward_client_id
    and point_entry.provider_payment_id = reward_key;

  select decision.award_rate
  into applied_rate
  from public.loyalty_award_decisions decision
  where decision.provider_payment_id = reward_key
  order by decision.created_at asc
  limit 1;

  expected_points := case
    when reference_amount <= 0 then 0
    when applied_rate is not null then
      greatest(floor(reference_amount * applied_rate)::integer, 0)
    when recorded_points > 0 then
      -- Compras anteriores ao motor de balanceamento preservam a taxa histórica.
      greatest(floor(reference_amount)::integer, 0)
    else public.loyalty_points_for_amount(reference_amount)
  end;

  points_delta := expected_points - recorded_points;
  if points_delta <> 0 then
    update public.clients
    set pontos = greatest(0, coalesce(pontos, 0) + points_delta)
    where id = reward_client_id;

    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      reward_client_id,
      points_delta,
      case
        when points_delta > 0 then 'Compra de trilha confirmada manualmente'
        else 'Estorno de pontos por alteração da reserva'
      end || ' · ajuste ' || substring(gen_random_uuid()::text from 1 for 8),
      reward_key
    );
  end if;

  update public.clients client
  set membro_vip = (
    select count(*) >= 3
    from public.reservas reservation
    where reservation.client_id = client.id
      and reservation.status_pagamento = 'pago'
  )
  where client.id in (reservation_row.client_id, reward_client_id);

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'reward_client_id', reward_client_id,
    'reward_key', reward_key,
    'expected_points', expected_points,
    'previously_recorded_points', recorded_points,
    'points_adjustment', points_delta,
    'dynamic_rate', coalesce(
      applied_rate,
      (public.get_loyalty_financial_summary()->>'current_award_rate')::numeric
    )
  );
end;
$$;

create or replace function public.record_loyalty_balance_snapshot(
  p_triggered_by text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  summary jsonb;
  snapshot_id uuid;
begin
  summary := public.get_loyalty_financial_summary();
  insert into public.loyalty_balance_snapshots (
    status,
    outstanding_points,
    points_liability,
    cashback_liability,
    estimated_gross_revenue,
    declared_costs,
    estimated_provider_fees,
    protected_margin,
    available_reward_reserve,
    required_reward_reserve,
    coverage_ratio,
    sold_agendas,
    cost_confirmed_agendas,
    cost_completeness_ratio,
    current_award_rate,
    triggered_by
  ) values (
    summary->>'status',
    (summary->>'outstanding_points')::bigint,
    (summary->>'points_liability')::numeric,
    (summary->>'cashback_liability')::numeric,
    (summary->>'estimated_gross_revenue')::numeric,
    (summary->>'declared_costs')::numeric,
    (summary->>'estimated_provider_fees')::numeric,
    (summary->>'protected_margin')::numeric,
    (summary->>'available_reward_reserve')::numeric,
    (summary->>'required_reward_reserve')::numeric,
    nullif(summary->>'coverage_ratio', '')::numeric,
    (summary->>'sold_agendas')::integer,
    (summary->>'cost_confirmed_agendas')::integer,
    (summary->>'cost_completeness_ratio')::numeric,
    (summary->>'current_award_rate')::numeric,
    left(coalesce(p_triggered_by, 'system'), 200)
  ) returning id into snapshot_id;
  return snapshot_id;
end;
$$;

revoke all on function public.get_loyalty_financial_summary()
  from public, anon, authenticated;
revoke all on function public.loyalty_points_for_amount(numeric)
  from public, anon, authenticated;
revoke all on function public.quote_app_trail_points(uuid[],uuid,numeric)
  from public, anon, authenticated;
revoke all on function public.prepare_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean)
  from public, anon, authenticated;
revoke all on function public.award_points_from_asaas(uuid,text,integer,text)
  from public, anon, authenticated;
revoke all on function public.admin_update_reservation_payment(uuid,text,numeric,text)
  from public, anon, authenticated;
revoke all on function public.record_loyalty_balance_snapshot(text)
  from public, anon, authenticated;

grant execute on function public.get_loyalty_financial_summary() to service_role;
grant execute on function public.loyalty_points_for_amount(numeric) to service_role;
grant execute on function public.quote_app_trail_points(uuid[],uuid,numeric) to service_role;
grant execute on function public.prepare_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean)
  to service_role;
grant execute on function public.award_points_from_asaas(uuid,text,integer,text)
  to service_role;
grant execute on function public.admin_update_reservation_payment(uuid,text,numeric,text)
  to service_role;
grant execute on function public.record_loyalty_balance_snapshot(text)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'loyalty.balance_engine_installed',
  'loyalty_program_config',
  jsonb_build_object(
    'points_value_preserved', '200 points per BRL',
    'dynamic_future_issuance', true,
    'margin_protected_redemption', true,
    'cost_confirmation_required', true,
    'default_minimum_margin_percent', 0.20,
    'default_max_order_discount_percent', 0.05,
    'default_reserve_coverage_ratio', 1.25
  )
);

commit;
