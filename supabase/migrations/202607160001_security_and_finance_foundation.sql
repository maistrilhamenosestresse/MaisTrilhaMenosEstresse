begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.clients add column if not exists pontos integer not null default 0;
alter table public.clients add column if not exists cashback_saldo numeric(12,2) not null default 0;
alter table public.clients add column if not exists membro_vip boolean not null default false;
alter table public.clients add column if not exists accepted_terms_at timestamptz;
alter table public.agendas add column if not exists taxa_gratis boolean not null default false;
alter table public.reservas add column if not exists checkout_owner_id uuid references public.clients(id) on delete set null;
alter table public.reservas add column if not exists checkout_batch_id uuid;

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Equipamentos',
  price numeric(12,2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  image text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS não adiciona colunas a tabelas legadas já existentes.
-- Estes ALTERs mantêm a migration idempotente para instalações anteriores do sistema.
alter table public.produtos add column if not exists active boolean not null default true;
alter table public.produtos add column if not exists updated_at timestamptz not null default now();

create table if not exists public.pedidos_loja (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  produto_id uuid not null references public.produtos(id),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  saldo_usado numeric(12,2) not null default 0 check (saldo_usado >= 0),
  pontos_usados integer not null default 0 check (pontos_usados >= 0),
  status_pagamento text not null default 'pendente' check (status_pagamento in ('pendente','pago','cancelado','estornado','expirado')),
  metodo_pagamento text not null default 'PIX',
  forma_entrega text,
  delivery_info text,
  payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pedidos_loja add column if not exists saldo_usado numeric(12,2) not null default 0;
alter table public.pedidos_loja add column if not exists pontos_usados integer not null default 0;
alter table public.pedidos_loja add column if not exists updated_at timestamptz not null default now();

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('credit','debit','refund')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  provider text not null default 'ASAAS',
  provider_payment_id text,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id, type)
);

create table if not exists public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  points integer not null,
  description text not null,
  provider_payment_id text,
  created_at timestamptz not null default now(),
  unique (provider_payment_id, description)
);

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  event_type text not null,
  payment_id text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processing','completed','failed','ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.asaas_payments (
  id text primary key,
  kind text not null check (kind in ('trail','store','recharge')),
  reference text not null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running','completed','failed')),
  database_key text,
  manifest_key text,
  size_bytes bigint,
  checksum_sha256 text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.content_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique,
  title text not null,
  content text,
  structured_content jsonb,
  mime_type text not null default 'text/plain',
  published boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dependent_registration_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  owner_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists reservas_client_status_idx on public.reservas(client_id, status_pagamento);
create index if not exists reservas_agenda_status_idx on public.reservas(agenda_id, status_pagamento);
create index if not exists reservas_checkout_batch_idx on public.reservas(checkout_batch_id, checkout_owner_id);
create index if not exists pedidos_loja_client_status_idx on public.pedidos_loja(client_id, status_pagamento);
create unique index if not exists pedidos_loja_payment_id_uidx on public.pedidos_loja(payment_id) where payment_id is not null;
create index if not exists asaas_webhook_payment_idx on public.asaas_webhook_events(payment_id);
create index if not exists asaas_payments_status_idx on public.asaas_payments(status, updated_at);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.reservas enable row level security;
alter table public.agendas enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos_loja enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.points_transactions enable row level security;
alter table public.asaas_webhook_events enable row level security;
alter table public.asaas_payments enable row level security;
alter table public.backup_runs enable row level security;
alter table public.content_documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.dependent_registration_invites enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.global_stats enable row level security;
alter table public.trilha_custos enable row level security;
alter table public.notificacoes enable row level security;
alter table public.bolao_apostas enable row level security;
alter table public.settings enable row level security;
alter table public.trilha_gpx enable row level security;
alter table public.fotos_trilhas enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Remove políticas legadas, inclusive políticas públicas com nomes desconhecidos.
-- Depois deste bloco, somente as políticas declaradas nesta migration permanecem.
do $$
declare existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'clients', 'reservas', 'agendas', 'avaliacoes', 'produtos',
        'pedidos_loja', 'wallet_transactions', 'points_transactions',
        'asaas_webhook_events', 'asaas_payments', 'backup_runs',
        'content_documents', 'audit_logs', 'dependent_registration_invites',
        'api_rate_limits', 'global_stats', 'trilha_custos', 'notificacoes',
        'bolao_apostas', 'settings', 'trilha_gpx', 'fotos_trilhas',
        'coupon_redemptions'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

-- As mídias oficiais foram migradas para a AWS; o Storage legado não aceita mais escrita pública.
drop policy if exists "Visualizacao Publica Fotos" on storage.objects;
drop policy if exists "Upload Publico Fotos" on storage.objects;
drop policy if exists "Atualizacao Publica Fotos" on storage.objects;
drop policy if exists "Exclusao Publica Fotos" on storage.objects;
update storage.buckets set public = false where id = 'fotos_agendas';

insert into public.profiles (id, role)
select id, 'admin' from auth.users
where lower(email) in (
  'niveamariamagalhaes28@gmail.com',
  'wellingtonf.social@gmail.com',
  'maistrilhamenosestresse@gmail.com'
)
on conflict (id) do update set role = 'admin', updated_at = now();

create or replace function public.handle_new_user_profile() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case
      when lower(coalesce(new.email, '')) in (
        'niveamariamagalhaes28@gmail.com',
        'wellingtonf.social@gmail.com',
        'maistrilhamenosestresse@gmail.com'
      ) then 'admin'
      else 'customer'
    end
  )
  on conflict (id) do update set updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

