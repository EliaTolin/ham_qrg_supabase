create table public.user_favorite_repeaters (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  repeater_id uuid not null
    references public.repeaters(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  -- evita che uno stesso utente salvi lo stesso ponte due volte
  constraint user_favorite_repeaters_unique
    unique (user_id, repeater_id)
);


alter table public.user_favorite_repeaters
enable row level security;

create policy "select own favorites"
on public.user_favorite_repeaters
for select
using (auth.uid() = user_id);

create policy "insert own favorites"
on public.user_favorite_repeaters
for insert
with check (auth.uid() = user_id);

create policy "delete own favorites"
on public.user_favorite_repeaters
for delete
using (auth.uid() = user_id);