-- =========================================================
-- repeater_access: DCS separato per TX e RX
--
-- Il CTCSS ha due colonne (ctcss_tx_hz / ctcss_rx_hz), il DCS una sola
-- (dcs_code). Un ripetitore con codici DCS diversi nei due versi non e'
-- quindi rappresentabile: uno dei due valori non ha dove andare.
--
-- Caso che ha fatto emergere il problema: N5IGN (443.750, Springhill LA)
-- trasmette D411N e riceve D131N. Il secondo codice era stato messo nelle
-- note, cioe' in testo libero: leggibile da una persona che apre la scheda,
-- invisibile all'app che deve programmare la radio. Il segnalatore ha
-- riscritto per dire che il problema non era risolto, e aveva ragione.
--
-- Si segue la stessa strada gia' percorsa per il CTCSS: dcs_code diventa il
-- codice di trasmissione e si aggiunge dcs_rx_code. La colonna esistente NON
-- viene rinominata: e' referenziata da nearby_inbounds, dai payload Telegram
-- e dalle edge function, e un rename li romperebbe tutti insieme.
--
-- NOTA SULLO SCHEMA REALE: lo schema di produzione e' in drift rispetto alle
-- migration versionate (vedi il commento in 20260908130000). ctcss_hz,
-- tone_scope, tone_direction e dmr_id non esistono piu'. Per questo ogni
-- passo qui sotto verifica l'esistenza di cio' che tocca invece di darla per
-- scontata.
-- =========================================================

-- 1) La colonna, con lo stesso dominio di validita' di dcs_code.
alter table public.repeater_access
  add column if not exists dcs_rx_code integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.repeater_access'::regclass
       and conname  = 'repeater_access_dcs_rx_ck'
  ) then
    alter table public.repeater_access
      add constraint repeater_access_dcs_rx_ck
      check (dcs_rx_code is null or (dcs_rx_code >= 0 and dcs_rx_code <= 999));
  end if;
end $$;

comment on column public.repeater_access.dcs_code is
  'Codice DCS di trasmissione (quello che la radio invia al ripetitore).';
comment on column public.repeater_access.dcs_rx_code is
  'Codice DCS di ricezione, se diverso dal TX. Null = il ripetitore usa lo stesso codice nei due versi.';

create index if not exists repeater_access_dcs_rx_idx
  on public.repeater_access (dcs_rx_code);

-- 2) L'indice di deduplica deve considerare anche il nuovo codice, altrimenti
--    due accessi che differiscono SOLO per il DCS di ricezione collidono e il
--    secondo viene scartato come duplicato.
do $$
begin
  if exists (
    select 1 from pg_class
     where relname = 'repeater_access_dedup_unique'
       and relnamespace = 'public'::regnamespace
  ) then
    drop index public.repeater_access_dedup_unique;
  end if;
end $$;

-- Ricostruito sulle colonne REALI della tabella (lo schema in drift non ha
-- ctcss_hz ne' dmr_id: si usano ctcss_tx_hz/ctcss_rx_hz e talkgroup).
create unique index repeater_access_dedup_unique
on public.repeater_access (
  repeater_id,
  mode,
  coalesce(network_id::text,''),
  coalesce(ctcss_tx_hz::text,''),
  coalesce(ctcss_rx_hz::text,''),
  coalesce(dcs_code::text,''),
  coalesce(dcs_rx_code::text,''),
  coalesce(color_code::text,''),
  coalesce(talkgroup::text,''),
  coalesce(dg_id::text,'')
);

-- 3) Recupero del caso noto: N5IGN aveva RX D131N solo nelle note.
--    Condizionato al contenuto della nota, cosi' se qualcuno l'ha gia'
--    corretto a mano questa migration non sovrascrive nulla.
update public.repeater_access a
   set dcs_rx_code = 131,
       notes       = null,
       updated_at  = now()
 where a.dcs_code = 411
   and a.dcs_rx_code is null
   and a.notes like '%D131N%'
   and exists (
     select 1 from public.repeaters r
      where r.id = a.repeater_id
        and r.callsign = 'N5IGN'
   );
