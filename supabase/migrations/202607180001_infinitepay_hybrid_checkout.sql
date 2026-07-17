begin;

create table if not exists public.infinitepay_checkouts (
  id uuid primary key,
  order_nsu text not null unique,
  kind text not null check (kind in ('trail', 'store', 'recharge')),
  reference text not null,
  client_id uuid references public.clients(id) on delete set null,
  expected_amount_cents integer not null check (expected_amount_cents > 0),
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'paid', 'failed', 'expired', 'canceled')),
  checkout_url text,
  transaction_nsu text unique,
  invoice_slug text,
  capture_method text check (capture_method is null or capture_method in ('pix', 'credit_card')),
  paid_amount_cents integer check (paid_amount_cents is null or paid_amount_cents > 0),
  installments integer check (installments is null or installments between 1 and 12),
  receipt_url text,
  last_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists infinitepay_checkouts_status_idx
  on public.infinitepay_checkouts(status, updated_at);
create index if not exists infinitepay_checkouts_client_idx
  on public.infinitepay_checkouts(client_id, created_at desc);
create index if not exists infinitepay_checkouts_reference_idx
  on public.infinitepay_checkouts(reference);

alter table public.infinitepay_checkouts enable row level security;
revoke all on public.infinitepay_checkouts from anon, authenticated;

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
declare inserted_id uuid;
begin
  if p_provider not in ('ASAAS', 'INFINITEPAY') then
    raise exception 'Provedor de pagamento inválido';
  end if;
  if p_amount <= 0 then return false; end if;

  insert into public.wallet_transactions (
    client_id, type, amount, description, provider, provider_payment_id
  )
  values (
    p_client_id, 'credit', p_amount, p_description, p_provider, p_payment_id
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

revoke all on function public.credit_wallet_from_provider(uuid,text,numeric,text,text)
  from public, anon, authenticated;
grant execute on function public.credit_wallet_from_provider(uuid,text,numeric,text,text)
  to service_role;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'payment.hybrid_checkout_prepared',
  'payment_provider',
  jsonb_build_object(
    'pix_and_card_provider', 'INFINITEPAY',
    'boleto_provider', 'ASAAS',
    'infinitepay_mode', 'hosted_checkout_redirect',
    'confirmation', 'webhook plus payment_check'
  )
);

commit;
