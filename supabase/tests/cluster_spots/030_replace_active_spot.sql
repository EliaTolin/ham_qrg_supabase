-- =========================================================
-- Test 030: replace active spot (SC-006 atomicity)
-- Feature: 001-cluster-spots / US1
-- =========================================================

BEGIN;

-- Fixture
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'test_replace@test.com',
        '{"first_name":"Test","last_name":"Replace"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test', 'Replace', 'IZ0REP')
ON CONFLICT (id) DO UPDATE SET callsign = 'IZ0REP';

INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Repeater A', 'IR0AAA', 145600000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Repeater C', 'IR0CCC', 145700000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- Step 1: Create first spot on Repeater A
SELECT public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 30::smallint);

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;
  ASSERT v_count = 1, 'Step 1: Expected 1 active spot, got ' || v_count;
  RAISE NOTICE 'TEST 030 Step 1 PASSED: 1 active spot after first create';
END $$;

-- Step 2: Create second spot on Repeater C → replaces first
SELECT public.create_spot('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 15::smallint);

DO $$
DECLARE
  v_active_count int;
  v_closed_count int;
  v_total        int;
  v_active_row   public.repeater_spots%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  ASSERT v_total = 2, 'Step 2: Expected 2 total spots, got ' || v_total;

  SELECT count(*) INTO v_active_count
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;
  ASSERT v_active_count = 1, 'Step 2: Expected 1 active spot, got ' || v_active_count;

  SELECT count(*) INTO v_closed_count
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NOT NULL;
  ASSERT v_closed_count = 1, 'Step 2: Expected 1 closed spot, got ' || v_closed_count;

  SELECT * INTO v_active_row
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;
  ASSERT v_active_row.repeater_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Step 2: Active spot should be on Repeater C';
  ASSERT v_active_row.duration_minutes = 15,
    'Step 2: Active spot should have duration 15';

  RAISE NOTICE 'TEST 030 Step 2 PASSED: replacement is atomic, 1 active, 1 closed';
END $$;

ROLLBACK;
