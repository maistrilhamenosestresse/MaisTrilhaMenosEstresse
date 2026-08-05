begin;

alter table public.google_photos_import_jobs
  alter column access_token_ciphertext drop not null;

commit;
