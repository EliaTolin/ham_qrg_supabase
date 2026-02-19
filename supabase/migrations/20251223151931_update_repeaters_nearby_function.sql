-- Fix: aggiorna repeaters_nearby per elencare esplicitamente tutti i campi
-- (LIKE public.repeaters non funziona correttamente con PostgREST)
drop function if exists public.repeaters_nearby(double precision, double precision, double precision, integer, public.repeater_mode[]);

create or replace function public.repeaters_nearby(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision default 50,
  p_limit integer default 50,
  p_modes public.repeater_mode[] default null
)
returns table (
  id uuid,
  name text,
  callsign text,
  node_number integer,
  manager_callsign text,
  frequency_hz bigint,
  shift_hz bigint,
  shift_raw text,
  tone_raw text,
  ctcss_hz numeric(6,1),
  mode public.repeater_mode,
  network text,
  status public.repeater_status,
  region text,
  province_code text,
  locality text,
  locator text,
  lat double precision,
  lon double precision,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision
)
language plpgsql
stable
as $$
declare
  v_radius_km double precision;
  v_limit_count integer;
  v_origin geography;
begin
  v_radius_km := greatest(0::double precision, coalesce(p_radius_km, 50));
  v_limit_count := greatest(1, least(coalesce(p_limit, 50), 500));
  v_origin := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;

  return query
  select
    r.id,
    r.name,
    r.callsign,
    r.node_number,
    r.manager_callsign,
    r.frequency_hz,
    r.shift_hz,
    r.shift_raw,
    r.tone_raw,
    r.ctcss_hz,
    r.mode,
    r.network,
    r.status,
    r.region,
    r.province_code,
    r.locality,
    r.locator,
    r.lat,
    r.lon,
    r.source,
    r.created_at,
    r.updated_at,
    st_distance(r.geom, v_origin) as distance_m
  from public.repeaters r
  where r.geom is not null
    and st_dwithin(r.geom, v_origin, v_radius_km * 1000)
    and (p_modes is null or r.mode = any(p_modes))
  order by distance_m
  limit v_limit_count;
end;
$$;

