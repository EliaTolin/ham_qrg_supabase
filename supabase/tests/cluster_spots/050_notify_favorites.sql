-- =========================================================
-- Test 050: notify_favorites_on_spot trigger — 5 sub-scenarios
-- Feature: 001-cluster-spots / US4
-- =========================================================

BEGIN;

-- =========================================================
-- Fixtures
-- =========================================================

-- User A: will have ponte X as favorite (notification target)
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111', 'user_a_notify@test.com',
        '{"first_name":"User","last_name":"A"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign, cluster_notifications_enabled)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111', 'User', 'A', 'IZ0AAA', true)
ON CONFLICT (id) DO UPDATE
  SET callsign = 'IZ0AAA', cluster_notifications_enabled = true;

-- User B: spotter (creates the spot)
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'user_b_notify@test.com',
        '{"first_name":"User","last_name":"B"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign, cluster_notifications_enabled)
VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'User', 'B', 'IZ0BBB', true)
ON CONFLICT (id) DO UPDATE
  SET callsign = 'IZ0BBB', cluster_notifications_enabled = true;

-- Repeater X (the one with favorites)
INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'Repeater X', 'IR0XXX', 145600000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

-- Repeater Y (no favorites)
INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy', 'Repeater Y', 'IR0YYY', 145700000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

-- Clean up any pre-existing test data
DELETE FROM public.user_notifications
WHERE user_id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'bbbbbbbb-2222-2222-2222-222222222222'
);
DELETE FROM public.repeater_spots
WHERE user_id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'bbbbbbbb-2222-2222-2222-222222222222'
);
DELETE FROM public.user_favorite_repeaters
WHERE user_id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'bbbbbbbb-2222-2222-2222-222222222222'
);

-- =========================================================
-- Sub-scenario 1: Happy path
-- A has X as favorite (both flags true), B creates spot on X
-- → 1 notification for A
-- =========================================================

INSERT INTO public.user_favorite_repeaters (user_id, repeater_id, cluster_notifications_enabled)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true);

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222"}';

SELECT public.create_spot('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 10::smallint);

DO $$
DECLARE
  v_count int;
  v_data  jsonb;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_notifications
   WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
     AND data->>'type' = 'new_cluster_spot';
  ASSERT v_count = 1, 'Sub-1: Expected 1 notification for A, got ' || v_count;

  SELECT data INTO v_data
    FROM public.user_notifications
   WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
     AND data->>'type' = 'new_cluster_spot'
   LIMIT 1;
  ASSERT v_data->>'repeater_id' = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    'Sub-1: repeater_id mismatch in notification data';

  RAISE NOTICE 'TEST 050 Sub-1 PASSED: happy path notification';
END $$;

-- Clean up for next sub-scenario
DELETE FROM public.user_notifications WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111';
-- Close B's spot so they can create a new one in subsequent tests
DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.repeater_spots
  WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222' AND closed_at IS NULL;
  IF v_sid IS NOT NULL THEN
    UPDATE public.repeater_spots SET closed_at = now(), closed_by = 'bbbbbbbb-2222-2222-2222-222222222222' WHERE id = v_sid;
  END IF;
END $$;

-- =========================================================
-- Sub-scenario 2: Global opt-out
-- A has cluster_notifications_enabled = false on profiles
-- → 0 notifications for A
-- =========================================================

UPDATE public.profiles SET cluster_notifications_enabled = false
WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111';

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222"}';

SELECT public.create_spot('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 10::smallint);

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_notifications
   WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
     AND data->>'type' = 'new_cluster_spot';
  ASSERT v_count = 0, 'Sub-2: Expected 0 notifications (global opt-out), got ' || v_count;
  RAISE NOTICE 'TEST 050 Sub-2 PASSED: global opt-out respected';
END $$;

-- Restore global flag + close B's spot
UPDATE public.profiles SET cluster_notifications_enabled = true
WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111';
DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.repeater_spots
  WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222' AND closed_at IS NULL;
  IF v_sid IS NOT NULL THEN
    UPDATE public.repeater_spots SET closed_at = now(), closed_by = 'bbbbbbbb-2222-2222-2222-222222222222' WHERE id = v_sid;
  END IF;
END $$;

-- =========================================================
-- Sub-scenario 3: Per-favorite opt-out
-- A has global = true, but per-favorite = false for X
-- → 0 notifications for A
-- =========================================================

UPDATE public.user_favorite_repeaters
SET cluster_notifications_enabled = false
WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
  AND repeater_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222"}';

SELECT public.create_spot('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 10::smallint);

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_notifications
   WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
     AND data->>'type' = 'new_cluster_spot';
  ASSERT v_count = 0, 'Sub-3: Expected 0 notifications (per-fav opt-out), got ' || v_count;
  RAISE NOTICE 'TEST 050 Sub-3 PASSED: per-favorite opt-out respected';
END $$;

-- Restore per-favorite + close B's spot
UPDATE public.user_favorite_repeaters
SET cluster_notifications_enabled = true
WHERE user_id = 'aaaaaaaa-1111-1111-1111-111111111111'
  AND repeater_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.repeater_spots
  WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222' AND closed_at IS NULL;
  IF v_sid IS NOT NULL THEN
    UPDATE public.repeater_spots SET closed_at = now(), closed_by = 'bbbbbbbb-2222-2222-2222-222222222222' WHERE id = v_sid;
  END IF;
END $$;

-- =========================================================
-- Sub-scenario 4: Author exclusion (SC-008)
-- B has X as favorite with both flags true, B creates spot
-- → 0 notifications for B (self)
-- =========================================================

INSERT INTO public.user_favorite_repeaters (user_id, repeater_id, cluster_notifications_enabled)
VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true)
ON CONFLICT (user_id, repeater_id) DO NOTHING;

DELETE FROM public.user_notifications WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222';

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222"}';

SELECT public.create_spot('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 10::smallint);

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_notifications
   WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222'
     AND data->>'type' = 'new_cluster_spot';
  ASSERT v_count = 0, 'Sub-4: Expected 0 self-notifications for B, got ' || v_count;
  RAISE NOTICE 'TEST 050 Sub-4 PASSED: author exclusion (SC-008)';
END $$;

DO $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.repeater_spots
  WHERE user_id = 'bbbbbbbb-2222-2222-2222-222222222222' AND closed_at IS NULL;
  IF v_sid IS NOT NULL THEN
    UPDATE public.repeater_spots SET closed_at = now(), closed_by = 'bbbbbbbb-2222-2222-2222-222222222222' WHERE id = v_sid;
  END IF;
END $$;

-- =========================================================
-- Sub-scenario 5: No favorites case
-- Repeater Y has zero favorites → spot succeeds, 0 notifications
-- =========================================================

DELETE FROM public.user_notifications
WHERE data->>'type' = 'new_cluster_spot';

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222"}';

SELECT public.create_spot('yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'::uuid, 10::smallint);

DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_notifications
   WHERE data->>'type' = 'new_cluster_spot';
  ASSERT v_count = 0, 'Sub-5: Expected 0 notifications for unfavorited repeater, got ' || v_count;
  RAISE NOTICE 'TEST 050 Sub-5 PASSED: no favorites = no notifications';
END $$;

ROLLBACK;
