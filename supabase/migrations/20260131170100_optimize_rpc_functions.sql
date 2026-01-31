-- =========================================================
-- Optimize repeaters_in_bounds and repeaters_nearby:
-- Move spatial filter BEFORE accesses aggregation.
-- The old CTE aggregated ALL accesses for ALL repeaters,
-- then joined with the spatial filter — full table scan.
-- Now: first find matching repeaters (GIST index), then
-- aggregate accesses only for those.
-- =========================================================

-- Make PostGIS and pg_trgm functions visible
set search_path to public, extensions;

drop function if exists public.repeaters_nearby(double precision, double precision, double precision, integer, text[]);
drop function if exists public.repeaters_in_bounds(double precision, double precision, double precision, double precision, text[]);


-- =========================================================
-- repeaters_in_bounds (optimized)
-- =========================================================
create or replace function public.repeaters_in_bounds(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision,
  p_access_modes text[] default null
)
returns table (
  repeater public.repeaters,
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
  -- Step 1: find spatially matched repeaters (uses GIST index)
  matched as (
    select r
    from public.repeaters r
    cross join bbox
    where r.geom is not null
      and r.geom && bbox.g
      and st_intersects(r.geom::geometry, bbox.g)
      and (
        p_access_modes is null
        or exists (
          select 1 from public.repeater_access ra2
          where ra2.repeater_id = r.id
            and upper(ra2.mode::text) = any(select upper(unnest) from unnest(p_access_modes))
        )
      )
  ),
  -- Step 2: aggregate accesses ONLY for matched repeaters
  repeater_accesses as (
    select
      ra.repeater_id,
      jsonb_agg(
        to_jsonb(ra.*) ||
        case
          when n.id is not null then jsonb_build_object('network', to_jsonb(n.*))
          else '{"network": null}'::jsonb
        end
      ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    where ra.repeater_id in (select (m.r).id from matched m)
    group by ra.repeater_id
  )
  select
    m.r,
    coalesce(ra.accesses, '[]'::jsonb) as accesses
  from matched m
  left join repeater_accesses ra on ra.repeater_id = (m.r).id;
$$;


-- =========================================================
-- repeaters_nearby (optimized)
-- =========================================================
create or replace function public.repeaters_nearby(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision default 50,
  p_limit integer default 50,
  p_access_modes text[] default null
)
returns table (
  repeater public.repeaters,
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
  -- Step 1: find nearby repeaters with distance (uses GIST index + LIMIT)
  with matched as (
    select r, st_distance(r.geom, v_origin) as dist_m
    from public.repeaters r
    where r.geom is not null
      and st_dwithin(r.geom, v_origin, v_radius_km * 1000)
      and (
        p_access_modes is null
        or exists (
          select 1 from public.repeater_access ra2
          where ra2.repeater_id = r.id
            and upper(ra2.mode::text) = any(select upper(unnest) from unnest(p_access_modes))
        )
      )
    order by dist_m
    limit v_limit_count
  ),
  -- Step 2: aggregate accesses ONLY for the matched repeaters
  repeater_accesses as (
    select
      ra.repeater_id,
      jsonb_agg(
        to_jsonb(ra.*) ||
        case
          when n.id is not null then jsonb_build_object('network', to_jsonb(n.*))
          else '{"network": null}'::jsonb
        end
      ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    where ra.repeater_id in (select (m.r).id from matched m)
    group by ra.repeater_id
  )
  select
    m.r,
    m.dist_m,
    coalesce(ra.accesses, '[]'::jsonb)
  from matched m
  left join repeater_accesses ra on ra.repeater_id = (m.r).id
  order by m.dist_m;
end;
$$;

ALTER TABLE public.repeaters
DROP COLUMN mode;
DROP TYPE public.repeater_mode;

ALTER TYPE public.access_mode
ADD VALUE 'NXDN';