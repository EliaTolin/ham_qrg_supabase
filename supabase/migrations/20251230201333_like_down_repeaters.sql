begin;

-- 1) Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'station_kind') then
    create type public.station_kind as enum ('portable', 'mobile', 'fixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type public.feedback_type as enum ('like', 'down');
  end if;
end$$;

-- 2) Feedback table
create table if not exists public.repeater_feedback (
  id uuid primary key default gen_random_uuid(),

  repeater_id uuid not null references public.repeaters(id) on delete cascade,

  -- Supabase auth user id
  user_id uuid not null,

  type public.feedback_type not null,          -- like | down
  station public.station_kind not null,        -- portable | mobile | fixed

  lat double precision not null,
  lon double precision not null,

  geom geography(point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,

  comment text not null,
  created_at timestamptz not null default now(),

  constraint repeater_feedback_lat_ck check (lat between -90 and 90),
  constraint repeater_feedback_lon_ck check (lon between -180 and 180),
  constraint repeater_feedback_comment_ck check (length(trim(comment)) >= 3)
);

-- ✅ NEW: only one feedback per user per repeater (regardless of type)
create unique index if not exists repeater_feedback_one_per_user_per_repeater
  on public.repeater_feedback (repeater_id, user_id);

-- 3) Indices
create index if not exists repeater_feedback_repeater_created_idx
  on public.repeater_feedback (repeater_id, created_at desc);

create index if not exists repeater_feedback_repeater_type_created_idx
  on public.repeater_feedback (repeater_id, type, created_at desc);

create index if not exists repeater_feedback_type_idx
  on public.repeater_feedback (type);

create index if not exists repeater_feedback_user_created_idx
  on public.repeater_feedback (user_id, created_at desc);

create index if not exists repeater_feedback_geom_gix
  on public.repeater_feedback using gist (geom);

-- 4) Single stats view (only what you asked)
create or replace view public.v_repeater_feedback_stats with (security_invoker = on) as
select
  rf.repeater_id,

  count(*) filter (where rf.type = 'like')::int as likes_total,
  count(*) filter (where rf.type = 'down')::int as down_total,

  max(rf.created_at) filter (where rf.type = 'like') as last_like_at,
  max(rf.created_at) filter (where rf.type = 'down') as last_down_at

from public.repeater_feedback rf
group by rf.repeater_id;

alter table public.repeater_feedback enable row level security;

-- Allow authenticated users to SELECT all rows
create policy "Authenticated can read all feedback"
on public.repeater_feedback
for select
to authenticated
using (true);

-- Allow authenticated users to INSERT only rows that belong to them
create policy "Users can insert own feedback"
on public.repeater_feedback
for insert
to authenticated
with check (user_id = auth.uid());

-- Allow authenticated users to DELETE only their own rows
create policy "Users can delete own feedback"
on public.repeater_feedback
for delete
to authenticated
using (user_id = auth.uid());

commit;