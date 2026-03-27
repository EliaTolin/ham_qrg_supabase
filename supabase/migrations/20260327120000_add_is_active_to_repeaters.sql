-- =========================================================
-- Add is_active flag to repeaters for AutoON/ManualON logic.
-- Deactivated repeaters are hidden from mobile app queries
-- but remain visible in the dashboard.
-- =========================================================

ALTER TABLE public.repeaters
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS repeaters_is_active_idx
  ON public.repeaters (is_active);

-- =========================================================
-- Update repeaters_in_bounds: add is_active filter
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
    )::geography as g
  ),
  matched as (
    select r.id as rid, r
    from public.repeaters r, bbox
    where r.geom is not null
      and r.is_active = true
      and r.geom && bbox.g
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
-- Update repeaters_nearby: add is_active filter
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
      and r.is_active = true
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

-- =========================================================
-- Update search_repeaters: add is_active filter
-- =========================================================

drop function if exists public.search_repeaters(text, integer, text[], bigint, bigint, double precision, double precision);

create or replace function public.search_repeaters(
  p_query text,
  p_limit integer default 100,
  p_access_modes text[] default null,
  p_freq_min_hz bigint default null,
  p_freq_max_hz bigint default null,
  p_lat double precision default null,
  p_lon double precision default null
)
returns table (
  repeater public.repeaters,
  accesses jsonb,
  rank real,
  distance_m double precision
)
language plpgsql
stable
as $$
declare
  v_pattern text;
  v_limit_count integer;
  v_query text;
  v_origin geography;
begin
  v_query := trim(p_query);
  if v_query = '' then
    return;
  end if;

  v_pattern := '%' || v_query || '%';
  v_limit_count := greatest(1, least(coalesce(p_limit, 100), 500));

  if p_lat is not null and p_lon is not null then
    v_origin := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
  end if;

  return query
  with matched as (
    select
      r.id as rid,
      r,
      greatest(
        coalesce(similarity(r.callsign, v_query), 0),
        coalesce(similarity(r.name, v_query), 0),
        coalesce(similarity(r.locality, v_query), 0),
        coalesce(similarity(r.region, v_query), 0),
        coalesce(similarity(r.locator, v_query), 0),
        coalesce(similarity(r.manager, v_query), 0)
      ) as sim_rank,
      case
        when v_origin is not null and r.geom is not null
        then st_distance(r.geom, v_origin)
        else null
      end as dist_m
    from public.repeaters r
    where
      r.is_active = true
      and (
        r.callsign ilike v_pattern
        or r.name ilike v_pattern
        or r.locality ilike v_pattern
        or r.region ilike v_pattern
        or r.locator ilike v_pattern
        or r.manager ilike v_pattern
        or (
          p_freq_min_hz is not null
          and p_freq_max_hz is not null
          and r.frequency_hz between p_freq_min_hz and p_freq_max_hz
        )
      )
      and (
        p_access_modes is null
        or exists (
          select 1 from public.repeater_access ra2
          where ra2.repeater_id = r.id
            and upper(ra2.mode::text) = any(select upper(unnest) from unnest(p_access_modes))
        )
      )
    order by sim_rank desc, r.callsign
    limit v_limit_count
  )
  select
    m.r,
    coalesce(acc.accesses, '[]'::jsonb),
    m.sim_rank,
    m.dist_m
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
  order by m.sim_rank desc, (m.r).callsign;
end;
$$;
