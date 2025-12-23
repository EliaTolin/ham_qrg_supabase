-- ============================================================
-- Repeater DB (Supabase / Postgres + PostGIS)
-- Dedup A: UNIQUE (callsign, frequency_hz)
-- ============================================================

-- Estensioni
-- PostGIS nello schema extensions (non public) per evitare che le tabelle interne siano esposte via API
create extension if not exists postgis schema extensions;
create extension if not exists pgcrypto;

-- Tipi
do $$ begin
  create type public.repeater_mode as enum (
    'FM', 'C4FM', 'DSTAR', 'DMR', 'ALLMODE', 'Echolink', 'Winlink', 'Other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.repeater_status as enum ('active','inactive','unknown');
exception when duplicate_object then null; end $$;

-- Tabella
create table if not exists public.repeaters (
  id uuid primary key default gen_random_uuid(),

  -- Identità
  name text null,
  callsign text null,
  node_number integer null,
  manager_callsign text null,

  -- Tecnica
  frequency_hz bigint not null,
  shift_hz integer null,
  shift_raw text null,
  tone_raw text null,
  ctcss_hz numeric(6,1) null,
  mode public.repeater_mode not null default 'Other',
  network text null,
  status public.repeater_status not null default 'unknown',

  -- Localizzazione
  region text null,
  province_code text null,
  locality text null,
  locator text null,
  lat double precision null,
  lon double precision null,
  geom geography(point, 4326) null,

  -- Metadati
  source text null default 'import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indici
create index if not exists repeaters_geom_gix on public.repeaters using gist (geom);
create index if not exists repeaters_freq_idx on public.repeaters (frequency_hz);
create index if not exists repeaters_region_idx on public.repeaters (region);
create index if not exists repeaters_province_idx on public.repeaters (province_code);
create index if not exists repeaters_mode_idx on public.repeaters (mode);
create index if not exists repeaters_callsign_idx on public.repeaters (callsign);
create index if not exists repeaters_locator_idx on public.repeaters (locator);

-- Unicità (A)
create unique index if not exists repeaters_callsign_freq_uq
on public.repeaters (callsign, frequency_hz)
where callsign is not null;

-- Check
alter table public.repeaters
add constraint repeaters_frequency_hz_ck
check (frequency_hz > 0);

-- Helper: parse ctcss da tone_raw (se numerico)
create or replace function public.try_parse_ctcss(t text)
returns numeric
language sql
immutable
as $$
  select case
    when trim(coalesce(t,'')) ~ '^[0-9]+([.,][0-9]+)?$'
      then replace(trim(t), ',', '.')::numeric
    else null
  end
$$;

-- Helper: parse shift
create or replace function public.parse_shift_hz(shift_text text)
returns integer
language plpgsql
as $$
declare
  t text := trim(coalesce(shift_text,''));
  sign int := 1;
  num numeric;
begin
  if t = '' or t = '0' then
    return 0;
  end if;

  if left(t,1) = '-' then sign := -1; end if;

  num := nullif(regexp_replace(t, '[^0-9\.,]', '', 'g'), '')::numeric;
  if num is null then
    return null;
  end if;

  if t ilike '%mhz%' then
    return (sign * (num * 1000000))::int;
  elsif t ilike '%khz%' then
    return (sign * (num * 1000))::int;
  else
    return null;
  end if;
end $$;

-- Helper: maidenhead -> point
create or replace function public.maidenhead_to_point(loc text)
returns geography
language plpgsql
as $$
declare
  l text := upper(trim(coalesce(loc,'')));
  lon double precision;
  lat double precision;
  a int; b int; c int; d int;
begin
  if length(l) < 4 then
    return null;
  end if;

  a := ascii(substr(l,1,1)) - ascii('A');
  b := ascii(substr(l,2,1)) - ascii('A');
  c := substr(l,3,1)::int;
  d := substr(l,4,1)::int;

  lon := (a * 20) - 180 + (c * 2) + 1;
  lat := (b * 10) - 90  + (d * 1) + 0.5;

  if length(l) >= 6 then
    lon := lon - 1 + ((ascii(substr(l,5,1)) - ascii('A')) * (5.0/60.0)) + (2.5/60.0);
    lat := lat - 0.5 + ((ascii(substr(l,6,1)) - ascii('A')) * (2.5/60.0)) + (1.25/60.0);
  end if;

  return st_setsrid(st_makepoint(lon, lat), 4326)::geography;
end $$;

-- Trigger function: compila campi derivati
create or replace function public.repeaters_fill_fields()
returns trigger
language plpgsql
as $$
declare
  g geography;
begin
  -- Normalizza callsign
  if new.callsign is not null then
    new.callsign := nullif(upper(trim(new.callsign)), '');
  end if;

  -- CTCSS da tone_raw se manca
  if new.ctcss_hz is null and new.tone_raw is not null then
    new.ctcss_hz := public.try_parse_ctcss(new.tone_raw);
  end if;

  -- shift_hz da shift_raw se manca
  if new.shift_hz is null and new.shift_raw is not null then
    new.shift_hz := public.parse_shift_hz(new.shift_raw);
  end if;

  -- geom da lat/lon o locator
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