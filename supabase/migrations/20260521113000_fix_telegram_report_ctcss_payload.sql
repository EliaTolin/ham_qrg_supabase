-- Fix Telegram report enrichment after repeater_access.ctcss_hz was split
-- into ctcss_tx_hz and ctcss_rx_hz.

create or replace function public.notify_telegram_on_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  _url text;
  _key text;
  _repeater jsonb;
  _body jsonb;
begin
  select decrypted_secret into _url
    from vault.decrypted_secrets
    where name = 'project_url'
    limit 1;

  select decrypted_secret into _key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if _url is null or _key is null then
    raise warning '[notify_telegram_on_insert] Vault secrets not configured, skipping';
    return new;
  end if;

  _body := jsonb_build_object(
    'type',   TG_OP,
    'table',  TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(new)
  );

  if TG_TABLE_NAME = 'repeater_reports' then
    select jsonb_build_object(
      'id',           r.id,
      'callsign',     r.callsign,
      'name',         r.name,
      'frequency_hz', r.frequency_hz,
      'shift_hz',     r.shift_hz,
      'locality',     r.locality,
      'region',       r.region,
      'accesses',     coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'mode',         a.mode,
              'ctcss_tx_hz',  a.ctcss_tx_hz,
              'ctcss_rx_hz',  a.ctcss_rx_hz,
              'dcs_code',     a.dcs_code,
              'color_code',   a.color_code
            )
            order by a.mode
          )
          from public.repeater_access a
          where a.repeater_id = r.id
        ),
        '[]'::jsonb
      )
    )
    into _repeater
    from public.repeaters r
    where r.id = (new.repeater_id)::uuid;

    if _repeater is not null then
      _body := _body || jsonb_build_object('repeater', _repeater);
    end if;
  end if;

  perform net.http_post(
    url     := _url || '/functions/v1/notify_telegram_report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := _body
  );

  return new;
end;
$$;
