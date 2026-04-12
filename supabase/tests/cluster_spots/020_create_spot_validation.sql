-- =========================================================
-- Test 020: create_spot validation errors
-- Feature: 001-cluster-spots / US1
-- =========================================================

BEGIN;

-- Fixture: user WITHOUT callsign
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('22222222-2222-2222-2222-222222222222', 'test_spot_nocall@test.com',
        '{"first_name":"No","last_name":"Call"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('22222222-2222-2222-2222-222222222222', 'No', 'Call', NULL)
ON CONFLICT (id) DO UPDATE SET callsign = NULL;

-- Fixture: user WITH callsign (for other validations)
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'test_spot_val@test.com',
        '{"first_name":"Test","last_name":"Val"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test', 'Val', 'IZ0TEST')
ON CONFLICT (id) DO UPDATE SET callsign = 'IZ0TEST';

-- Fixture: repeaters + access
INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Repeater A', 'IR0AAA', 145600000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Repeater C', 'IR0CCC', 145700000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.repeater_access (id, repeater_id, mode)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ANALOG')
ON CONFLICT (id) DO NOTHING;

-- (a) CALLSIGN_REQUIRED: user without callsign
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

  PERFORM public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 30::smallint);
  RAISE EXCEPTION 'Expected CALLSIGN_REQUIRED but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'CALLSIGN_REQUIRED' THEN
    RAISE EXCEPTION 'Expected CALLSIGN_REQUIRED, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 020a PASSED: CALLSIGN_REQUIRED';
END $$;

-- (b) INVALID_DURATION: duration = 0
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  PERFORM public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 0::smallint);
  RAISE EXCEPTION 'Expected INVALID_DURATION but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'INVALID_DURATION' THEN
    RAISE EXCEPTION 'Expected INVALID_DURATION, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 020b PASSED: INVALID_DURATION (0)';
END $$;

-- (c) INVALID_DURATION: duration = 601 (max is 600 = 10h)
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  PERFORM public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 601::smallint);
  RAISE EXCEPTION 'Expected INVALID_DURATION but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'INVALID_DURATION' THEN
    RAISE EXCEPTION 'Expected INVALID_DURATION, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 020c PASSED: INVALID_DURATION (601)';
END $$;

-- (d) REPEATER_NOT_FOUND: non-existent UUID
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  PERFORM public.create_spot('deadbeef-dead-dead-dead-deaddeadbeef'::uuid, 30::smallint);
  RAISE EXCEPTION 'Expected REPEATER_NOT_FOUND but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'REPEATER_NOT_FOUND' THEN
    RAISE EXCEPTION 'Expected REPEATER_NOT_FOUND, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 020d PASSED: REPEATER_NOT_FOUND';
END $$;

-- (e) INVALID_ACCESS: access belonging to a different repeater
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  -- bbbb access belongs to repeater aaaa, but we pass repeater cccc
  PERFORM public.create_spot(
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    30::smallint,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
  );
  RAISE EXCEPTION 'Expected INVALID_ACCESS but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'INVALID_ACCESS' THEN
    RAISE EXCEPTION 'Expected INVALID_ACCESS, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 020e PASSED: INVALID_ACCESS';
END $$;

ROLLBACK;
