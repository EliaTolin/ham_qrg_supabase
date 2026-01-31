-- =========================================================
-- Missing indexes for query performance
-- =========================================================

-- 1) pg_trgm extension for ILIKE '%pattern%' search
create extension if not exists pg_trgm schema extensions;

-- Make pg_trgm operator classes visible without schema prefix
set search_path to public, extensions;

-- 2) user_favorite_repeaters: standalone index on repeater_id
--    The UNIQUE(user_id, repeater_id) has user_id as leading column,
--    so queries/CASCADE deletes by repeater_id alone can't use it.
create index if not exists user_favorite_repeaters_repeater_idx
  on public.user_favorite_repeaters (repeater_id);

-- 3) repeater_feedback: composite (repeater_id, user_id)
--    Used by getMyRepeaterFeedback and getMyRepeaterFeedbacks.
--    Existing indexes cover (repeater_id, created_at) and (user_id, created_at)
--    but not this combination.
create index if not exists repeater_feedback_repeater_user_idx
  on public.repeater_feedback (repeater_id, user_id);

-- 4) profiles: index on callsign (partial, only non-null)
--    Used in join operations from feedback queries.
create index if not exists profiles_callsign_idx
  on public.profiles (callsign)
  where callsign is not null;

-- 5) GIN trigram indexes for ILIKE '%pattern%' on repeaters.
--    btree indexes cannot accelerate leading-wildcard ILIKE.
--    These cover all columns used in searchRepeaters OR filter.
create index if not exists repeaters_callsign_trgm_idx
  on public.repeaters using gin (callsign gin_trgm_ops);

create index if not exists repeaters_name_trgm_idx
  on public.repeaters using gin (name gin_trgm_ops);

create index if not exists repeaters_locality_trgm_idx
  on public.repeaters using gin (locality gin_trgm_ops);

create index if not exists repeaters_region_trgm_idx
  on public.repeaters using gin (region gin_trgm_ops);

create index if not exists repeaters_locator_trgm_idx
  on public.repeaters using gin (locator gin_trgm_ops);

create index if not exists repeaters_manager_trgm_idx
  on public.repeaters using gin (manager gin_trgm_ops);


