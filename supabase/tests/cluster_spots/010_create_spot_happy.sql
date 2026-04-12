-- =========================================================
-- Test 010: create_spot happy path
-- Feature: 001-cluster-spots / US1
-- =========================================================

BEGIN;

-- Fixture: create a test user with callsign
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'test_spot_happy@test.com',
        '{"first_name":"Test","last_name":"Happy"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test', 'Happy', 'IZ0TEST')
ON CONFLICT (id) DO UPDATE SET callsign = 'IZ0TEST';

-- Fixture: create a test repeater
INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Repeater', 'IR0TEST', 145600000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

-- Fixture: create a test access for that repeater
INSERT INTO public.repeater_access (id, repeater_id, mode)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ANALOG')
ON CONFLICT (id) DO NOTHING;

-- Act: set role and create spot
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

SELECT public.create_spot(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  30::smallint,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
);

-- Assert: spot exists and is active
DO $$
DECLARE
  v_count int;
  v_row   public.repeater_spots%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;
  ASSERT v_count = 1, 'Expected exactly 1 active spot, got ' || v_count;

  SELECT * INTO v_row
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;

  ASSERT v_row.repeater_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Unexpected repeater_id';
  ASSERT v_row.access_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Unexpected access_id';
  ASSERT v_row.duration_minutes = 30,
    'Unexpected duration_minutes';
  ASSERT v_row.callsign_snapshot = 'IZ0TEST',
    'Unexpected callsign_snapshot: ' || coalesce(v_row.callsign_snapshot, 'NULL');
  ASSERT v_row.expires_at = v_row.started_at + interval '30 minutes',
    'expires_at mismatch';
  ASSERT v_row.closed_at IS NULL,
    'Spot should not be closed';

  RAISE NOTICE 'TEST 010 PASSED: create_spot happy path';
END $$;

ROLLBACK;
