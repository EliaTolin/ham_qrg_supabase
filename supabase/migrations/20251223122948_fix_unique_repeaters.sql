alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_net_unique;

alter table public.repeaters
add constraint repeaters_callsign_freq_mode_unique
unique (callsign, frequency_hz, mode);


alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_unique;

alter table public.repeaters
drop constraint if exists repeaters_callsign_freq_mode_net_unique;

-- questo DEVE esistere per usare on_conflict="callsign,frequency_hz,mode,locator"
alter table public.repeaters
add constraint repeaters_callsign_freq_mode_locator_unique
unique (callsign, frequency_hz, mode, locator);

