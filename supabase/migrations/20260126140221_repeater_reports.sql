-- =========================================================
-- Repeater Reports: segnalazioni di correzioni sui ripetitori
-- =========================================================

-- Enum per lo stato del report
create type public.report_status as enum ('pending', 'reviewed', 'resolved', 'rejected');

-- Tabella report
create table public.repeater_reports (
  id uuid primary key default gen_random_uuid(),

  repeater_id uuid not null references public.repeaters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Testo della segnalazione
  description text not null,

  -- Stato del report
  status public.report_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint repeater_reports_description_ck check (length(trim(description)) >= 10)
);

-- Indici
create index repeater_reports_repeater_idx on public.repeater_reports (repeater_id);
create index repeater_reports_user_idx on public.repeater_reports (user_id);
create index repeater_reports_status_idx on public.repeater_reports (status);
create index repeater_reports_created_idx on public.repeater_reports (created_at desc);
create index repeater_reports_status_created_idx on public.repeater_reports (status, created_at desc);

-- RLS
alter table public.repeater_reports enable row level security;

-- Gli utenti autenticati possono leggere tutti i report
create policy "Authenticated can read all reports"
on public.repeater_reports
for select
to authenticated
using (true);

-- Gli utenti possono creare report
create policy "Users can insert own reports"
on public.repeater_reports
for insert
to authenticated
with check (user_id = auth.uid());

-- Gli utenti possono cancellare i propri report solo se pending
create policy "Users can delete own pending reports"
on public.repeater_reports
for delete
to authenticated
using (user_id = auth.uid() and status = 'pending');

-- Gli utenti possono modificare i propri report solo se pending
create policy "Users can update own pending reports"
on public.repeater_reports
for update
to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

-- Trigger per aggiornare updated_at
create or replace function public.repeater_reports_update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_repeater_reports_update_timestamp
before update on public.repeater_reports
for each row execute function public.repeater_reports_update_timestamp();
