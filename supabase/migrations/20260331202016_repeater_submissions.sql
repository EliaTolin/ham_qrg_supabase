-- =========================================================
-- 1) Rimuovi vecchio trigger report (verrà ricreato sotto
--    con la funzione generica per entrambe le tabelle)
-- =========================================================
drop trigger if exists trg_notify_telegram_on_report on public.repeater_reports;
drop function if exists public.notify_telegram_on_report();

-- =========================================================
-- 2) Enum submission_status
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

-- =========================================================
-- 3) Tabella repeater_submissions
-- =========================================================
create table public.repeater_submissions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  name text null,
  callsign text null,

  frequency_hz bigint not null,
  shift_hz bigint null,

  region text null,
  province_code text null,
  locality text null,

  lat double precision null,
  lon double precision null,
  locator text null,

  accesses jsonb not null default '[]'::jsonb,
  notes text null,

  status public.submission_status not null default 'pending'::submission_status,
  created_at timestamptz not null default now(),

  -- Almeno uno tra name e callsign
  constraint repeater_submissions_name_or_callsign_ck
    check (name is not null or callsign is not null),

  constraint repeater_submissions_frequency_hz_ck
    check (frequency_hz > 0),

  constraint repeater_submissions_lat_ck
    check (lat is null or (lat between -90 and 90)),

  constraint repeater_submissions_lon_ck
    check (lon is null or (lon between -180 and 180))
);

-- FK verso profiles
alter table public.repeater_submissions
  add constraint repeater_submissions_user_id_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- =========================================================
-- 4) Indici
-- =========================================================
create index repeater_submissions_user_idx
  on public.repeater_submissions (user_id);

create index repeater_submissions_status_idx
  on public.repeater_submissions (status);

create index repeater_submissions_created_idx
  on public.repeater_submissions (created_at desc);

create index repeater_submissions_status_created_idx
  on public.repeater_submissions (status, created_at desc);

-- =========================================================
-- 5) RLS
-- =========================================================
alter table public.repeater_submissions enable row level security;

-- Utenti autenticati: leggono solo le proprie
create policy "Users can read own submissions"
  on public.repeater_submissions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Chiunque (autenticato o anonimo) può inserire con il proprio user_id
create policy "Anyone can insert own submissions"
  on public.repeater_submissions
  for insert
  to anon, authenticated
  with check (user_id = auth.uid());

-- Admin/bridge_manager: leggono tutte
create policy "Managers can read all submissions"
  on public.repeater_submissions
  for select
  to authenticated
  using (public.authorize('reports.manage'::public.app_permission));

-- Admin/bridge_manager: aggiornano tutte (cambio status)
create policy "Managers can update submissions"
  on public.repeater_submissions
  for update
  to authenticated
  using (public.authorize('reports.manage'::public.app_permission));

-- Admin/bridge_manager: eliminano
create policy "Managers can delete submissions"
  on public.repeater_submissions
  for delete
  to authenticated
  using (public.authorize('reports.manage'::public.app_permission));

-- =========================================================
-- 6) Trigger: notifica Telegram via net.http_post
--    Funzione generica usata da entrambe le tabelle.
--    Simula il payload webhook di Supabase:
--    { "type": "INSERT", "table": "<nome>", "schema": "public", "record": {...} }
-- =========================================================
create or replace function public.notify_telegram_on_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  _url text;
  _key text;
begin
  select decrypted_secret into _url
    from vault.decrypted_secrets
    where name = 'project_url'
    limit 1;

  select decrypted_secret into _key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if _url is null or _key is null then
    raise warning '[notify_telegram_on_insert] Vault secrets not configured, skipping';
    return new;
  end if;

  perform net.http_post(
    url     := _url || '/functions/v1/notify_telegram_report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := jsonb_build_object(
      'type',   TG_OP,
      'table',  TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new)
    )
  );

  return new;
end;
$$;

-- Trigger su repeater_reports
create trigger trg_notify_telegram_on_report
  after insert on public.repeater_reports
  for each row
  execute function public.notify_telegram_on_insert();

-- Trigger su repeater_submissions
create trigger trg_notify_telegram_on_submission
  after insert on public.repeater_submissions
  for each row
  execute function public.notify_telegram_on_insert();
