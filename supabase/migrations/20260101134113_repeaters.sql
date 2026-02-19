begin;

-- =========================================================
-- 0) Extensions
-- =========================================================
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- =========================================================
-- 1) DROP (clean slate)
-- =========================================================
drop view if exists public.v_repeater_feedback_stats;

drop table if exists public.repeater_feedback cascade;
drop table if exists public.repeater_access cascade;
drop table if exists public.networks cascade;
drop table if exists public.repeaters cascade;

drop type if exists public.feedback_type;
drop type if exists public.station_kind;
drop type if exists public.network_kind;
drop type if exists public.tone_direction;
drop type if exists public.tone_scope;
drop type if exists public.access_mode;

-- DO NOT DROP repeater_mode (functions depend on it)
-- drop type if exists public.repeater_mode;

-- =========================================================
-- 2) Enums
-- =========================================================
do $$
begin
  -- Create repeater_mode only if missing (but we do NOT add new values here)
  if not exists (select 1 from pg_type where typname = 'repeater_mode') then
    create type public.repeater_mode as enum ('Analog','Digital','Mixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'access_mode') then
    create type public.access_mode as enum (
      'ANALOG',
      'DMR',
      'C4FM',
      'DSTAR',
      'ECHOLINK',
      'SVX',
      'APRS',
      'BEACON',
      'ATV'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'tone_scope') then
    create type public.tone_scope as enum ('local', 'network', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'tone_direction') then
    create type public.tone_direction as enum ('tx', 'rx', 'both', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'network_kind') then
    create type public.network_kind as enum ('dmr', 'c4fm', 'dstar', 'voip', 'mixed', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'station_kind') then
    create type public.station_kind as enum ('portable', 'mobile', 'fixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type public.feedback_type as enum ('like', 'down');
  end if;
end$$;

-- =========================================================
-- 3) Repeaters
-- =========================================================
create table public.repeaters (
  id uuid not null default gen_random_uuid(),

  name text null,
  callsign text null,
  manager text null,

  frequency_hz bigint not null,
  shift_hz bigint null,
  shift_raw text null,

  -- IMPORTANT: use an enum value that definitely exists now
  mode public.repeater_mode not null default 'Analog'::repeater_mode,

  region text null,
  province_code text null,
  locality text null,
  locator text null,

  lat double precision null,
  lon double precision null,

  source text not null default 'import'::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  geom geography(point, 4326) generated always as (
    case
      when lat is null or lon is null then null
      else ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
    end
  ) stored,

  constraint repeaters_pkey primary key (id),
  constraint repeaters_frequency_hz_ck check (frequency_hz > 0),
  constraint repeaters_lat_ck check (lat is null or (lat between -90 and 90)),
  constraint repeaters_lon_ck check (lon is null or (lon between -180 and 180))
);

create index repeaters_freq_idx on public.repeaters using btree (frequency_hz);
create index repeaters_region_idx on public.repeaters using btree (region);
create index repeaters_province_idx on public.repeaters using btree (province_code);
create index repeaters_callsign_idx on public.repeaters using btree (callsign);
create index repeaters_manager_idx on public.repeaters using btree (manager);
create index repeaters_locator_idx on public.repeaters using btree (locator);
create index repeaters_mode_idx on public.repeaters using btree (mode);
create index repeaters_geom_gix on public.repeaters using gist (geom);

create unique index repeaters_frequency_locator_unique
on public.repeaters (frequency_hz, locator)
where locator is not null and length(trim(locator)) > 0;

-- =========================================================
-- 4) Networks
-- =========================================================
create table public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.network_kind not null default 'other'::network_kind,
  parent_network_id uuid null references public.networks(id) on delete set null,
  website text null,
  notes text null,
  created_at timestamptz not null default now()
);

create unique index networks_name_unique on public.networks (name);
create index networks_parent_idx on public.networks (parent_network_id);
create index networks_kind_idx on public.networks (kind);

-- =========================================================
-- 5) Repeater access
-- =========================================================
create table public.repeater_access (
  id uuid primary key default gen_random_uuid(),

  repeater_id uuid not null references public.repeaters(id) on delete cascade,
  network_id uuid null references public.networks(id) on delete set null,

  mode public.access_mode not null,

  ctcss_hz numeric(6,1) null,
  dcs_code integer null,
  tone_scope public.tone_scope not null default 'unknown'::tone_scope,
  tone_direction public.tone_direction not null default 'unknown'::tone_direction,

  color_code smallint null,
  dmr_id bigint null,
  dg_id smallint null,

  notes text null,
  source text not null default 'import'::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint repeater_access_ctcss_ck check (ctcss_hz is null or (ctcss_hz >= 0 and ctcss_hz <= 300)),
  constraint repeater_access_dcs_ck check (dcs_code is null or (dcs_code >= 0 and dcs_code <= 999)),
  constraint repeater_access_cc_ck check (color_code is null or (color_code >= 0 and color_code <= 15)),
  constraint repeater_access_dgid_ck check (dg_id is null or (dg_id >= 0 and dg_id <= 99))
);

