begin;

-- Estorna somente os pontos líquidos que ainda permanecem associados ao
-- pagamento. Isso evita desconto duplicado após uma correção administrativa.
create or replace function public.cancel_trail_payment(
  p_reservation_ids uuid[],
  p_payment_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_net_awarded integer := 0;
  v_updated integer := 0;
begin
  select point_entry.client_id
  into v_client_id
  from public.points_transactions point_entry
  where point_entry.provider_payment_id = p_payment_id
    and point_entry.points > 0
  order by point_entry.created_at asc
  limit 1;

  update public.reservas
  set status_pagamento = 'cancelado'
  where id = any(p_reservation_ids)
    and status_pagamento in ('pendente', 'pago', 'atrasado');
  get diagnostics v_updated = row_count;

  if v_updated = 0 then return false; end if;

  if v_client_id is not null then
    select coalesce(sum(point_entry.points), 0)::integer
    into v_net_awarded
    from public.points_transactions point_entry
    where point_entry.client_id = v_client_id
      and point_entry.provider_payment_id = p_payment_id;

    if v_net_awarded > 0 then
      update public.clients
      set pontos = greatest(0, coalesce(pontos, 0) - v_net_awarded)
      where id = v_client_id;

      insert into public.points_transactions (
        client_id, points, description, provider_payment_id
      ) values (
        v_client_id, -v_net_awarded, 'Estorno de pontos da trilha', p_payment_id
      ) on conflict do nothing;
    end if;

    update public.clients client
    set membro_vip = (
      select count(*) >= 3
      from public.reservas reservation
      where reservation.client_id = client.id
        and reservation.status_pagamento = 'pago'
    )
    where client.id = v_client_id;
  end if;

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
  v_net_awarded integer := 0;
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

  select coalesce(sum(point_entry.points), 0)::integer
  into v_net_awarded
  from public.points_transactions point_entry
  where point_entry.client_id = v_benefit.owner_id
    and point_entry.provider_payment_id = p_payment_id;

  if v_net_awarded > 0 then
    update public.clients
    set pontos = greatest(0, coalesce(pontos, 0) - v_net_awarded)
    where id = v_benefit.owner_id;

    insert into public.points_transactions (
      client_id, points, description, provider_payment_id
    ) values (
      v_benefit.owner_id, -v_net_awarded,
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

revoke all on function public.cancel_trail_payment(uuid[],text)
  from public, anon, authenticated;
revoke all on function public.cancel_app_trail_checkout(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.cancel_trail_payment(uuid[],text) to service_role;
grant execute on function public.cancel_app_trail_checkout(uuid,text,text) to service_role;

commit;
