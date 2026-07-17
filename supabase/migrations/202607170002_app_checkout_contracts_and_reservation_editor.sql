begin;

-- Checkout de trilhas iniciado dentro do aplicativo.
alter table public.reservas
  add column if not exists purchase_channel text not null default 'site',
  add column if not exists valor_original numeric(12,2) not null default 0,
  add column if not exists cashback_usado numeric(12,2) not null default 0,
  add column if not exists pontos_usados integer not null default 0;

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'reservas'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status_pagamento%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.reservas drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.reservas
  drop constraint if exists reservas_purchase_channel_check,
  add constraint reservas_purchase_channel_check
    check (purchase_channel in ('site', 'app', 'admin')),
  drop constraint if exists reservas_status_pagamento_check,
  add constraint reservas_status_pagamento_check
    check (status_pagamento in ('pendente', 'pago', 'cancelado', 'estornado', 'expirado', 'atrasado')),
  drop constraint if exists reservas_valor_original_check,
  add constraint reservas_valor_original_check check (valor_original >= 0),
  drop constraint if exists reservas_cashback_usado_check,
  add constraint reservas_cashback_usado_check check (cashback_usado >= 0),
  drop constraint if exists reservas_pontos_usados_check,
  add constraint reservas_pontos_usados_check check (pontos_usados >= 0);

create table if not exists public.trail_checkout_benefits (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  owner_id uuid not null references public.clients(id) on delete cascade,
  reservation_ids uuid[] not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  cashback_used numeric(12,2) not null default 0 check (cashback_used >= 0),
  points_used integer not null default 0 check (points_used >= 0),
  amount_due numeric(12,2) not null check (amount_due >= 0),
  status text not null default 'held' check (status in ('held', 'paid', 'released', 'canceled')),
  payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trail_checkout_one_active_batch_idx
  on public.trail_checkout_benefits(batch_id)
  where status in ('held', 'paid');
create index if not exists trail_checkout_owner_idx
  on public.trail_checkout_benefits(owner_id, created_at desc);

create table if not exists public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_type text not null check (contract_type in ('responsibility', 'insurance')),
  version text not null,
  title text not null,
  signature_url text not null,
  document_snapshot jsonb not null,
  document_hash text not null,
  signed_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (client_id, contract_type, version)
);

create index if not exists client_contracts_latest_idx
  on public.client_contracts(client_id, contract_type, signed_at desc);

alter table public.trail_checkout_benefits enable row level security;
alter table public.client_contracts enable row level security;

revoke all on public.trail_checkout_benefits from anon, authenticated;
revoke insert, update, delete on public.client_contracts from anon, authenticated;

drop policy if exists "contracts own read" on public.client_contracts;
create policy "contracts own read"
  on public.client_contracts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients client
      where client.id = client_id
        and client.auth_user_id = auth.uid()
    )
  );

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
  v_count integer;
  v_batch_id uuid;
  v_other_batch_id uuid;
  v_client public.clients%rowtype;
  v_cashback numeric(12,2) := 0;
  v_points integer := 0;
  v_remaining numeric(12,2);
  v_benefit_id uuid;
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
  into v_count, v_batch_id, v_other_batch_id
  from public.reservas
  where id = any(p_reservation_ids)
    and checkout_owner_id = p_owner_id
    and status_pagamento = 'pendente'
    and purchase_channel = 'app'
    and nsu_transacao is null;

  if v_count <> cardinality(p_reservation_ids) or v_batch_id is null or v_batch_id <> v_other_batch_id then
    raise exception 'Reservas do aplicativo inválidas ou já processadas';
  end if;

  select * into v_client from public.clients where id = p_owner_id for update;
  if v_client.id is null then raise exception 'Cliente não encontrado'; end if;

  v_remaining := round(p_gross_amount, 2);
  if p_use_cashback then
    v_cashback := least(greatest(coalesce(v_client.cashback_saldo, 0), 0), v_remaining);
    v_remaining := v_remaining - v_cashback;
  end if;
  if p_use_points then
    v_points := least(
      greatest(coalesce(v_client.pontos, 0), 0),
      floor(v_remaining * 100)::integer
    );
    v_remaining := v_remaining - (v_points::numeric / 100);
  end if;

  insert into public.trail_checkout_benefits (
    batch_id, owner_id, reservation_ids, gross_amount,
    cashback_used, points_used, amount_due
  ) values (
    v_batch_id, p_owner_id, p_reservation_ids, round(p_gross_amount, 2),
    round(v_cashback, 2), v_points, greatest(round(v_remaining, 2), 0)
  )
  returning id into v_benefit_id;

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
    'amount_due', greatest(round(v_remaining, 2), 0)
  );
