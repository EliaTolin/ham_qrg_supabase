-- =========================================================
-- Trigger: invia notifica Telegram per ogni nuovo report
-- Chiama la edge function notify_telegram_report via pg_net
-- =========================================================

create or replace function public.notify_telegram_on_report()
returns trigger
language plpgsql
security definer
as $$
declare
  _repeater_label text;
  _url text;
  _key text;
begin
  -- Leggi secrets dal Vault (stessa strategia di notify_on_user_notification)
  select decrypted_secret into _url
    from vault.decrypted_secrets
    where name = 'project_url'
    limit 1;

  select decrypted_secret into _key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if _url is null or _key is null then
    raise warning '[notify_telegram_on_report] Vault secrets "project_url" or "service_role_key" not configured, skipping';
    return new;
  end if;

  -- Recupera callsign o name del ripetitore
  select coalesce(r.callsign, r.name, 'Repeater')
    into _repeater_label
    from public.repeaters r
    where r.id = new.repeater_id;

  -- Chiama la edge function via pg_net
  perform net.http_post(
    url     := _url || '/functions/v1/notify_telegram_report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := jsonb_build_object(
      'id',              new.id,
      'repeater_id',     new.repeater_id,
      'user_id',         new.user_id,
      'description',     new.description,
      'status',          new.status,
      'created_at',      new.created_at,
      'repeater_label',  _repeater_label
    )
  );

  return new;
end;
$$;

create trigger trg_notify_telegram_on_report
  after insert on public.repeater_reports
  for each row
  execute function public.notify_telegram_on_report();
