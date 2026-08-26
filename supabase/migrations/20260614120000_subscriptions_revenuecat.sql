-- HamQRG Pro subscriptions, synced from RevenueCat via the
-- `revenuecat_webhook` edge function. The table is the server-side source of
-- truth for the Pro entitlement, so premium backend features can trust it
-- through RLS even though the client also checks the RevenueCat SDK directly.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_pro boolean not null default false,
  entitlement text,
  product_id text,
  store text,
  environment text,
  expires_at timestamptz,
  will_renew boolean not null default false,
  rc_original_app_user_id text,
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Per-user HamQRG Pro entitlement, written exclusively by the RevenueCat webhook (service role).';

alter table public.subscriptions enable row level security;

-- Users may read only their own subscription row.
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies: only the service role (the webhook)
-- mutates this table, and the service role bypasses RLS.

-- Reusable predicate for gating premium features in other tables' RLS, e.g.
--   using ( public.is_user_pro() )
create or replace function public.is_user_pro(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.is_pro
        and (s.expires_at is null or s.expires_at > now())
      from public.subscriptions s
      where s.user_id = uid
    ),
    false
  );
$$;

grant execute on function public.is_user_pro(uuid) to authenticated, anon;
