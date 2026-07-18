begin;

-- O Asaas passa a ser o único provedor externo autorizado para novas operações.
-- Registros do provedor anterior são preservados apenas para auditoria histórica.
drop function if exists public.credit_wallet_from_provider(uuid,text,numeric,text,text);

create or replace function public.enforce_supported_wallet_provider()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if upper(new.provider) not in ('ASAAS', 'INTERNAL') then
    raise exception 'Somente Asaas e operações internas são permitidos';
  end if;
  new.provider := upper(new.provider);
  return new;
end;
$$;

drop trigger if exists wallet_transactions_supported_provider
  on public.wallet_transactions;
create trigger wallet_transactions_supported_provider
before insert or update of provider on public.wallet_transactions
for each row execute function public.enforce_supported_wallet_provider();

create or replace function public.prevent_legacy_payment_provider_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Integração legada desativada; use exclusivamente o Asaas';
end;
$$;

-- Recria o trigger após a função existir (o bloco acima é tolerante quando a
-- tabela histórica não existe em uma instalação nova).
do $$
begin
  if to_regclass('public.infinitepay_checkouts') is not null then
    execute 'comment on table public.infinitepay_checkouts is ''Histórico somente leitura; integração desativada em favor do Asaas''';
    execute 'drop trigger if exists infinitepay_checkouts_read_only on public.infinitepay_checkouts';
    execute $trigger$
      create trigger infinitepay_checkouts_read_only
      before insert or update or delete on public.infinitepay_checkouts
      for each statement execute function public.prevent_legacy_payment_provider_mutation()
    $trigger$;
    execute 'revoke all on public.infinitepay_checkouts from anon, authenticated';
  end if;
end
$$;

alter table public.backup_runs
  add column if not exists manifest_checksum_sha256 text,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists table_count integer,
  add column if not exists auth_user_count integer,
  add column if not exists media_object_count integer,
  add column if not exists media_copied_count integer,
  add column if not exists integrity_verified_at timestamptz;

create table if not exists public.backup_restore_tests (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid references public.backup_runs(id) on delete set null,
  status text not null check (status in ('running', 'completed', 'failed')),
  database_checksum_valid boolean,
  manifest_checksum_valid boolean,
  tables_verified integer,
  auth_users_verified integer,
  media_objects_verified integer,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.backup_restore_tests enable row level security;
revoke all on public.backup_restore_tests from anon, authenticated;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'payment.asaas_only_enabled',
  'payment_provider',
  jsonb_build_object(
    'external_provider', 'ASAAS',
    'billing_types', jsonb_build_array('PIX', 'CREDIT_CARD', 'BOLETO'),
    'legacy_runtime_disabled', true,
    'authentication_provider', 'SUPABASE_AUTH'
  )
);

commit;
