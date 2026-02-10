-- =========================================================
-- RBAC: Custom claims, roles, permissions
-- =========================================================

-- a) Enums
create type public.app_role as enum ('admin', 'viewer', 'bridge_manager', 'report_manager');
create type public.app_permission as enum (
  'repeaters.write', 'repeaters.delete',
  'networks.write', 'networks.delete',
  'reports.manage', 'users.manage', 'sync.trigger'
);

-- b) Tables
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz default now() not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission public.app_permission not null,
  unique(role, permission)
);
alter table public.role_permissions enable row level security;

-- c) Seed permissions
insert into public.role_permissions (role, permission) values
  -- admin: all permissions
  ('admin', 'repeaters.write'),
  ('admin', 'repeaters.delete'),
  ('admin', 'networks.write'),
  ('admin', 'networks.delete'),
  ('admin', 'reports.manage'),
  ('admin', 'users.manage'),
  ('admin', 'sync.trigger'),
  -- bridge_manager
  ('bridge_manager', 'repeaters.write'),
  ('bridge_manager', 'networks.write'),
  -- report_manager
  ('report_manager', 'reports.manage');
  -- viewer: no permissions (read-only via existing RLS)

-- d) Custom Access Token Hook
-- =========================================================
-- Fix RBAC hook: add RLS policy for supabase_auth_admin
-- and cast enum to text to avoid polymorphic type error
-- =========================================================

-- 1) RLS policy so supabase_auth_admin can read user_roles
CREATE POLICY "Allow auth admin to read user roles"
    ON public.user_roles
    FOR SELECT TO supabase_auth_admin
    USING (true);

-- 2) Recreate hook: cast role to text before to_jsonb()
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_user_role text;
BEGIN
  -- Fetch the user role, cast enum to text
  SELECT role::text INTO v_user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';

  IF v_user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"viewer"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

-- Grant usage on user_profile and driver to supabase_auth_admin (needed by the hook)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- 4) RLS policy for role_permissions (SELECT for auth admin)
CREATE POLICY "Allow auth admin to read role permissions"
    ON public.role_permissions
    FOR SELECT TO supabase_auth_admin
    USING (true);

-- e) Authorize function
create or replace function public.authorize(requested_permission public.app_permission)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bind_permissions int;
  user_role public.app_role;
begin
  -- Extract user_role from JWT
  select (auth.jwt()->>'user_role')::public.app_role into user_role;

  select count(*)
  into bind_permissions
  from public.role_permissions
  where role_permissions.permission = requested_permission
    and role_permissions.role = user_role;

  return bind_permissions > 0;
end;
$$;

-- f) RLS policies

-- user_roles: SELECT/INSERT/DELETE for users.manage
create policy "users_manage can view roles"
  on public.user_roles for select
  to authenticated
  using (public.authorize('users.manage'::public.app_permission));

create policy "users_manage can assign roles"
  on public.user_roles for insert
  to authenticated
  with check (public.authorize('users.manage'::public.app_permission));

create policy "users_manage can remove roles"
  on public.user_roles for delete
  to authenticated
  using (public.authorize('users.manage'::public.app_permission));

-- role_permissions: SELECT for users.manage
create policy "users_manage can view permissions"
  on public.role_permissions for select
  to authenticated
  using (public.authorize('users.manage'::public.app_permission));

-- repeaters: INSERT/UPDATE for repeaters.write, DELETE for repeaters.delete
create policy "bridge_managers can insert repeaters"
  on public.repeaters for insert
  to authenticated
  with check (public.authorize('repeaters.write'::public.app_permission));

create policy "bridge_managers can update repeaters"
  on public.repeaters for update
  to authenticated
  using (public.authorize('repeaters.write'::public.app_permission));

create policy "bridge_managers can delete repeaters"
  on public.repeaters for delete
  to authenticated
  using (public.authorize('repeaters.delete'::public.app_permission));

-- repeater_reports: UPDATE for reports.manage
create policy "report_managers can update reports"
  on public.repeater_reports for update
  to authenticated
  using (public.authorize('reports.manage'::public.app_permission));
