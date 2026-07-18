begin;

create table if not exists public.trail_offline_map_packs (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null unique references public.agendas(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','processing','published','failed')),
  map_url text,
  style_url text,
  checksum_sha256 text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  bounds jsonb,
  min_zoom integer not null default 10,
  max_zoom integer not null default 17,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_operation_pois (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agendas(id) on delete cascade,
  kind text not null check (kind in (
    'meeting','checkpoint','water','rest','viewpoint','danger',
    'bathroom','signal','evacuation','medical','other'
  )),
  name text not null,
  description text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null default 30 check (radius_meters between 5 and 1000),
  required_ack boolean not null default false,
  media_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_operations (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agendas(id) on delete restrict,
  name text not null,
  status text not null default 'planned' check (status in (
    'planned','check_in','active','paused','completed','cancelled'
  )),
  created_by uuid not null references auth.users(id) on delete restrict,
  primary_guide_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz,
  ended_at timestamptz,
  join_token_hash text not null unique,
  session_key_fingerprint text,
  settings jsonb not null default jsonb_build_object(
    'location_interval_seconds', 15,
    'off_route_meters', 50,
    'max_hops', 8,
    'event_retention_days', 30,
    'participant_group_map', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_operation_members (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.trail_operations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in (
    'guide','assistant_guide','sweeper','participant'
  )),
  display_name text not null,
  device_id text not null,
  device_platform text check (device_platform is null or device_platform in ('android','ios')),
  signing_public_key text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz,
  last_status text not null default 'ok' check (last_status in (
    'ok','rest_requested','help_requested','sos','off_route','disconnected','finished'
  )),
  battery_percent integer check (battery_percent is null or battery_percent between 0 and 100),
  permissions jsonb not null default '{}'::jsonb,
  unique (operation_id, auth_user_id),
  unique (operation_id, device_id)
);

create table if not exists public.trail_operation_events (
  message_id uuid primary key,
  operation_id uuid not null references public.trail_operations(id) on delete cascade,
  sender_member_id uuid not null references public.trail_operation_members(id) on delete cascade,
  origin_device_id text not null,
  event_type text not null check (event_type in (
    'location','status','rest','help','sos','incident','checkpoint',
    'battery','mesh_ack','member_joined','member_left','system'
  )),
  client_created_at timestamptz not null,
  expires_at timestamptz not null,
  received_at timestamptz not null default now(),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  battery_percent integer check (battery_percent is null or battery_percent between 0 and 100),
  status text,
  hop_count integer not null default 0 check (hop_count between 0 and 32),
  max_hops integer not null default 8 check (max_hops between 1 and 16),
  signature text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.trail_operation_latest_locations (
  member_id uuid primary key references public.trail_operation_members(id) on delete cascade,
  operation_id uuid not null references public.trail_operations(id) on delete cascade,
  source_message_id uuid not null references public.trail_operation_events(message_id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  battery_percent integer,
  status text not null default 'ok',
  client_created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_operation_reports (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.trail_operations(id) on delete cascade,
  reporter_member_id uuid not null references public.trail_operation_members(id) on delete cascade,
  related_member_id uuid references public.trail_operation_members(id) on delete set null,
  report_type text not null check (report_type in (
    'incident','medical','hazard','rest','equipment','wildlife','route','other'
  )),
  severity text not null default 'info' check (severity in ('info','attention','urgent','critical')),
  title text not null,
  description text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  media_keys text[] not null default '{}',
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  client_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists trail_operations_agenda_status_idx
  on public.trail_operations(agenda_id, status, starts_at);
create index if not exists trail_operation_members_operation_status_idx
  on public.trail_operation_members(operation_id, last_status, last_seen_at);
create index if not exists trail_operation_events_operation_received_idx
  on public.trail_operation_events(operation_id, received_at, message_id);
create index if not exists trail_operation_events_sender_client_time_idx
  on public.trail_operation_events(sender_member_id, client_created_at desc);
create index if not exists trail_operation_latest_locations_operation_idx
  on public.trail_operation_latest_locations(operation_id, updated_at desc);
create index if not exists trail_operation_reports_operation_status_idx
  on public.trail_operation_reports(operation_id, status, created_at desc);
create index if not exists trail_operation_pois_agenda_sort_idx
  on public.trail_operation_pois(agenda_id, active, sort_order);

alter table public.trail_offline_map_packs enable row level security;
alter table public.trail_operation_pois enable row level security;
alter table public.trail_operations enable row level security;
alter table public.trail_operation_members enable row level security;
alter table public.trail_operation_events enable row level security;
alter table public.trail_operation_latest_locations enable row level security;
alter table public.trail_operation_reports enable row level security;

revoke all on public.trail_offline_map_packs from anon, authenticated;
revoke all on public.trail_operation_pois from anon, authenticated;
revoke all on public.trail_operations from anon, authenticated;
revoke all on public.trail_operation_members from anon, authenticated;
revoke all on public.trail_operation_events from anon, authenticated;
revoke all on public.trail_operation_latest_locations from anon, authenticated;
revoke all on public.trail_operation_reports from anon, authenticated;

grant all on public.trail_offline_map_packs to service_role;
grant all on public.trail_operation_pois to service_role;
grant all on public.trail_operations to service_role;
grant all on public.trail_operation_members to service_role;
grant all on public.trail_operation_events to service_role;
grant all on public.trail_operation_latest_locations to service_role;
grant all on public.trail_operation_reports to service_role;

create or replace function public.upsert_trail_latest_location(
  p_member_id uuid,
  p_operation_id uuid,
  p_source_message_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_battery_percent integer,
  p_status text,
  p_client_created_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.trail_operation_latest_locations (
    member_id, operation_id, source_message_id, latitude, longitude,
    accuracy_meters, battery_percent, status, client_created_at, updated_at
  ) values (
    p_member_id, p_operation_id, p_source_message_id, p_latitude, p_longitude,
    p_accuracy_meters, p_battery_percent, coalesce(p_status, 'ok'), p_client_created_at, now()
  )
  on conflict (member_id) do update set
    source_message_id = excluded.source_message_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_meters = excluded.accuracy_meters,
    battery_percent = excluded.battery_percent,
    status = excluded.status,
    client_created_at = excluded.client_created_at,
    updated_at = now()
  where excluded.client_created_at >= public.trail_operation_latest_locations.client_created_at;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.upsert_trail_latest_location(
  uuid,uuid,uuid,double precision,double precision,double precision,integer,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.upsert_trail_latest_location(
  uuid,uuid,uuid,double precision,double precision,double precision,integer,text,timestamptz
) to service_role;

commit;
