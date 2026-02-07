-- =========================================================
-- RPC function: search_repeaters
--
-- Full-text + fuzzy search (pg_trgm) across repeater fields
-- with optional access-mode filtering.
-- Uses the same LATERAL-join pattern as repeaters_nearby /
-- repeaters_in_bounds for consistent accesses structure.
--
-- Fuzzy matching: uses pg_trgm similarity() for ranking and
-- ILIKE for filtering.  Trigram GIN indexes on callsign,
-- name, locality, region, locator, manager accelerate the
-- ILIKE predicates.
-- =========================================================

set search_path to public, extensions;

create or replace function public.search_repeaters(
  p_query text,
  p_limit integer default 100,
  p_access_modes text[] default null,
  p_freq_min_hz bigint default null,
  p_freq_max_hz bigint default null
)
returns table (
  repeater public.repeaters,
  accesses jsonb,
  rank real
)
language plpgsql
stable
as $$
declare
  v_pattern text;
  v_limit_count integer;
  v_query text;
begin
  v_query := trim(p_query);
  if v_query = '' then
    return;
  end if;

  v_pattern := '%' || v_query || '%';
  v_limit_count := greatest(1, least(coalesce(p_limit, 100), 500));

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
      ) as sim_rank
    from public.repeaters r
    where
      -- Text match: ILIKE on multiple columns (uses trgm GIN indexes)
      (
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
      -- Access mode filter
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
    m.sim_rank
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
