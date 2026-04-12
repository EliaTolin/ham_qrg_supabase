-- =========================================================
-- Migration 2/3 — Cluster Spots: notification preferences
-- Feature: 001-cluster-spots
-- Spec: specs/001-cluster-spots/data-model.md §3.1, §3.2
-- =========================================================

-- 1. Global opt-out flag on profiles (default: true = notifications enabled)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cluster_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.cluster_notifications_enabled IS
  'Global opt-out for cluster spot push notifications. Default: true (enabled). FR-024.';

-- 2. Per-favorite opt-out flag (default: true = notifications enabled)
ALTER TABLE public.user_favorite_repeaters
  ADD COLUMN IF NOT EXISTS cluster_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_favorite_repeaters.cluster_notifications_enabled IS
  'Per-favorite opt-out for cluster spot push notifications on this specific repeater. Default: true (enabled). FR-025.';

-- 3. UPDATE policy on user_favorite_repeaters
--    The existing migration 20251223184226_favorite.sql only defines
--    SELECT/INSERT/DELETE policies. Without this UPDATE policy, the
--    per-favorite opt-out toggle cannot be saved by the client.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_favorite_repeaters'
      AND policyname = 'update own favorites'
  ) THEN
    CREATE POLICY "update own favorites"
      ON public.user_favorite_repeaters
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
