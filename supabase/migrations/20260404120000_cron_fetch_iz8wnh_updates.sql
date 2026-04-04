-- =========================================================
-- Daily cron: fetch iz8wnh updates
-- Runs every day at 06:00 UTC via pg_cron + pg_net.
--
-- SETUP RICHIESTO (una volta per ambiente, se non già fatto):
--   SELECT vault.create_secret('<project-url>', 'project_url');
--   SELECT vault.create_secret('<service-role-key>', 'service_role_key');
-- =========================================================

CREATE OR REPLACE FUNCTION public.cron_fetch_iz8wnh_updates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url  TEXT;
  _key  TEXT;
BEGIN
  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
    LIMIT 1;

  SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  IF _url IS NULL OR _key IS NULL THEN
    RAISE WARNING '[cron_fetch_iz8wnh_updates] vault secrets project_url or service_role_key not set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := _url || '/functions/v1/fetch_iz8wnh_updates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := '{"auto_apply": true}'::jsonb
  );
END;
$$;

-- Schedule: every day at 06:00 UTC
SELECT cron.schedule(
  'fetch-iz8wnh-updates-daily',
  '0 6 * * *',
  $$SELECT public.cron_fetch_iz8wnh_updates()$$
);
