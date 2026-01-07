-- Ricrea funzioni con p_access_modes e SETOF repeaters

-- Drop tutte le versioni esistenti
drop function if exists public.repeaters_nearby(double precision, double precision, double precision, public.repeater_mode[]);
drop function if exists public.repeaters_nearby(double precision, double precision, double precision, integer, public.repeater_mode[]);
drop function if exists public.repeaters_in_bounds(double precision, double precision, double precision, double precision, public.repeater_mode[]);


-- =========================================================
-- repeaters_in_bounds - SETOF repeaters (dinamica)
-- Filtra per access_mode (es. DMR, C4FM, ANALOG, ecc.)
-- =========================================================
create or replace function public.repeaters_in_bounds(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision,
  p_access_modes public.access_mode[] default null
)
returns setof public.repeaters
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
  )
  select distinct r.*
  from public.repeaters r
  cross join bbox
  where r.geom is not null
    and r.geom && bbox.g
    and st_intersects(r.geom::geometry, bbox.g)
    and (
      p_access_modes is null
      or exists (
        select 1 from public.repeater_access ra
        where ra.repeater_id = r.id
          and ra.mode = any(p_access_modes)
      )
    );
$$;


-- =========================================================
-- repeaters_nearby - (repeater record, distance_m) dinamica
-- Filtra per access_mode (es. DMR, C4FM, ANALOG, ecc.)
-- =========================================================
create or replace function public.repeaters_nearby(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision default 50,
  p_limit integer default 50,
  p_access_modes public.access_mode[] default null
)
returns table (
  repeater public.repeaters,
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
  select distinct
    r,
    st_distance(r.geom, v_origin) as distance_m
  from public.repeaters r
  where r.geom is not null
    and st_dwithin(r.geom, v_origin, v_radius_km * 1000)
    and (
      p_access_modes is null
      or exists (
        select 1 from public.repeater_access ra
        where ra.repeater_id = r.id
          and ra.mode = any(p_access_modes)
      )
    )
  order by distance_m
  limit v_limit_count;
end;
$$;
