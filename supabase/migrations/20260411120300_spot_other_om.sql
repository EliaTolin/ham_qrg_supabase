-- =========================================================
-- Migration 4 — Cluster Spots: support other-spot ("ho sentito X")
-- Self-spot: user declares "I'm listening" (has duration)
-- Other-spot: user reports "I heard callsign X" (no duration, no active state)
-- =========================================================

-- 1. Add spotted_callsign column (NULL = self-spot, non-NULL = other-spot)
ALTER TABLE public.repeater_spots
  ADD COLUMN IF NOT EXISTS spotted_callsign text;

COMMENT ON COLUMN public.repeater_spots.spotted_callsign IS
  'Callsign of the OM spotted (other-spot). NULL means self-spot.';

-- 2. Make duration_minutes nullable (other-spots have no duration)
ALTER TABLE public.repeater_spots
  ALTER COLUMN duration_minutes DROP NOT NULL;

-- 3. Make expires_at nullable (other-spots don't expire)
ALTER TABLE public.repeater_spots
  ALTER COLUMN expires_at DROP NOT NULL;

-- 4. Replace duration CHECK to allow NULL
ALTER TABLE public.repeater_spots
  DROP CONSTRAINT IF EXISTS repeater_spots_duration_check;

ALTER TABLE public.repeater_spots
  ADD CONSTRAINT repeater_spots_duration_check
    CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600);

-- 5. Replace partial unique index: "1 active SELF-spot per user"
--    Other-spots (spotted_callsign IS NOT NULL) are excluded from this constraint.
DROP INDEX IF EXISTS idx_spots_active_per_user;

CREATE UNIQUE INDEX idx_spots_active_per_user
  ON public.repeater_spots (user_id)
  WHERE closed_at IS NULL AND spotted_callsign IS NULL;

-- 6. Update atomic function to support both spot types
CREATE OR REPLACE FUNCTION public._create_spot_atomic(
  p_user_id          uuid,
  p_repeater_id      uuid,
  p_access_id        uuid,
  p_callsign_snapshot text,
  p_duration_minutes smallint,
  p_spotted_callsign text DEFAULT NULL
) RETURNS public.repeater_spots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_new_row public.repeater_spots%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true), '') <> ''
     AND current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated'
  THEN
    RAISE EXCEPTION 'This function is internal and cannot be called directly'
      USING ERRCODE = 'P0001';
  END IF;

  -- For self-spots only: close previous active self-spot
  IF p_spotted_callsign IS NULL THEN
    UPDATE public.repeater_spots
       SET closed_at = now(),
           closed_by = p_user_id
     WHERE user_id = p_user_id
       AND closed_at IS NULL
       AND spotted_callsign IS NULL;

    v_expires_at := now() + make_interval(mins => p_duration_minutes::int);
  ELSE
    -- Other-spot: no expiry, no close of previous
    v_expires_at := NULL;
  END IF;

  INSERT INTO public.repeater_spots
    (user_id, repeater_id, access_id, callsign_snapshot, duration_minutes, expires_at, spotted_callsign)
  VALUES
    (p_user_id, p_repeater_id, p_access_id, p_callsign_snapshot, p_duration_minutes, v_expires_at, p_spotted_callsign)
  RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$fn$
