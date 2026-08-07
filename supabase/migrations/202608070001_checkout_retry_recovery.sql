begin;

-- A reserva usa nsu_transacao tanto para a trava curta de criação quanto para
-- o identificador definitivo do provedor. O horário separado permite recuperar
-- uma trava abandonada sem liberar uma cobrança real ainda pendente.
alter table public.reservas
  add column if not exists checkout_claimed_at timestamptz;

create index if not exists reservas_checkout_claim_idx
  on public.reservas(checkout_claimed_at)
  where status_pagamento = 'pendente'
    and nsu_transacao like 'CREATING:%';

create or replace function public.create_pending_reservation(
  p_client_id uuid,
  p_agenda_id uuid,
  p_owner_id uuid,
  p_batch_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_reserved integer;
  v_existing public.reservas%rowtype;
  v_reservation_id uuid;
begin
  select max_capacity into v_capacity
  from public.agendas
  where id = p_agenda_id and date >= current_date
  for update;

  if v_capacity is null then
    raise exception 'Trilha não encontrada ou encerrada';
  end if;

  select * into v_existing
  from public.reservas
  where client_id = p_client_id
    and agenda_id = p_agenda_id
    and status_pagamento in ('pendente', 'pago')
  order by created_at desc
  limit 1
  for update;

  if v_existing.id is not null then
    if v_existing.status_pagamento = 'pago' then
      raise exception 'Participante já possui reserva paga nesta trilha';
    end if;

    -- Uma reserva sem cobrança pode entrar no novo carrinho. Uma trava de
    -- criação abandonada por mais de 15 minutos também pode ser recuperada.
    if v_existing.nsu_transacao is null
      or (
        v_existing.nsu_transacao like 'CREATING:%'
        and (
          v_existing.checkout_claimed_at is null
          or v_existing.checkout_claimed_at < now() - interval '15 minutes'
        )
      )
    then
      update public.reservas
      set checkout_owner_id = p_owner_id,
          checkout_batch_id = p_batch_id,
          nsu_transacao = null,
          checkout_claimed_at = null
      where id = v_existing.id;
    elsif v_existing.checkout_owner_id is distinct from p_owner_id then
      raise exception 'Reserva pendente pertence a outro checkout';
    end if;

    -- Não troca o lote quando já existe uma cobrança real. O checkout HTTP
    -- retoma o link existente de forma idempotente.
    return v_existing.id;
  end if;

  select count(*) into v_reserved
  from public.reservas
  where agenda_id = p_agenda_id
    and status_pagamento in ('pendente', 'pago');

  if v_reserved >= v_capacity then
    raise exception 'Trilha lotada';
  end if;

  insert into public.reservas (
    client_id,
    agenda_id,
    status_pagamento,
    valor_pago,
    checkout_owner_id,
    checkout_batch_id
  ) values (
    p_client_id,
    p_agenda_id,
    'pendente',
    0,
    p_owner_id,
    p_batch_id
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

create or replace function public.claim_reservation_checkout(
  p_reservation_ids uuid[],
  p_owner_id uuid,
  p_attempt_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_batch uuid;
  v_other_batch uuid;
  v_claimable integer;
begin
  perform 1
  from public.reservas
  where id = any(p_reservation_ids)
  for update;

  select
    count(*),
    min(checkout_batch_id::text)::uuid,
    max(checkout_batch_id::text)::uuid,
    count(*) filter (
      where checkout_owner_id = p_owner_id
        and status_pagamento = 'pendente'
        and (
          nsu_transacao is null
          or (
            nsu_transacao like 'CREATING:%'
            and (
              checkout_claimed_at is null
              or checkout_claimed_at < now() - interval '15 minutes'
            )
          )
        )
    )
  into v_count, v_batch, v_other_batch, v_claimable
  from public.reservas
  where id = any(p_reservation_ids);

  if v_count <> cardinality(p_reservation_ids) or v_count = 0 then
    raise exception 'Reservas inválidas';
  end if;
  if v_batch is null or v_batch <> v_other_batch then
    raise exception 'Lote de reservas inválido';
  end if;
  if v_claimable <> v_count then
    raise exception 'Reservas já processadas ou não autorizadas';
  end if;

  update public.reservas
  set nsu_transacao = 'CREATING:' || p_attempt_id,
      checkout_claimed_at = now()
  where id = any(p_reservation_ids);

  return v_batch;
end;
$$;

create or replace function public.release_reservation_checkout_claim(
  p_reservation_ids uuid[],
  p_attempt_id text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.reservas
  set nsu_transacao = null,
      checkout_claimed_at = null
  where id = any(p_reservation_ids)
    and nsu_transacao = 'CREATING:' || p_attempt_id
    and status_pagamento = 'pendente'
$$;

create or replace function public.finalize_trail_payment(
  p_reservation_ids uuid[],
  p_payment_id text,
  p_paid_amount numeric,
  p_billing_type text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_pending integer;
begin
  perform 1
  from public.reservas
  where id = any(p_reservation_ids)
  for update;

  select count(*), count(*) filter (where status_pagamento = 'pendente')
  into v_count, v_pending
  from public.reservas
  where id = any(p_reservation_ids);

  if v_count <> cardinality(p_reservation_ids) or v_count = 0 then
    raise exception 'Reservas inválidas';
  end if;
  if v_pending = 0 and not exists (
    select 1
    from public.reservas
    where id = any(p_reservation_ids)
      and (status_pagamento <> 'pago' or nsu_transacao <> p_payment_id)
  ) then
    return false;
  end if;
  if v_pending <> v_count then
    raise exception 'Lote de reservas em estado inconsistente';
  end if;

  update public.reservas
  set status_pagamento = 'pago',
      valor_pago = p_paid_amount / v_count,
      metodo_pagamento = coalesce(p_billing_type, 'ASAAS'),
      nsu_transacao = p_payment_id,
      checkout_claimed_at = null
  where id = any(p_reservation_ids);

  return true;
end;
$$;

revoke all on function public.create_pending_reservation(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.claim_reservation_checkout(uuid[],uuid,text)
  from public, anon, authenticated;
revoke all on function public.release_reservation_checkout_claim(uuid[],text)
  from public, anon, authenticated;
revoke all on function public.finalize_trail_payment(uuid[],text,numeric,text)
  from public, anon, authenticated;

grant execute on function public.create_pending_reservation(uuid,uuid,uuid,uuid)
  to service_role;
grant execute on function public.claim_reservation_checkout(uuid[],uuid,text)
  to service_role;
grant execute on function public.release_reservation_checkout_claim(uuid[],text)
  to service_role;
grant execute on function public.finalize_trail_payment(uuid[],text,numeric,text)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'checkout.retry_recovery_enabled',
  'reservas',
  jsonb_build_object(
    'claim_lease_minutes', 15,
    'resume_existing_provider_checkout', true,
    'preserve_provider_batch', true
  )
);

commit;
