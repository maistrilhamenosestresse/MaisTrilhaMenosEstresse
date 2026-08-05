begin;

alter table public.fotos_trilhas add column if not exists original_aws_key text;
alter table public.fotos_trilhas add column if not exists original_mime_type text;

create table if not exists public.google_photos_import_jobs (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agendas(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'awaiting_selection' check (
    status in ('awaiting_selection','queued','processing','completed','completed_with_errors','failed','expired','cancelled')
  ),
  picker_session_id text not null unique,
  picker_uri text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  picker_expires_at timestamptz,
  total_items integer not null default 0 check (total_items >= 0),
  queued_items integer not null default 0 check (queued_items >= 0),
  processed_items integer not null default 0 check (processed_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.google_photos_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.google_photos_import_jobs(id) on delete cascade,
  google_media_id text not null,
  filename text not null,
  mime_type text not null,
  base_url text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  aws_key text,
  photo_id uuid references public.fotos_trilhas(id) on delete set null,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, google_media_id)
);

create index if not exists google_photos_jobs_agenda_created_idx
  on public.google_photos_import_jobs(agenda_id, created_at desc);
create index if not exists google_photos_jobs_status_idx
  on public.google_photos_import_jobs(status, updated_at);
create index if not exists google_photos_items_job_status_idx
  on public.google_photos_import_items(job_id, status, created_at);

alter table public.google_photos_import_jobs enable row level security;
alter table public.google_photos_import_items enable row level security;
revoke all on public.google_photos_import_jobs from anon, authenticated;
revoke all on public.google_photos_import_items from anon, authenticated;

create or replace function public.finish_google_photos_import_item(
  p_item_id uuid,
  p_aws_key text default null,
  p_aws_url text default null,
  p_face_ids text default null,
  p_original_aws_key text default null,
  p_original_mime_type text default null,
  p_error_message text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.google_photos_import_items%rowtype;
  v_job_id uuid;
  v_agenda_id uuid;
  v_photo_id uuid;
  v_total integer;
  v_completed integer;
  v_failed integer;
begin
  select * into v_item
  from public.google_photos_import_items
  where id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Item de importação não encontrado';
  end if;
  if v_item.status = 'completed' then
    return false;
  end if;

  select agenda_id into v_agenda_id
  from public.google_photos_import_jobs
  where id = v_item.job_id
  for update;
  if v_agenda_id is null then
    raise exception 'Importação não encontrada';
  end if;

  v_job_id := v_item.job_id;
  if nullif(trim(coalesce(p_error_message, '')), '') is not null then
    update public.google_photos_import_items
    set status = 'failed',
        error_message = left(p_error_message, 1000),
        updated_at = now()
    where id = p_item_id;
  else
    if nullif(trim(coalesce(p_aws_key, '')), '') is null or nullif(trim(coalesce(p_aws_url, '')), '') is null then
      raise exception 'Destino AWS obrigatório';
    end if;

    if v_item.photo_id is null then
      insert into public.fotos_trilhas (
        agenda_id, aws_url, aws_key, aws_face_id, original_aws_key, original_mime_type
      ) values (
        v_agenda_id, p_aws_url, p_aws_key, nullif(p_face_ids, ''),
        nullif(p_original_aws_key, ''), nullif(p_original_mime_type, '')
      )
      returning id into v_photo_id;
    else
      v_photo_id := v_item.photo_id;
    end if;

    update public.google_photos_import_items
    set status = 'completed',
        aws_key = p_aws_key,
        photo_id = v_photo_id,
        error_message = null,
        updated_at = now()
    where id = p_item_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'completed')::integer,
    count(*) filter (where status = 'failed')::integer
  into v_total, v_completed, v_failed
  from public.google_photos_import_items
  where job_id = v_job_id;

  update public.google_photos_import_jobs
  set total_items = v_total,
      processed_items = v_completed,
      failed_items = v_failed,
      status = case
        when v_total > 0 and v_completed + v_failed >= v_total and v_failed = 0 then 'completed'
        when v_total > 0 and v_completed + v_failed >= v_total then 'completed_with_errors'
        else 'processing'
      end,
      completed_at = case when v_total > 0 and v_completed + v_failed >= v_total then now() else null end,
      updated_at = now()
  where id = v_job_id;

  return true;
end;
$$;

revoke all on function public.finish_google_photos_import_item(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.finish_google_photos_import_item(uuid,text,text,text,text,text,text) to service_role;

commit;