with auth_matches as (
  select
    c.id as client_id,
    u.id as auth_user_id,
    row_number() over (
      partition by u.id
      order by c.created_at desc nulls last, c.id
    ) as match_order
  from public.clients c
  join auth.users u on c.email is not null and lower(c.email) = lower(u.email)
  where c.auth_user_id is null
)
update public.clients c
set auth_user_id = m.auth_user_id
from auth_matches m
where c.id = m.client_id and m.match_order = 1;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "products public read" on public.produtos;
create policy "products public read" on public.produtos for select using (active = true);

drop policy if exists "agendas public read" on public.agendas;
create policy "agendas public read" on public.agendas for select using (true);

drop policy if exists "orders own read" on public.pedidos_loja;
create policy "orders own read" on public.pedidos_loja for select to authenticated using (
  exists (select 1 from public.clients c where c.id = client_id and c.auth_user_id = auth.uid())
);

drop policy if exists "wallet own read" on public.wallet_transactions;
create policy "wallet own read" on public.wallet_transactions for select to authenticated using (
  exists (select 1 from public.clients c where c.id = client_id and c.auth_user_id = auth.uid())
);
create policy "wallet admin read" on public.wallet_transactions for select to authenticated using (public.is_admin());

drop policy if exists "points own read" on public.points_transactions;
create policy "points own read" on public.points_transactions for select to authenticated using (
  exists (select 1 from public.clients c where c.id = client_id and c.auth_user_id = auth.uid())
);
create policy "points admin read" on public.points_transactions for select to authenticated using (public.is_admin());

revoke all on public.asaas_webhook_events from anon, authenticated;
revoke all on public.asaas_payments from anon, authenticated;
revoke all on public.backup_runs from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.dependent_registration_invites from anon, authenticated;
revoke all on public.api_rate_limits from anon, authenticated;

drop policy if exists "published content public read" on public.content_documents;
create policy "published content public read" on public.content_documents for select using (published = true);

