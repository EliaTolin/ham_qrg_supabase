-- RF coverage cache (computed by the ham_qrg_coverage service).
-- A repeater does not move, so each (params_hash) coverage is computed once
-- and shared across all users. The PNG overlay lives in the `coverage`
-- storage bucket; this table holds its metadata and bounds.

create table if not exists public.repeater_coverage (
  params_hash text primary key,
  repeater_id text,
  bounds jsonb not null,
  size jsonb not null,
  legend jsonb not null,
  stats jsonb not null,
  image_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists repeater_coverage_repeater_id_idx
  on public.repeater_coverage (repeater_id);

alter table public.repeater_coverage enable row level security;

-- Coverage is public, non-sensitive reference data: anyone signed in (incl.
-- anonymous app sessions) may read it. Writes happen only via the service
-- role (which bypasses RLS), so no insert/update policy is granted.
drop policy if exists "repeater_coverage_read" on public.repeater_coverage;
create policy "repeater_coverage_read"
  on public.repeater_coverage
  for select
  to authenticated, anon
  using (true);

-- Public storage bucket for the coverage overlays (PNG). Public read so the
-- app can fetch the image straight from the Storage CDN by URL.
insert into storage.buckets (id, name, public)
values ('coverage', 'coverage', true)
on conflict (id) do nothing;

-- Allow public read of objects in the coverage bucket (defensive: public
-- buckets are already readable, but keep an explicit policy for clarity).
drop policy if exists "coverage_objects_read" on storage.objects;
create policy "coverage_objects_read"
  on storage.objects
  for select
  to authenticated, anon
  using (bucket_id = 'coverage');
