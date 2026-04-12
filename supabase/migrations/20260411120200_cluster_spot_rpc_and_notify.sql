CREATE OR REPLACE FUNCTION public._create_spot_atomic(
  p_user_id          uuid,
  p_repeater_id      uuid,
  p_access_id        uuid,
  p_callsign_snapshot text,
  p_duration_minutes smallint
) RETURNS public.repeater_spots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_new_row public.repeater_spots%ROWTYPE;
BEGIN
  -- Guard: only callable via service_role (edge functions).
  -- Blocks direct calls from authenticated users via PostgREST.
  -- current_setting returns NULL or '' when called via service_role (no JWT),
  -- so we check with COALESCE to avoid json parse errors on empty/null.
  IF coalesce(current_setting('request.jwt.claims', true), '') <> ''
     AND current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated'
  THEN
    RAISE EXCEPTION 'This function is internal and cannot be called directly'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.repeater_spots
     SET closed_at = now(),
         closed_by = p_user_id
   WHERE user_id = p_user_id
     AND closed_at IS NULL;

  INSERT INTO public.repeater_spots
    (user_id, repeater_id, access_id, callsign_snapshot, duration_minutes, expires_at)
  VALUES
    (p_user_id, p_repeater_id, p_access_id, p_callsign_snapshot, p_duration_minutes,
     now() + make_interval(mins => p_duration_minutes::int))
  RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$fn$
