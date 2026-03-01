-- =========================================================
-- User Notifications table + trigger per push via OneSignal
-- =========================================================

-- a) Tabella notifiche utente
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  headings jsonb not null,   -- {"en": "Title", "it": "Titolo"}
  contents jsonb not null,   -- {"en": "Body",  "it": "Corpo"}
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- Indice per query per utente ordinate per data
create index idx_user_notifications_user_id
  on public.user_notifications (user_id, created_at desc);

-- b) RLS
alter table public.user_notifications enable row level security;

-- Gli utenti possono vedere solo le proprie notifiche
create policy "Users can view own notifications"
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- c) Trigger function: chiama la Edge Function send_notification via pg_net
--
-- SETUP RICHIESTO (una volta per ambiente):
--   Local:  SELECT vault.create_secret('http://kong:8000', 'project_url');
--           SELECT vault.create_secret('<service_role_key_locale>', 'service_role_key');
--   Prod:   Supabase Dashboard → Vault → Add secret (project_url, service_role_key)
--
create or replace function public.notify_on_user_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  _url text;
  _key text;
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
    raise warning '[notify_on_user_notification] Vault secrets "project_url" or "service_role_key" not configured, skipping push';
    return new;
  end if;

  perform net.http_post(
    url    := _url || '/functions/v1/send_notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body   := jsonb_build_object(
      'headings', new.headings,
      'contents', new.contents,
      'include_external_user_ids', jsonb_build_array(new.user_id::text),
      'data', coalesce(new.data, '{}'::jsonb)
    )
  );

  return new;
end;
$$;

-- d) Trigger: dopo ogni INSERT invia la push notification
create trigger trg_user_notification_push
  after insert on public.user_notifications
  for each row
  execute function public.notify_on_user_notification();