exception
  when unique_violation then
    raise exception 'Este checkout já possui um pagamento em andamento';
end;
$$;

create or replace function public.attach_app_trail_payment(
  p_benefit_id uuid,
  p_payment_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trail_checkout_benefits
  set payment_id = p_payment_id, updated_at = now()
  where id = p_benefit_id and status = 'held';
  if not found then raise exception 'Benefício do checkout não encontrado'; end if;
end;
$$;

create or replace function public.release_app_trail_checkout(
  p_benefit_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_benefit public.trail_checkout_benefits%rowtype;
begin
  select * into v_benefit
  from public.trail_checkout_benefits
  where id = p_benefit_id
  for update;

  if v_benefit.id is null or v_benefit.status <> 'held' then return false; end if;

  update public.clients
  set cashback_saldo = coalesce(cashback_saldo, 0) + v_benefit.cashback_used,
      pontos = coalesce(pontos, 0) + v_benefit.points_used
  where id = v_benefit.owner_id;

  if v_benefit.cashback_used > 0 then
    insert into public.wallet_transactions (
      client_id, type, amount, description, provider, provider_payment_id
    ) values (
      v_benefit.owner_id, 'refund', v_benefit.cashback_used,
      'Cashback devolvido por checkout de trilha não concluído',
      'INTERNAL', 'TRAIL_BENEFIT:' || v_benefit.id::text
    ) on conflict do nothing;
  end if;
  if v_benefit.points_used > 0 then
    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      v_benefit.owner_id, v_benefit.points_used,
      'Pontos devolvidos por checkout de trilha não concluído',
      'TRAIL_BENEFIT:' || v_benefit.id::text
    ) on conflict do nothing;
  end if;

  update public.trail_checkout_benefits
  set status = 'released', updated_at = now()
  where id = v_benefit.id;
  return true;
end;
$$;

create or replace function public.finalize_app_trail_checkout(
  p_benefit_id uuid,
  p_payment_id text,
  p_paid_amount numeric,
  p_billing_type text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_benefit public.trail_checkout_benefits%rowtype;
  v_count integer;
  v_processed boolean;
begin
  select * into v_benefit
  from public.trail_checkout_benefits
  where id = p_benefit_id
  for update;

  if v_benefit.id is null then raise exception 'Checkout do aplicativo não encontrado'; end if;
  if v_benefit.status = 'paid' then return false; end if;
  if v_benefit.status <> 'held' then raise exception 'Checkout do aplicativo não está ativo'; end if;
  if p_paid_amount + 0.01 < v_benefit.amount_due then
    raise exception 'Valor recebido abaixo do total do checkout';
  end if;

  select public.finalize_trail_payment(
    v_benefit.reservation_ids,
    p_payment_id,
    greatest(p_paid_amount, 0),
    p_billing_type
  ) into v_processed;

  if not v_processed then return false; end if;
  v_count := cardinality(v_benefit.reservation_ids);

  update public.reservas
  set purchase_channel = 'app',
      valor_original = round(v_benefit.gross_amount / v_count, 2),
      cashback_usado = round(v_benefit.cashback_used / v_count, 2),
      pontos_usados = floor(v_benefit.points_used::numeric / v_count)::integer
  where id = any(v_benefit.reservation_ids);

  update public.trail_checkout_benefits
  set status = 'paid',
      payment_id = coalesce(payment_id, p_payment_id),
      updated_at = now()
  where id = v_benefit.id;
  return true;
end;
$$;

create or replace function public.cancel_app_trail_checkout(
  p_benefit_id uuid,
  p_payment_id text,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_benefit public.trail_checkout_benefits%rowtype;
  v_awarded integer;
begin
  if p_status not in ('cancelado', 'expirado', 'estornado') then
    raise exception 'Status de cancelamento inválido';
  end if;

  select * into v_benefit
  from public.trail_checkout_benefits
  where id = p_benefit_id
  for update;
  if v_benefit.id is null then raise exception 'Checkout do aplicativo não encontrado'; end if;
  if v_benefit.status in ('released', 'canceled') then return false; end if;

  update public.clients
  set cashback_saldo = coalesce(cashback_saldo, 0) + v_benefit.cashback_used,
      pontos = coalesce(pontos, 0) + v_benefit.points_used
  where id = v_benefit.owner_id;

  if v_benefit.cashback_used > 0 then
    insert into public.wallet_transactions (
      client_id, type, amount, description, provider, provider_payment_id
    ) values (
      v_benefit.owner_id, 'refund', v_benefit.cashback_used,
      'Cashback devolvido por cancelamento da trilha',
      'INTERNAL', 'TRAIL_BENEFIT:' || v_benefit.id::text
    ) on conflict do nothing;
  end if;
  if v_benefit.points_used > 0 then
    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      v_benefit.owner_id, v_benefit.points_used,
      'Pontos devolvidos por cancelamento da trilha',
      'TRAIL_BENEFIT:' || v_benefit.id::text
    ) on conflict do nothing;
  end if;

  select coalesce(sum(points), 0)::integer into v_awarded
  from public.points_transactions
  where client_id = v_benefit.owner_id
    and provider_payment_id = p_payment_id
    and description = 'Compra de trilha pelo app'
    and points > 0;

  if v_awarded > 0 then
    update public.clients
    set pontos = greatest(0, coalesce(pontos, 0) - v_awarded)
    where id = v_benefit.owner_id;
    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      v_benefit.owner_id, -v_awarded,
      'Estorno de pontos da trilha comprada pelo app',
      p_payment_id
    ) on conflict do nothing;
  end if;

  update public.reservas
  set status_pagamento = p_status
  where id = any(v_benefit.reservation_ids)
    and status_pagamento in ('pendente', 'pago', 'atrasado');

  update public.trail_checkout_benefits
  set status = 'canceled', updated_at = now()
  where id = v_benefit.id;

  update public.clients client
  set membro_vip = (
    select count(*) >= 3
    from public.reservas reservation
    where reservation.client_id = client.id
      and reservation.status_pagamento = 'pago'
  )
  where client.id = v_benefit.owner_id;
  return true;
end;
$$;

revoke all on function public.prepare_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean) from public, anon, authenticated;
revoke all on function public.attach_app_trail_payment(uuid,text) from public, anon, authenticated;
revoke all on function public.release_app_trail_checkout(uuid) from public, anon, authenticated;
revoke all on function public.finalize_app_trail_checkout(uuid,text,numeric,text) from public, anon, authenticated;
revoke all on function public.cancel_app_trail_checkout(uuid,text,text) from public, anon, authenticated;

grant execute on function public.prepare_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean) to service_role;
grant execute on function public.attach_app_trail_payment(uuid,text) to service_role;
grant execute on function public.release_app_trail_checkout(uuid) to service_role;
grant execute on function public.finalize_app_trail_checkout(uuid,text,numeric,text) to service_role;
grant execute on function public.cancel_app_trail_checkout(uuid,text,text) to service_role;

commit;
