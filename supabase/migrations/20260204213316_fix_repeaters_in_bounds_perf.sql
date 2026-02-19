-- =========================================================
-- Fix repeaters_in_bounds timeout on large bounding boxes.
--
-- Root cause: st_makeenvelope() returns geometry, but the
-- geom column is geography(point, 4326).  The && operator
-- between geography and geometry forces PostgreSQL to cast
-- r.geom to geometry at runtime, which cannot use the GIST
-- index on the geography column → sequential scan.
--
-- Fix: cast the envelope to geography so && uses the GIST
-- index directly.  Also drop the redundant st_intersects
-- (for a point-in-rectangle test, && is already exact).
-- Switch accesses aggregation to LATERAL join for better
-- nested-loop index usage.
-- =========================================================

set search_path to public, extensions;

drop function if exists public.repeaters_in_bounds(double precision, double precision, double precision, double precision, text[]);

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
    )::geography as g                              -- cast to geography
  ),
  matched as (
    select r.id as rid, r
    from public.repeaters r, bbox
    where r.geom is not null
      and r.geom && bbox.g                         -- geography && geography → uses GIST index
      and (
        p_access_modes is null
        or exists (
          select 1 from public.repeater_access ra2
          where ra2.repeater_id = r.id
            and upper(ra2.mode::text) = any(select upper(unnest) from unnest(p_access_modes))
        )
      )
  )
  select
    m.r,
    coalesce(acc.accesses, '[]'::jsonb)
  from matched m
  left join lateral (
    select jsonb_agg(
      to_jsonb(ra.*) ||
      case
        when n.id is not null then jsonb_build_object('network', to_jsonb(n.*))
        else '{"network": null}'::jsonb
      end
    ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    where ra.repeater_id = m.rid
  ) acc on true;
$$;


-- =========================================================
-- Also fix repeaters_nearby: switch accesses aggregation to
-- LATERAL join for consistency and better index usage.
-- The spatial part already uses geography correctly.
-- =========================================================

drop function if exists public.repeaters_nearby(double precision, double precision, double precision, integer, text[]);

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
  with matched as (
    select r.id as rid, r, st_distance(r.geom, v_origin) as dist_m
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
  )
  select
    m.r,
    m.dist_m,
    coalesce(acc.accesses, '[]'::jsonb)
  from matched m
  left join lateral (
    select jsonb_agg(
      to_jsonb(ra.*) ||
      case
        when n.id is not null then jsonb_build_object('network', to_jsonb(n.*))
        else '{"network": null}'::jsonb
      end
    ) as accesses
    from public.repeater_access ra
    left join public.networks n on n.id = ra.network_id
    where ra.repeater_id = m.rid
  ) acc on true
  order by m.dist_m;
end;
$$;
