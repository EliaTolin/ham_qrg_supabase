-- 1) rendi callsign obbligatorio
alter table public.repeaters
  alter column callsign set not null;

-- 2) rimuovi l'indice parziale (se esiste)
drop index if exists public.repeaters_callsign_freq_uq;

-- 3) crea un vincolo UNIQUE vero (usabile da PostgREST on_conflict)
alter table public.repeaters
  add constraint repeaters_callsign_freq_unique unique (callsign, frequency_hz);