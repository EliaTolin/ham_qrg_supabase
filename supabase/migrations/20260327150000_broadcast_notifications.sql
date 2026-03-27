-- =========================================================
-- Broadcast Notifications: tabella dedicata per le notifiche
-- broadcast inviate dagli admin. Un trigger crea automaticamente
-- una riga in user_notifications per ogni utente.
-- =========================================================

-- 1) Tabella
create table public.broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  headings jsonb not null,       -- {"it": "Titolo", "en": "Title"}
  contents jsonb not null,       -- {"it": "Corpo",  "en": "Body"}
  data jsonb default '{}'::jsonb,
  sent_by uuid references public.profiles(id) on delete set null,
  recipient_count int not null default 0,
  created_at timestamptz default now() not null
);

-- 2) RLS
alter table public.broadcast_notifications enable row level security;

-- Solo admin può inserire (tramite authorize)
create policy "Admins can insert broadcast notifications"
  on public.broadcast_notifications for insert
  to authenticated
  with check (authorize('users.manage'));

-- Admin può leggere lo storico
create policy "Admins can view broadcast notifications"
  on public.broadcast_notifications for select
  to authenticated
  using (authorize('users.manage'));

-- 3) Trigger: fan-out a user_notifications per tutti gli utenti
create or replace function public.broadcast_notification_fan_out()
returns trigger
language plpgsql
security definer
as $$
declare
  _count int;
begin
  insert into public.user_notifications (user_id, headings, contents, data)
  select p.id, new.headings, new.contents, coalesce(new.data, '{}'::jsonb)
  from public.profiles p;

  get diagnostics _count = row_count;

  -- Aggiorna il conteggio destinatari
  update public.broadcast_notifications
    set recipient_count = _count
    where id = new.id;

  -- Popola sent_by con l'utente corrente se non specificato
  if new.sent_by is null then
    update public.broadcast_notifications
      set sent_by = auth.uid()
      where id = new.id;
  end if;

  return new;
end;
$$;

create trigger trg_broadcast_notification_fan_out
  after insert on public.broadcast_notifications
  for each row
  execute function public.broadcast_notification_fan_out();
