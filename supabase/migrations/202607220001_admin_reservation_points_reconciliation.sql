begin;

-- Mantém o saldo de pontos coerente quando uma reserva é criada ou corrigida
-- manualmente pelo painel administrativo. A função também entende cobranças
-- do app agrupadas pelo mesmo identificador de pagamento.
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
  v_reservation public.reservas%rowtype;
  v_reward_key text;
  v_reward_client_id uuid;
  v_expected_points integer := 0;
  v_recorded_points integer := 0;
  v_points_delta integer := 0;
  v_reference_amount numeric(12,2) := 0;
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

  select * into v_reservation
  from public.reservas
  where id = p_reservation_id
  for update;

  if v_reservation.id is null then
    raise exception 'Reserva não encontrada';
  end if;

  update public.reservas
  set status_pagamento = p_status,
      valor_pago = round(p_amount, 2),
      metodo_pagamento = upper(trim(p_method))
  where id = p_reservation_id;

  if v_reservation.purchase_channel = 'admin'
     or nullif(trim(coalesce(v_reservation.nsu_transacao, '')), '') is null then
    -- Compatível com o identificador usado no backfill histórico.
    v_reward_key := 'LEGACY_TRAIL:' || p_reservation_id::text;
    v_reward_client_id := v_reservation.client_id;

    select case
      when p_status <> 'pago' then 0
      when upper(trim(p_method)) = 'CORTESIA' then 0
      when p_amount > 0 then p_amount
      else coalesce(agenda.price, 0)
    end
    into v_reference_amount
    from public.agendas agenda
    where agenda.id = v_reservation.agenda_id;

    v_expected_points := greatest(0, floor(coalesce(v_reference_amount, 0))::integer);
  else
    -- Uma compra do app pode conter várias reservas. Os pontos pertencem ao
    -- comprador principal e acompanham o total que ainda permanece pago.
    v_reward_key := v_reservation.nsu_transacao;

    perform 1
    from public.reservas reservation
    where reservation.nsu_transacao = v_reward_key
    for update;

    select point_entry.client_id
    into v_reward_client_id
    from public.points_transactions point_entry
    where point_entry.provider_payment_id = v_reward_key
      and point_entry.points > 0
    order by point_entry.created_at asc
    limit 1;

    v_reward_client_id := coalesce(
      v_reward_client_id,
      v_reservation.checkout_owner_id,
      v_reservation.client_id
    );

    select greatest(0, floor(coalesce(sum(reservation.valor_pago), 0))::integer)
    into v_expected_points
    from public.reservas reservation
    where reservation.nsu_transacao = v_reward_key
      and reservation.status_pagamento = 'pago';
  end if;

  select coalesce(sum(point_entry.points), 0)::integer
  into v_recorded_points
  from public.points_transactions point_entry
  where point_entry.client_id = v_reward_client_id
    and point_entry.provider_payment_id = v_reward_key;

  v_points_delta := v_expected_points - v_recorded_points;

  if v_points_delta <> 0 then
    update public.clients
    set pontos = greatest(0, coalesce(pontos, 0) + v_points_delta)
    where id = v_reward_client_id;

    insert into public.points_transactions (
      client_id,
      points,
      description,
      provider_payment_id
    ) values (
      v_reward_client_id,
      v_points_delta,
      case
        when v_points_delta > 0 then 'Compra de trilha confirmada manualmente'
        else 'Estorno de pontos por alteração da reserva'
      end || ' · ajuste ' || substring(gen_random_uuid()::text from 1 for 8),
      v_reward_key
    );
  end if;

  update public.clients client
  set membro_vip = (
    select count(*) >= 3
    from public.reservas reservation
    where reservation.client_id = client.id
      and reservation.status_pagamento = 'pago'
  )
  where client.id in (v_reservation.client_id, v_reward_client_id);

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'reward_client_id', v_reward_client_id,
    'reward_key', v_reward_key,
    'expected_points', v_expected_points,
    'previously_recorded_points', v_recorded_points,
    'points_adjustment', v_points_delta
  );
end;
$$;

revoke all on function public.admin_update_reservation_payment(uuid,text,numeric,text)
  from public, anon, authenticated;
grant execute on function public.admin_update_reservation_payment(uuid,text,numeric,text)
  to service_role;

-- Reconciliável e idempotente: premia vendas manuais antigas que ainda não
-- tinham lançamento e não duplica as que já passaram pelo backfill.
do $$
declare
  reservation record;
begin
  for reservation in
    select id, status_pagamento, valor_pago, metodo_pagamento
    from public.reservas
    where status_pagamento = 'pago'
      and (purchase_channel = 'admin' or nsu_transacao is null)
  loop
    perform public.admin_update_reservation_payment(
      reservation.id,
      reservation.status_pagamento,
      coalesce(reservation.valor_pago, 0),
      coalesce(nullif(reservation.metodo_pagamento, ''), 'PIX')
    );
  end loop;
end
$$;

commit;
