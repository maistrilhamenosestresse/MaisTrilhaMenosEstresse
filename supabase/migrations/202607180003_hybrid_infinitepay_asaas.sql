begin;

-- Restaura o modelo híbrido:
--   Pix e cartão: InfinitePay
--   Boleto: Asaas
-- Esta migration contrapõe a 202607180002 sem alterar o histórico já aplicado.

drop trigger if exists infinitepay_checkouts_read_only
  on public.infinitepay_checkouts;

comment on table public.infinitepay_checkouts is
  'Checkouts hospedados da InfinitePay para Pix e cartão, confirmados por payment_check';

create or replace function public.enforce_supported_wallet_provider()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if upper(new.provider) not in ('ASAAS', 'INFINITEPAY', 'INTERNAL') then
    raise exception 'Provedor financeiro não autorizado';
  end if;
  new.provider := upper(new.provider);
  return new;
end;
$$;

create or replace function public.credit_wallet_from_provider(
  p_client_id uuid,
  p_payment_id text,
  p_amount numeric,
  p_description text,
  p_provider text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
  normalized_provider text := upper(p_provider);
begin
  if normalized_provider not in ('ASAAS', 'INFINITEPAY') then
    raise exception 'Provedor de pagamento inválido';
  end if;
  if p_amount <= 0 then return false; end if;

  insert into public.wallet_transactions (
    client_id, type, amount, description, provider, provider_payment_id
  )
  values (
    p_client_id, 'credit', p_amount, p_description,
    normalized_provider, p_payment_id
  )
  on conflict (provider, provider_payment_id, type) do nothing
  returning id into inserted_id;

  if inserted_id is null then return false; end if;

  update public.clients
  set cashback_saldo = coalesce(cashback_saldo, 0) + p_amount
  where id = p_client_id;

  return true;
end;
$$;

revoke all on public.infinitepay_checkouts from anon, authenticated;
revoke all on function public.credit_wallet_from_provider(uuid,text,numeric,text,text)
  from public, anon, authenticated;
grant execute on function public.credit_wallet_from_provider(uuid,text,numeric,text,text)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'payment.hybrid_checkout_enabled',
  'payment_provider',
  jsonb_build_object(
    'pix_and_card_provider', 'INFINITEPAY',
    'boleto_provider', 'ASAAS',
    'infinitepay_confirmation', 'payment_check',
    'enabled_at', now()
  )
);

commit;
