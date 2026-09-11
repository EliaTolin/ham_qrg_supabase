-- =========================================================
-- Migration 5 — Cluster Spots: talkgroup on DMR spots
-- Lo spot DMR può dichiarare il TG su cui l'OM è in ascolto.
-- Solo DMR: la validazione "l'accesso è DMR" sta nella edge
-- function create-spot, che rilegge il mode dall'access_id.
-- =========================================================

-- 1. Colonna talkgroup (NULL = non dichiarato)
ALTER TABLE public.repeater_spots
  ADD COLUMN IF NOT EXISTS talkgroup integer;

COMMENT ON COLUMN public.repeater_spots.talkgroup IS
  'DMR talkgroup on which the OM is listening. NULL when not declared or '
  'when the access is not DMR. NOT the repeater network id — that lives in '
  'repeater_access.node_id.';

-- 2. Range DMR: 1..16777215 (24 bit, come gli ID DMR)
ALTER TABLE public.repeater_spots
  DROP CONSTRAINT IF EXISTS repeater_spots_talkgroup_check;

ALTER TABLE public.repeater_spots
  ADD CONSTRAINT repeater_spots_talkgroup_check
    CHECK (talkgroup IS NULL OR talkgroup BETWEEN 1 AND 16777215);

-- 3. Funzione atomica: un'unica firma con p_talkgroup.
--    Le due firme precedenti (5 e 6 argomenti, accumulate dalla
--    migrazione other-om) vengono rimosse: lasciarle creerebbe
--    overload ambigui sulle chiamate per nome.
DROP FUNCTION IF EXISTS public._create_spot_atomic(uuid, uuid, uuid, text, smallint);
DROP FUNCTION IF EXISTS public._create_spot_atomic(uuid, uuid, uuid, text, smallint, text);

CREATE OR REPLACE FUNCTION public._create_spot_atomic(
  p_user_id          uuid,
  p_repeater_id      uuid,
  p_access_id        uuid,
  p_callsign_snapshot text,
  p_duration_minutes smallint,
  p_spotted_callsign text DEFAULT NULL,
  p_talkgroup        integer DEFAULT NULL
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
    (user_id, repeater_id, access_id, callsign_snapshot, duration_minutes,
     expires_at, spotted_callsign, talkgroup)
  VALUES
    (p_user_id, p_repeater_id, p_access_id, p_callsign_snapshot, p_duration_minutes,
     v_expires_at, p_spotted_callsign, p_talkgroup)
  RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$fn$;
