begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  topics text[] not null default array['new_trails','reservation_reminders','benefits']::text[],
  platform text not null default 'web',
  user_agent text,
  enabled boolean not null default true,
  failure_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(endpoint) between 20 and 2048),
  check (platform in ('ios','android','desktop','web')),
  check (topics <@ array['new_trails','reservation_reminders','benefits']::text[])
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(auth_user_id, enabled);
create index if not exists push_subscriptions_client_idx
  on public.push_subscriptions(client_id, enabled);
create index if not exists push_subscriptions_topics_idx
  on public.push_subscriptions using gin(topics);

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  target_url text not null default '/app',
  topic text,
  audience text not null default 'subscribers',
  status text not null default 'sending'
    check (status in ('sending','completed','failed','skipped')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (topic is null or topic in ('new_trails','reservation_reminders','benefits'))
);

create index if not exists push_campaigns_created_idx
  on public.push_campaigns(created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_campaigns enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_campaigns from anon, authenticated;

insert into public.audit_logs (action, resource_type, metadata)
values (
  'web_push.enabled',
  'push_subscriptions',
  jsonb_build_object(
    'topics', jsonb_build_array('new_trails','reservation_reminders','benefits'),
    'permission', 'explicit_user_gesture',
    'ios_mode', 'home_screen_web_app'
  )
);

commit;
