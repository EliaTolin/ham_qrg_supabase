-- Enum per il tipo di utente
create type public.user_type as enum ('swl', 'licensed');

-- Aggiunge colonna user_type alla tabella profiles (nullable = non specificato)
alter table public.profiles
  add column user_type public.user_type;

comment on column public.profiles.user_type is 'User type: swl (Short Wave Listener), licensed (licensed radio amateur), NULL (unspecified)';

alter table public.profiles
  add constraint callsign_required_if_licensed
  check (user_type <> 'licensed' OR callsign IS NOT NULL);