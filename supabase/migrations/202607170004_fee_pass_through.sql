begin;

-- O preço da agenda representa o líquido que a empresa deseja receber.
-- A tarifa da Asaas é calculada e adicionada ao checkout.
update public.agendas
set taxa_gratis = false
where taxa_gratis is distinct from false;

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

  -- p_paid_amount é o valor bruto cobrado do cliente. O valor da venda
  -- registrado na reserva deve ser o líquido devido após cashback/pontos.
  select public.finalize_trail_payment(
    v_benefit.reservation_ids,
    p_payment_id,
    greatest(v_benefit.amount_due, 0),
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

revoke all on function public.finalize_app_trail_checkout(uuid,text,numeric,text)
  from public, anon, authenticated;
grant execute on function public.finalize_app_trail_checkout(uuid,text,numeric,text)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'payment.fee_pass_through_enabled',
  'agendas',
  jsonb_build_object(
    'pricing_rule', 'agenda price is desired net value',
    'provider', 'ASAAS',
    'applies_to', jsonb_build_array('PIX', 'BOLETO', 'CREDIT_CARD')
  )
);

commit;