drop policy if exists "All Clients" on public.clients;
drop policy if exists "Leitura Autenticada Clients" on public.clients;
drop policy if exists "Cadastro Publico Clients" on public.clients;
drop policy if exists "Atualizacao Autenticada Clients" on public.clients;
drop policy if exists "Exclusao Autenticada Clients" on public.clients;
drop policy if exists "clients admin all" on public.clients;
drop policy if exists "clients own read" on public.clients;
drop policy if exists "clients own update" on public.clients;
drop policy if exists "clients public registration" on public.clients;
create policy "clients admin all" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "clients own read" on public.clients for select to authenticated using (
  auth_user_id = auth.uid()
  or (
    auth_user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
revoke all on public.clients from anon;

drop policy if exists "All Reservas" on public.reservas;
drop policy if exists "Admin All Reservas" on public.reservas;
drop policy if exists "Insercao Publica Reservas Pendentes" on public.reservas;
drop policy if exists "reservations admin all" on public.reservas;
drop policy if exists "reservations own read" on public.reservas;
create policy "reservations admin all" on public.reservas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "reservations own read" on public.reservas for select to authenticated using (
  exists(select 1 from public.clients c where c.id = client_id and c.auth_user_id = auth.uid())
);
revoke all on public.reservas from anon;

drop policy if exists "Escrita Publica Agendas" on public.agendas;
drop policy if exists "Atualizacao Publica Agendas" on public.agendas;
drop policy if exists "Exclusao Publica Agendas" on public.agendas;
drop policy if exists "agendas admin insert" on public.agendas;
drop policy if exists "agendas admin update" on public.agendas;
drop policy if exists "agendas admin delete" on public.agendas;
create policy "agendas admin insert" on public.agendas for insert to authenticated with check (public.is_admin());
create policy "agendas admin update" on public.agendas for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "agendas admin delete" on public.agendas for delete to authenticated using (public.is_admin());
revoke insert, update, delete on public.agendas from anon;

drop policy if exists "All Avaliacoes" on public.avaliacoes;
drop policy if exists "reviews public approved read" on public.avaliacoes;
drop policy if exists "reviews public insert pending" on public.avaliacoes;
drop policy if exists "reviews admin all" on public.avaliacoes;
create policy "reviews public approved read" on public.avaliacoes for select using (approved = true);
create policy "reviews public insert pending" on public.avaliacoes for insert to anon, authenticated with check (approved = false);
create policy "reviews admin all" on public.avaliacoes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders admin all" on public.pedidos_loja;
drop policy if exists "products admin all" on public.produtos;
drop policy if exists "content admin all" on public.content_documents;
create policy "orders admin all" on public.pedidos_loja for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products admin all" on public.produtos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "content admin all" on public.content_documents for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "settings public read" on public.settings for select using (true);
create policy "settings admin all" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "global stats public read" on public.global_stats for select using (true);
create policy "global stats admin all" on public.global_stats for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "gpx public read" on public.trilha_gpx for select using (true);
create policy "gpx admin all" on public.trilha_gpx for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "trail costs admin all" on public.trilha_custos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "notifications admin all" on public.notificacoes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "trail photos admin all" on public.fotos_trilhas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pool bets admin all" on public.bolao_apostas for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Privilégios explícitos: RLS define as linhas e estes GRANTs limitam as operações.
revoke all on table
  public.profiles, public.clients, public.reservas, public.agendas,
  public.avaliacoes, public.produtos, public.pedidos_loja,
  public.wallet_transactions, public.points_transactions,
  public.asaas_webhook_events, public.asaas_payments, public.backup_runs,
  public.content_documents, public.audit_logs, public.dependent_registration_invites,
  public.api_rate_limits, public.global_stats, public.trilha_custos,
  public.notificacoes, public.bolao_apostas, public.settings, public.trilha_gpx,
  public.fotos_trilhas, public.coupon_redemptions
from anon, authenticated;

grant select on table
  public.agendas, public.avaliacoes, public.produtos, public.content_documents,
  public.global_stats, public.settings, public.trilha_gpx
to anon;
grant insert on table public.avaliacoes to anon;

grant select on table public.profiles, public.wallet_transactions, public.points_transactions to authenticated;
grant select, insert, update, delete on table
  public.clients, public.reservas, public.agendas, public.avaliacoes,
  public.produtos, public.pedidos_loja, public.content_documents,
  public.global_stats, public.trilha_custos, public.notificacoes,
  public.bolao_apostas, public.settings, public.trilha_gpx, public.fotos_trilhas
to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.credit_wallet_from_asaas(
  p_client_id uuid,
  p_payment_id text,
  p_amount numeric,
  p_description text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare inserted_id uuid;
begin
  insert into public.wallet_transactions (client_id, type, amount, description, provider, provider_payment_id)
  values (p_client_id, 'credit', p_amount, p_description, 'ASAAS', p_payment_id)
  on conflict (provider, provider_payment_id, type) do nothing
  returning id into inserted_id;

  if inserted_id is null then return false; end if;
  update public.clients set cashback_saldo = coalesce(cashback_saldo, 0) + p_amount where id = p_client_id;
  return true;
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
declare inserted_id uuid;
begin
  if p_points <= 0 then return false; end if;
  insert into public.points_transactions (client_id, points, description, provider_payment_id)
  values (p_client_id, p_points, p_description, p_payment_id)
  on conflict (provider_payment_id, description) do nothing
  returning id into inserted_id;

  if inserted_id is null then return false; end if;
  update public.clients set pontos = coalesce(pontos, 0) + p_points where id = p_client_id;
  return true;
end;
$$;

revoke all on function public.credit_wallet_from_asaas(uuid,text,numeric,text) from public, anon, authenticated;
revoke all on function public.award_points_from_asaas(uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.credit_wallet_from_asaas(uuid,text,numeric,text) to service_role;
grant execute on function public.award_points_from_asaas(uuid,text,integer,text) to service_role;

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
  v_remaining numeric(12,2);
begin
  select * into v_client from public.clients where id = p_client_id for update;
  select * into v_product from public.produtos where id = p_product_id and active = true for update;

  if v_client.id is null then raise exception 'Cliente não encontrado'; end if;
  if v_product.id is null then raise exception 'Produto não encontrado'; end if;
  if v_product.stock <= 0 then raise exception 'Produto fora de estoque'; end if;

  v_balance_used := least(coalesce(v_client.cashback_saldo, 0), v_product.price);
  v_points_used := least(coalesce(v_client.pontos, 0), floor((v_product.price - v_balance_used) * 100)::integer);
  v_remaining := greatest(0, v_product.price - v_balance_used - (v_points_used::numeric / 100));

  insert into public.pedidos_loja (
    client_id, produto_id, valor_total, saldo_usado, pontos_usados,
    status_pagamento, metodo_pagamento, forma_entrega, delivery_info
  ) values (
    p_client_id, p_product_id, v_product.price, v_balance_used, v_points_used,
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
    'amount_due', v_remaining,
    'balance_used', v_balance_used,
    'points_used', v_points_used,
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
  if p_paid_amount + 0.01 < (v_order.valor_total - v_order.saldo_usado - (v_order.pontos_usados::numeric / 100)) then
    raise exception 'Valor recebido abaixo do total do pedido';
  end if;

  update public.pedidos_loja
  set status_pagamento = 'pago', payment_id = p_payment_id, updated_at = now()
  where id = p_order_id;

  perform public.award_points_from_asaas(v_order.client_id, p_payment_id, floor(p_paid_amount)::integer, 'Compra na loja');
  return true;
end;
$$;

revoke all on function public.create_store_order(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.finalize_store_order_from_asaas(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.create_store_order(uuid,uuid,text,text) to service_role;
grant execute on function public.finalize_store_order_from_asaas(uuid,text,numeric) to service_role;

create or replace function public.cancel_store_order(
  p_order_id uuid,
  p_payment_id text,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.pedidos_loja%rowtype;
  v_awarded integer;
begin
  if p_status not in ('cancelado','expirado','estornado') then raise exception 'Status de cancelamento inválido'; end if;
  select * into v_order from public.pedidos_loja where id = p_order_id for update;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if v_order.status_pagamento in ('cancelado','expirado','estornado') then return false; end if;

  update public.clients
  set cashback_saldo = coalesce(cashback_saldo, 0) + v_order.saldo_usado,
      pontos = coalesce(pontos, 0) + v_order.pontos_usados
  where id = v_order.client_id;

  if v_order.saldo_usado > 0 then
    insert into public.wallet_transactions (client_id, type, amount, description, provider, provider_payment_id)
    values (v_order.client_id, 'refund', v_order.saldo_usado, 'Saldo devolvido por cancelamento da loja', 'INTERNAL', 'ORDER:' || v_order.id::text)
    on conflict do nothing;
  end if;
  if v_order.pontos_usados > 0 then
    insert into public.points_transactions (client_id, points, description, provider_payment_id)
    values (v_order.client_id, v_order.pontos_usados, 'Pontos devolvidos por cancelamento da loja', 'ORDER:' || v_order.id::text)
    on conflict do nothing;
  end if;

  select coalesce(sum(points), 0)::integer into v_awarded from public.points_transactions
  where client_id = v_order.client_id and provider_payment_id = p_payment_id and description = 'Compra na loja' and points > 0;
  if v_awarded > 0 then
    update public.clients set pontos = greatest(0, pontos - v_awarded) where id = v_order.client_id;
    insert into public.points_transactions (client_id, points, description, provider_payment_id)
    values (v_order.client_id, -v_awarded, 'Estorno de pontos da compra na loja', p_payment_id)
    on conflict do nothing;
  end if;

  update public.produtos set stock = stock + 1, updated_at = now() where id = v_order.produto_id;
  update public.pedidos_loja set status_pagamento = p_status, updated_at = now() where id = p_order_id;
  return true;
end;
$$;

create or replace function public.reverse_wallet_credit_from_asaas(p_client_id uuid, p_payment_id text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_amount numeric(12,2); inserted_id uuid;
begin
  select amount into v_amount from public.wallet_transactions
  where client_id = p_client_id and provider = 'ASAAS' and provider_payment_id = p_payment_id and type = 'credit';
  if v_amount is null then return false; end if;
  insert into public.wallet_transactions (client_id, type, amount, description, provider, provider_payment_id)
  values (p_client_id, 'debit', v_amount, 'Estorno de recarga Asaas', 'ASAAS', p_payment_id)
  on conflict (provider, provider_payment_id, type) do nothing returning id into inserted_id;
  if inserted_id is null then return false; end if;
  update public.clients set cashback_saldo = coalesce(cashback_saldo, 0) - v_amount where id = p_client_id;
  return true;
end;
$$;

create or replace function public.cancel_trail_payment(p_reservation_ids uuid[], p_payment_id text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_client_id uuid; v_awarded integer;
begin
  select client_id, points into v_client_id, v_awarded from public.points_transactions
  where provider_payment_id = p_payment_id and description = 'Compra de trilha' and points > 0 limit 1;
  update public.reservas set status_pagamento = 'cancelado'
  where id = any(p_reservation_ids) and status_pagamento in ('pendente','pago');
  if not found then return false; end if;
  if v_client_id is not null and coalesce(v_awarded, 0) > 0 then
    update public.clients set pontos = greatest(0, pontos - v_awarded) where id = v_client_id;
    insert into public.points_transactions (client_id, points, description, provider_payment_id)
    values (v_client_id, -v_awarded, 'Estorno de pontos da trilha', p_payment_id)
    on conflict do nothing;
    update public.clients c set membro_vip = (
      select count(*) >= 3 from public.reservas r where r.client_id = c.id and r.status_pagamento = 'pago'
    ) where c.id = v_client_id;
  end if;
  return true;
end;
$$;

revoke all on function public.cancel_store_order(uuid,text,text) from public, anon, authenticated;
revoke all on function public.reverse_wallet_credit_from_asaas(uuid,text) from public, anon, authenticated;
revoke all on function public.cancel_trail_payment(uuid[],text) from public, anon, authenticated;
grant execute on function public.cancel_store_order(uuid,text,text) to service_role;
grant execute on function public.reverse_wallet_credit_from_asaas(uuid,text) to service_role;
grant execute on function public.cancel_trail_payment(uuid[],text) to service_role;

drop function if exists public.create_pending_reservation(uuid,uuid);
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
  v_existing uuid;
  v_reservation_id uuid;
begin
  select max_capacity into v_capacity from public.agendas
  where id = p_agenda_id and date >= current_date for update;
  if v_capacity is null then raise exception 'Trilha não encontrada ou encerrada'; end if;

  select id into v_existing from public.reservas
  where client_id = p_client_id and agenda_id = p_agenda_id
    and status_pagamento in ('pendente','pago')
  order by created_at desc limit 1;
  if v_existing is not null then
    if exists(select 1 from public.reservas where id = v_existing and status_pagamento = 'pago') then
      raise exception 'Participante já possui reserva paga nesta trilha';
    end if;
    update public.reservas set checkout_owner_id = p_owner_id, checkout_batch_id = p_batch_id where id = v_existing;
    return v_existing;
  end if;

  select count(*) into v_reserved from public.reservas
  where agenda_id = p_agenda_id and status_pagamento in ('pendente','pago');
  if v_reserved >= v_capacity then raise exception 'Trilha lotada'; end if;

  insert into public.reservas (client_id, agenda_id, status_pagamento, valor_pago, checkout_owner_id, checkout_batch_id)
  values (p_client_id, p_agenda_id, 'pendente', 0, p_owner_id, p_batch_id)
  returning id into v_reservation_id;
  return v_reservation_id;
end;
$$;

revoke all on function public.create_pending_reservation(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_pending_reservation(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.create_pending_reservation_batch(
  p_owner_id uuid,
  p_batch_id uuid,
  p_entries jsonb
) returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare entry jsonb; client_value jsonb; reservation_ids uuid[] := '{}'; reservation_id uuid;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    raise exception 'Lote de reservas inválido';
  end if;
  for entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(entry->'client_ids') <> 'array' or jsonb_array_length(entry->'client_ids') = 0 then
      raise exception 'Participantes inválidos';
    end if;
    for client_value in select value from jsonb_array_elements(entry->'client_ids') loop
      reservation_id := public.create_pending_reservation(
        trim(both '"' from client_value::text)::uuid,
        (entry->>'agenda_id')::uuid,
        p_owner_id,
        p_batch_id
      );
      reservation_ids := array_append(reservation_ids, reservation_id);
    end loop;
  end loop;
  return reservation_ids;
end;
$$;

revoke all on function public.create_pending_reservation_batch(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_reservation_batch(uuid,uuid,jsonb) to service_role;

create or replace function public.claim_reservation_checkout(
  p_reservation_ids uuid[],
  p_owner_id uuid,
  p_attempt_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer; v_batch uuid; v_other_batch uuid; v_claimed integer;
begin
  perform 1 from public.reservas where id = any(p_reservation_ids) for update;
  select count(*), min(checkout_batch_id::text)::uuid, max(checkout_batch_id::text)::uuid,
         count(*) filter (where checkout_owner_id = p_owner_id and status_pagamento = 'pendente' and nsu_transacao is null)
  into v_count, v_batch, v_other_batch, v_claimed
  from public.reservas where id = any(p_reservation_ids);
  if v_count <> cardinality(p_reservation_ids) or v_count = 0 then raise exception 'Reservas inválidas'; end if;
  if v_batch is null or v_batch <> v_other_batch then raise exception 'Lote de reservas inválido'; end if;
  if v_claimed <> v_count then raise exception 'Reservas já processadas ou não autorizadas'; end if;
  update public.reservas set nsu_transacao = 'CREATING:' || p_attempt_id where id = any(p_reservation_ids);
  return v_batch;
end;
$$;

create or replace function public.release_reservation_checkout_claim(p_reservation_ids uuid[], p_attempt_id text) returns void
language sql
security definer
set search_path = public
as $$
  update public.reservas set nsu_transacao = null
  where id = any(p_reservation_ids) and nsu_transacao = 'CREATING:' || p_attempt_id and status_pagamento = 'pendente'
$$;

revoke all on function public.claim_reservation_checkout(uuid[],uuid,text) from public, anon, authenticated;
revoke all on function public.release_reservation_checkout_claim(uuid[],text) from public, anon, authenticated;
grant execute on function public.claim_reservation_checkout(uuid[],uuid,text) to service_role;
grant execute on function public.release_reservation_checkout_claim(uuid[],text) to service_role;

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
declare v_count integer; v_pending integer;
begin
  perform 1 from public.reservas where id = any(p_reservation_ids) for update;
  select count(*), count(*) filter (where status_pagamento = 'pendente')
  into v_count, v_pending from public.reservas where id = any(p_reservation_ids);
  if v_count <> cardinality(p_reservation_ids) or v_count = 0 then raise exception 'Reservas inválidas'; end if;
  if v_pending = 0 and not exists(
    select 1 from public.reservas where id = any(p_reservation_ids) and (status_pagamento <> 'pago' or nsu_transacao <> p_payment_id)
  ) then return false; end if;
  if v_pending <> v_count then raise exception 'Lote de reservas em estado inconsistente'; end if;
  update public.reservas
  set status_pagamento = 'pago',
      valor_pago = p_paid_amount / v_count,
      metodo_pagamento = coalesce(p_billing_type, 'ASAAS'),
      nsu_transacao = p_payment_id
  where id = any(p_reservation_ids);
  return true;
end;
$$;

revoke all on function public.finalize_trail_payment(uuid[],text,numeric,text) from public, anon, authenticated;
grant execute on function public.finalize_trail_payment(uuid[],text,numeric,text) to service_role;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  insert into public.api_rate_limits (rate_key, window_started_at, request_count, updated_at)
  values (p_rate_key, now(), 1, now())
  on conflict (rate_key) do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;

create or replace function public.redeem_campaign_coupon(
  p_campaign_id text,
  p_max_redemptions integer,
  p_coupon_codes text[],
  p_person_name text,
  p_ip_hash text,
  p_user_agent text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer; v_coupon text;
begin
  perform pg_advisory_xact_lock(hashtext(p_campaign_id));
  select count(*) into v_count from public.coupon_redemptions where campaign_id = p_campaign_id;
  if v_count >= p_max_redemptions then return null; end if;
  v_coupon := p_coupon_codes[v_count + 1];
  if v_coupon is null then return null; end if;
  insert into public.coupon_redemptions (campaign_id, ip_address, user_agent, person_name)
  values (p_campaign_id, p_ip_hash, left(p_user_agent, 500), left(p_person_name, 150));
  return v_coupon;
end;
$$;

revoke all on function public.redeem_campaign_coupon(text,integer,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.redeem_campaign_coupon(text,integer,text[],text,text,text) to service_role;

create or replace function public.increment_agenda_views(p_agenda_id uuid) returns void
language sql
security definer
set search_path = public
as $$
  update public.agendas set views = coalesce(views, 0) + 1 where id = p_agenda_id
$$;

revoke all on function public.increment_agenda_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_agenda_views(uuid) to service_role;

commit;
