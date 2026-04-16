-- =========================================================
-- Cron: close expired self-spots
-- Runs every minute via pg_cron.
-- Sets closed_at = expires_at (closed_by NULL = system close)
-- for self-spots whose expires_at is in the past and that
-- have not been closed manually or by a subsequent create_spot.
-- Other-spots (expires_at IS NULL) are excluded by design.
-- =========================================================

CREATE OR REPLACE FUNCTION public.cron_close_expired_spots()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.repeater_spots
     SET closed_at = expires_at
   WHERE closed_at IS NULL
     AND expires_at IS NOT NULL
     AND expires_at < now();
$$;

SELECT cron.schedule(
  'close-expired-spots',
  '* * * * *',
  $$SELECT public.cron_close_expired_spots()$$
);
