-- 1) Sblocca callsign (può essere NULL)
alter table public.repeaters
alter column callsign drop not null;

-- 2) Drop di constraint vecchi (se esistono)
alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_net_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_locator_unique;

-- 3) Drop di indici UNIQUE vecchi (se esistono)
drop index if exists public.repeaters_callsign_freq_uq;

-- 4) Vincolo definitivo (identità reale)
alter table public.repeaters
add constraint repeaters_freq_mode_locator_unique
unique (frequency_hz, mode, locator);

