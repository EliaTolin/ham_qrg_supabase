-- Ricrea le funzioni repeaters_nearby e repeaters_in_bounds
-- adattate alla nuova struttura delle tabelle (repeaters + repeater_access + networks)

-- Drop vecchie versioni
drop function if exists public.repeaters_nearby(double precision, double precision, double precision, public.repeater_mode[]);
drop function if exists public.repeaters_nearby(double precision, double precision, double precision, integer, public.repeater_mode[]);
drop function if exists public.repeaters_in_bounds(double precision, double precision, double precision, double precision, public.repeater_mode[]);


-- =========================================================
-- repeaters_in_bounds
-- =========================================================
create or replace function public.repeaters_in_bounds(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision,
  p_modes public.repeater_mode[] default null
)
returns table (
  id uuid,
  name text,
  callsign text,
  manager text,
  frequency_hz bigint,
  shift_hz bigint,
  shift_raw text,
  mode public.repeater_mode,
  region text,
  province_code text,
  locality text,
  locator text,
  lat double precision,
  lon double precision,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  accesses jsonb
)
language sql
stable
as $$
  with bbox as (
    select st_makeenvelope(
      least(p_lon1, p_lon2),
      least(p_lat1, p_lat2),
      greatest(p_lon1, p_lon2),
      greatest(p_lat1, p_lat2),
      4326
    ) as g
  ),
  repeater_accesses as (
    select
      ra.repeater_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ra.id,
          'mode', ra.mode,
          'ctcss_hz', ra.ctcss_hz,
          'dcs_code', ra.dcs_code,
          'tone_scope', ra.tone_scope,
          'tone_direction', ra.tone_direction,
          'color_code', ra.color_code,
          'dmr_id', ra.dmr_id,
          'dg_id', ra.dg_id,
          'network', n.name,
          'network_kind', n.kind,
          'notes', ra.notes
        )
      ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    group by ra.repeater_id
  )
  select
    r.id,
    r.name,
    r.callsign,
    r.manager,
    r.frequency_hz,
    r.shift_hz,
    r.shift_raw,
    r.mode,
    r.region,
    r.province_code,
    r.locality,
    r.locator,
    r.lat,
    r.lon,
    r.source,
    r.created_at,
    r.updated_at,
    coalesce(ra.accesses, '[]'::jsonb) as accesses
  from public.repeaters r
  cross join bbox
  left join repeater_accesses ra on ra.repeater_id = r.id
  where r.geom is not null
    and r.geom && bbox.g
    and st_intersects(r.geom::geometry, bbox.g)
    and (p_modes is null or r.mode = any(p_modes));
$$;


-- =========================================================
-- repeaters_nearby
-- =========================================================
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
  manager text,
  frequency_hz bigint,
  shift_hz bigint,
  shift_raw text,
  mode public.repeater_mode,
  region text,
  province_code text,
  locality text,
  locator text,
  lat double precision,
  lon double precision,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision,
  accesses jsonb
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
  with repeater_accesses as (
    select
      ra.repeater_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ra.id,
          'mode', ra.mode,
          'ctcss_hz', ra.ctcss_hz,
          'dcs_code', ra.dcs_code,
          'tone_scope', ra.tone_scope,
          'tone_direction', ra.tone_direction,
          'color_code', ra.color_code,
          'dmr_id', ra.dmr_id,
          'dg_id', ra.dg_id,
          'network', n.name,
          'network_kind', n.kind,
          'notes', ra.notes
        )
      ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    group by ra.repeater_id
  )
  select
    r.id,
    r.name,
    r.callsign,
    r.manager,
    r.frequency_hz,
    r.shift_hz,
    r.shift_raw,
    r.mode,
    r.region,
    r.province_code,
    r.locality,
    r.locator,
    r.lat,
    r.lon,
    r.source,
    r.created_at,
    r.updated_at,
    st_distance(r.geom, v_origin) as distance_m,
    coalesce(ra.accesses, '[]'::jsonb) as accesses
  from public.repeaters r
  left join repeater_accesses ra on ra.repeater_id = r.id
  where r.geom is not null
    and st_dwithin(r.geom, v_origin, v_radius_km * 1000)
    and (p_modes is null or r.mode = any(p_modes))
  order by distance_m
  limit v_limit_count;
end;
$$;
