alter table public.repeaters enable row level security;

create policy "Enable read access for all users"
  on public.repeaters
  for select
  to authenticated
  using (true);