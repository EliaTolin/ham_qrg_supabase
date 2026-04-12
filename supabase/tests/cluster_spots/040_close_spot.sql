-- =========================================================
-- Test 040: close_spot — owner, forbidden, already_closed, not_found
-- Feature: 001-cluster-spots / US1
-- =========================================================

BEGIN;

-- Fixture: two users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'test_close_owner@test.com',
        '{"first_name":"Owner","last_name":"Test"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('11111111-1111-1111-1111-111111111111', 'Owner', 'Test', 'IZ0OWN')
ON CONFLICT (id) DO UPDATE SET callsign = 'IZ0OWN';

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('33333333-3333-3333-3333-333333333333', 'test_close_other@test.com',
        '{"first_name":"Other","last_name":"User"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, callsign)
VALUES ('33333333-3333-3333-3333-333333333333', 'Other', 'User', 'IZ0OTH')
ON CONFLICT (id) DO UPDATE SET callsign = 'IZ0OTH';

-- Fixture: repeater
INSERT INTO public.repeaters (id, name, callsign, frequency_hz, mode)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Repeater A', 'IR0AAA', 145600000, 'Mixed')
ON CONFLICT (id) DO NOTHING;

-- Create spot as owner
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

SELECT public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 30::smallint);

-- (a) Owner closes own spot → success
DO $$
DECLARE
  v_spot_id uuid;
  v_row     public.repeater_spots%ROWTYPE;
BEGIN
  SELECT id INTO v_spot_id
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;

  SELECT * INTO v_row FROM public.close_spot(v_spot_id);

  ASSERT v_row.closed_at IS NOT NULL, 'closed_at should be set';
  ASSERT v_row.closed_by = '11111111-1111-1111-1111-111111111111',
    'closed_by should be the owner';
  RAISE NOTICE 'TEST 040a PASSED: owner closes own spot';
END $$;

-- Create another spot for further tests
SELECT public.create_spot('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 30::smallint);

-- (b) Different user tries to close → FORBIDDEN
DO $$
DECLARE
  v_spot_id uuid;
BEGIN
  SELECT id INTO v_spot_id
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;

  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

  PERFORM public.close_spot(v_spot_id);
  RAISE EXCEPTION 'Expected FORBIDDEN but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'FORBIDDEN' THEN
    RAISE EXCEPTION 'Expected FORBIDDEN, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 040b PASSED: FORBIDDEN for non-owner';
END $$;

-- (c) Owner closes again → first close the spot
DO $$
DECLARE
  v_spot_id uuid;
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  SELECT id INTO v_spot_id
    FROM public.repeater_spots
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
     AND closed_at IS NULL;

  -- First close (should succeed)
  PERFORM public.close_spot(v_spot_id);

  -- Second close (should fail with ALREADY_CLOSED)
  PERFORM public.close_spot(v_spot_id);
  RAISE EXCEPTION 'Expected ALREADY_CLOSED but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'ALREADY_CLOSED' THEN
    RAISE EXCEPTION 'Expected ALREADY_CLOSED, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 040c PASSED: ALREADY_CLOSED';
END $$;

-- (d) SPOT_NOT_FOUND
DO $$
BEGIN
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  PERFORM public.close_spot('00000000-0000-0000-0000-000000000000'::uuid);
  RAISE EXCEPTION 'Expected SPOT_NOT_FOUND but no exception was raised';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'SPOT_NOT_FOUND' THEN
    RAISE EXCEPTION 'Expected SPOT_NOT_FOUND, got: %', SQLERRM;
  END IF;
  RAISE NOTICE 'TEST 040d PASSED: SPOT_NOT_FOUND';
END $$;

ROLLBACK;
