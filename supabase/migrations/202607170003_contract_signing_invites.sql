begin;

create table if not exists public.contract_signing_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contract_signing_invites_client_idx
  on public.contract_signing_invites(client_id, created_at desc);
create index if not exists contract_signing_invites_expiry_idx
  on public.contract_signing_invites(expires_at)
  where used_at is null;

alter table public.contract_signing_invites enable row level security;
revoke all on public.contract_signing_invites from anon, authenticated;

commit;