create index repeater_access_repeater_idx on public.repeater_access (repeater_id);
create index repeater_access_mode_idx on public.repeater_access (mode);
create index repeater_access_network_idx on public.repeater_access (network_id);
create index repeater_access_mode_network_idx on public.repeater_access (mode, network_id);
create index repeater_access_ctcss_idx on public.repeater_access (ctcss_hz);
create index repeater_access_dcs_idx on public.repeater_access (dcs_code);
create index repeater_access_color_code_idx on public.repeater_access (color_code);
create index repeater_access_dg_id_idx on public.repeater_access (dg_id);
create index repeater_access_repeater_mode_idx on public.repeater_access (repeater_id, mode);

create unique index repeater_access_dedup_unique
on public.repeater_access (
  repeater_id,
  mode,
  coalesce(network_id::text,''),
  coalesce(ctcss_hz::text,''),
  coalesce(dcs_code::text,''),
  coalesce(color_code::text,''),
  coalesce(dmr_id::text,''),
  coalesce(dg_id::text,'')
);

-- =========================================================
-- 6) Feedback + stats view
-- =========================================================
create table public.repeater_feedback (
  id uuid primary key default gen_random_uuid(),

  repeater_id uuid not null references public.repeaters(id) on delete cascade,
  user_id uuid not null,

  type public.feedback_type not null,
  station public.station_kind not null,

  lat double precision not null,
  lon double precision not null,

  geom geography(point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,

  comment text not null,
  created_at timestamptz not null default now(),

  constraint repeater_feedback_lat_ck check (lat between -90 and 90),
  constraint repeater_feedback_lon_ck check (lon between -180 and 180),
  constraint repeater_feedback_comment_ck check (length(trim(comment)) >= 3)
);

create unique index repeater_feedback_one_per_user
  on public.repeater_feedback (repeater_id, user_id);

create index repeater_feedback_repeater_created_idx
  on public.repeater_feedback (repeater_id, created_at desc);

create index repeater_feedback_repeater_type_created_idx
  on public.repeater_feedback (repeater_id, type, created_at desc);

create index repeater_feedback_type_idx
  on public.repeater_feedback (type);

create index repeater_feedback_user_created_idx
  on public.repeater_feedback (user_id, created_at desc);

create index repeater_feedback_geom_gix
  on public.repeater_feedback using gist (geom);

create or replace view public.v_repeater_feedback_stats with (security_invoker = on) as
select
  rf.repeater_id,
  count(*) filter (where rf.type = 'like')::int as likes_total,
  count(*) filter (where rf.type = 'down')::int as down_total,
  max(rf.created_at) filter (where rf.type = 'like') as last_like_at,
  max(rf.created_at) filter (where rf.type = 'down') as last_down_at
from public.repeater_feedback rf
group by rf.repeater_id;

-- =========================================================
-- 7) RLS (ONLY authenticated can read)
-- =========================================================

-- REPEATERS
alter table public.repeaters enable row level security;
create policy "Authenticated can read repeaters"
on public.repeaters
for select
to authenticated
using (true);

-- NETWORKS
alter table public.networks enable row level security;
create policy "Authenticated can read networks"
on public.networks
for select
to authenticated
using (true);

-- REPEATER_ACCESS
alter table public.repeater_access enable row level security;
create policy "Authenticated can read repeater access"
on public.repeater_access
for select
to authenticated
using (true);

-- FEEDBACK
alter table public.repeater_feedback enable row level security;

drop policy if exists "Authenticated can read all feedback" on public.repeater_feedback;
drop policy if exists "Users can insert own feedback" on public.repeater_feedback;
drop policy if exists "Users can delete own feedback" on public.repeater_feedback;
drop policy if exists "Users can update own feedback" on public.repeater_feedback;

create policy "Authenticated can read all feedback"
on public.repeater_feedback
for select
to authenticated
using (true);

create policy "Users can insert own feedback"
on public.repeater_feedback
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can delete own feedback"
on public.repeater_feedback
for delete
to authenticated
using (user_id = auth.uid());

create policy "Users can update own feedback"
on public.repeater_feedback
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());


-- Trigger function: compila campi derivati
create or replace function public.repeaters_fill_fields()
returns trigger
language plpgsql
as $$
declare
  g geography;
begin
  if new.lat is not null and new.lon is not null then
    new.geom := st_setsrid(st_makepoint(new.lon, new.lat), 4326)::geography;
  elsif new.locator is not null then
    g := public.maidenhead_to_point(new.locator);
    new.geom := g;
    if g is not null then
      new.lon := st_x(g::geometry);
      new.lat := st_y(g::geometry);
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_repeaters_fill_fields on public.repeaters;
create trigger trg_repeaters_fill_fields
before insert or update on public.repeaters
for each row execute function public.repeaters_fill_fields();


commit;