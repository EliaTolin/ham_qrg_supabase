-- =========================================================
-- Add missing RLS policies for admin/RBAC roles
-- =========================================================

-- 1) user_favorite_repeaters: admin può vedere tutti i preferiti (solo lettura)
CREATE POLICY "admins can read all favorites"
  ON public.user_favorite_repeaters
  FOR SELECT
  TO authenticated
  USING (public.authorize('users.manage'::public.app_permission));

-- 2) networks: write policies per bridge_manager/admin
CREATE POLICY "bridge_managers can insert networks"
  ON public.networks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.authorize('networks.write'::public.app_permission));

CREATE POLICY "bridge_managers can update networks"
  ON public.networks
  FOR UPDATE
  TO authenticated
  USING (public.authorize('networks.write'::public.app_permission));

CREATE POLICY "bridge_managers can delete networks"
  ON public.networks
  FOR DELETE
  TO authenticated
  USING (public.authorize('networks.delete'::public.app_permission));

-- 3) repeater_access: write policies per bridge_manager/admin
CREATE POLICY "bridge_managers can insert repeater_access"
  ON public.repeater_access
  FOR INSERT
  TO authenticated
  WITH CHECK (public.authorize('repeaters.write'::public.app_permission));

CREATE POLICY "bridge_managers can update repeater_access"
  ON public.repeater_access
  FOR UPDATE
  TO authenticated
  USING (public.authorize('repeaters.write'::public.app_permission));

CREATE POLICY "bridge_managers can delete repeater_access"
  ON public.repeater_access
  FOR DELETE
  TO authenticated
  USING (public.authorize('repeaters.delete'::public.app_permission));

-- 4) repeater_reports: admin/bridge_manager può eliminare report
CREATE POLICY "report_managers can delete reports"
  ON public.repeater_reports
  FOR DELETE
  TO authenticated
  USING (public.authorize('reports.manage'::public.app_permission));