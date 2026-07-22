begin;

-- Pontos são benefício de fidelidade, não saldo financeiro.
-- Nova conversão: 200 pontos = R$ 1,00 de desconto (0,5% sobre a regra de
-- acúmulo de 1 ponto por real pago). Valores sempre são truncados em centavos.

create or replace function public.points_to_discount(p_points integer)
returns numeric
language sql
immutable
set search_path = public
as $$
  select floor(greatest(coalesce(p_points, 0), 0)::numeric / 2) / 100
$$;

create or replace function public.discount_to_points(p_amount numeric)
returns integer
language sql
immutable
set search_path = public
as $$
  select (floor(greatest(coalesce(p_amount, 0), 0) * 100)::integer * 2)
$$;

revoke all on function public.points_to_discount(integer) from public, anon, authenticated;
revoke all on function public.discount_to_points(numeric) from public, anon, authenticated;
grant execute on function public.points_to_discount(integer) to service_role;
grant execute on function public.discount_to_points(numeric) to service_role;

alter table public.trail_checkout_benefits
  add column if not exists points_discount_value numeric(12,2) not null default 0
  check (points_discount_value >= 0);

-- Preserva a condição contratada nos checkouts criados antes desta alteração.
update public.trail_checkout_benefits
set points_discount_value = greatest(round(gross_amount - cashback_used - amount_due, 2), 0)
where points_used > 0 and points_discount_value = 0;

alter table public.pedidos_loja
  add column if not exists points_discount_value numeric(12,2) not null default 0
  check (points_discount_value >= 0);

-- Pedidos antigos foram criados na proporção anterior de 100 pontos por real.
update public.pedidos_loja
set points_discount_value = round(pontos_usados::numeric / 100, 2)
where pontos_usados > 0 and points_discount_value = 0;

create or replace function public.hold_app_trail_checkout(
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
  v_points_discount numeric(12,2) := 0;
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
      public.discount_to_points(public.points_to_discount(coalesce(v_client.pontos, 0))),
      public.discount_to_points(v_remaining)
    );
    v_points_discount := public.points_to_discount(v_points);
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
    'amount_due', greatest(round(v_remaining, 2), 0)
  );
exception
  when unique_violation then
    raise exception 'Este checkout já possui um pagamento em andamento';
end;
$$;

create or replace function public.create_store_order(
  p_client_id uuid,
  p_product_id uuid,
  p_delivery_method text,
  p_delivery_info text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_product public.produtos%rowtype;
  v_order_id uuid;
  v_balance_used numeric(12,2);
  v_points_used integer;
  v_points_discount numeric(12,2);
  v_remaining numeric(12,2);
begin
  select * into v_client from public.clients where id = p_client_id for update;
  select * into v_product from public.produtos where id = p_product_id and active = true for update;

  if v_client.id is null then raise exception 'Cliente não encontrado'; end if;
  if v_product.id is null then raise exception 'Produto não encontrado'; end if;
  if v_product.stock <= 0 then raise exception 'Produto fora de estoque'; end if;

  v_balance_used := least(coalesce(v_client.cashback_saldo, 0), v_product.price);
  v_points_used := least(
    public.discount_to_points(public.points_to_discount(coalesce(v_client.pontos, 0))),
    public.discount_to_points(v_product.price - v_balance_used)
  );
  v_points_discount := public.points_to_discount(v_points_used);
  v_remaining := greatest(0, v_product.price - v_balance_used - v_points_discount);

  insert into public.pedidos_loja (
    client_id, produto_id, valor_total, saldo_usado, pontos_usados,
    points_discount_value, status_pagamento, metodo_pagamento,
    forma_entrega, delivery_info
  ) values (
    p_client_id, p_product_id, v_product.price, v_balance_used, v_points_used,
    v_points_discount,
    case when v_remaining = 0 then 'pago' else 'pendente' end,
    case when v_remaining = 0 then 'SALDO_E_PONTOS' else 'ASAAS' end,
    p_delivery_method, p_delivery_info
  ) returning id into v_order_id;

  update public.produtos set stock = stock - 1, updated_at = now() where id = p_product_id;

  update public.clients
  set cashback_saldo = cashback_saldo - v_balance_used,
      pontos = pontos - v_points_used
  where id = p_client_id;

  if v_balance_used > 0 then
    insert into public.wallet_transactions (client_id, type, amount, description, provider, provider_payment_id)
    values (p_client_id, 'debit', v_balance_used, 'Saldo reservado para compra na loja', 'INTERNAL', 'ORDER:' || v_order_id::text);
  end if;
  if v_points_used > 0 then
    insert into public.points_transactions (client_id, points, description, provider_payment_id)
    values (p_client_id, -v_points_used, 'Pontos reservados para compra na loja', 'ORDER:' || v_order_id::text);
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'amount_due', round(v_remaining, 2),
    'balance_used', v_balance_used,
    'points_used', v_points_used,
    'points_discount_value', v_points_discount,
    'paid', v_remaining = 0
  );
end;
$$;

create or replace function public.finalize_store_order_from_asaas(
  p_order_id uuid,
  p_payment_id text,
  p_paid_amount numeric
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.pedidos_loja%rowtype;
begin
  select * into v_order from public.pedidos_loja where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if v_order.status_pagamento = 'pago' then return false; end if;
  if p_paid_amount + 0.01 < (v_order.valor_total - v_order.saldo_usado - v_order.points_discount_value) then
    raise exception 'Valor recebido abaixo do total do pedido';
  end if;

  update public.pedidos_loja
  set status_pagamento = 'pago', payment_id = p_payment_id, updated_at = now()
  where id = p_order_id;

  perform public.award_points_from_asaas(
    v_order.client_id, p_payment_id, floor(p_paid_amount)::integer, 'Compra na loja'
  );
  return true;
end;
$$;

revoke all on function public.hold_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean)
  from public, anon, authenticated;
revoke all on function public.create_store_order(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.finalize_store_order_from_asaas(uuid,text,numeric)
  from public, anon, authenticated;
grant execute on function public.hold_app_trail_checkout(uuid[],uuid,numeric,boolean,boolean)
  to service_role;
grant execute on function public.create_store_order(uuid,uuid,text,text)
  to service_role;
grant execute on function public.finalize_store_order_from_asaas(uuid,text,numeric)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'gamification.points_discount_rate_updated',
  'points_transactions',
  jsonb_build_object(
    'points_per_brl_discount', 200,
    'previous_points_per_brl_discount', 100,
    'points_are_wallet_balance', false,
    'points_are_discount_only', true
  )
);

commit;
