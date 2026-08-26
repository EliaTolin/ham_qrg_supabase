-- Funnel di conversione della feature 005-location-coverage-search.
--
-- Prima strumentazione dell'app: fino a oggi nessun evento di prodotto veniva
-- registrato, nemmeno sulle superfici di reachability già a pagamento. Questa
-- tabella copre il tratto a monte del paywall, che il sistema di abbonamenti
-- non può vedere: quanti utenti arrivano al teaser e non toccano mai la CTA.
--
-- Vincoli di prodotto che si riflettono nello schema:
--   * FR-067 — nessuna coordinata e nessun nome di località: sono dati sensibili
--     (abitazione, sito di attivazione). Il client li esclude per firma, qui si
--     aggiunge una difesa lato database (vedi il CHECK su props).
--   * Solo inserimento: nessun client legge gli eventi.

create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  event       text        not null,
  surface     text        not null,
  props       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint analytics_events_event_not_blank   check (length(trim(event)) > 0),
  constraint analytics_events_surface_not_blank check (length(trim(surface)) > 0),

  -- Difesa in profondità su FR-067: il client non espone un parametro in cui
  -- possano finire coordinate o toponimi, ma se un giorno qualcuno aggirasse
  -- quella firma, l'insert fallisce invece di archiviare in silenzio la
  -- posizione di casa di un utente.
  constraint analytics_events_props_no_location check (
    not (props ?| array['lat', 'lon', 'latitude', 'longitude', 'label', 'place', 'query'])
  )
);

comment on table public.analytics_events is
  'Eventi del funnel di conversione. Solo inserimento: nessuna lettura dal client.';
comment on column public.analytics_events.surface is
  'Punto d''ingresso: map_teaser | stations_list | reach_button | reach_badge.';
comment on constraint analytics_events_props_no_location on public.analytics_events is
  'FR-067: coordinate e toponimi non devono mai essere registrati.';

alter table public.analytics_events enable row level security;

-- Inserimento consentito a utenti autenticati e anonimi, purché non attribuiscano
-- l'evento a un altro utente.
drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  to authenticated, anon
  with check (user_id is null or user_id = auth.uid());

-- Nessuna policy di select, update o delete: la lettura avviene solo lato
-- servizio, con la chiave secret, mai dal client.

create index if not exists analytics_events_event_surface_created_at_idx
  on public.analytics_events (event, surface, created_at desc);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
