-- =========================================================
-- Pending changes table for iz8wnh sync review workflow.
-- Incoming updates are stored here for admin review
-- before being applied to the repeaters table.
-- =========================================================

-- NOTE: enum value 'sync.review' added in previous migration
-- (20260327125000_add_sync_review_permission.sql)

-- 1) Create the table
CREATE TABLE public.sync_pending_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to existing repeater (NULL for new repeaters not yet in DB)
  repeater_id     UUID NULL REFERENCES public.repeaters(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,

  -- What kind of change
  change_type     TEXT NOT NULL CHECK (change_type IN ('update', 'new', 'deactivate', 'reactivate')),

  -- Full incoming API record (raw JSON for reference/debugging)
  remote_data     JSONB NOT NULL,

  -- Pre-computed diff: only fields that differ { field: { local: X, remote: Y } }
  diff            JSONB NOT NULL DEFAULT '{}',

  -- Timestamps for conflict heuristic
  remote_updated_at TIMESTAMPTZ NULL,
  local_updated_at  TIMESTAMPTZ NULL,

  -- Who is "newer" based on timestamps
  suggested_winner TEXT NOT NULL DEFAULT 'unknown'
    CHECK (suggested_winner IN ('remote', 'local', 'unknown')),

  -- Review status
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID NULL REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one pending change per external_id at a time
CREATE UNIQUE INDEX IF NOT EXISTS sync_pending_changes_one_pending_per_ext
  ON public.sync_pending_changes (external_id) WHERE status = 'pending';

CREATE INDEX sync_pending_changes_status_idx
  ON public.sync_pending_changes (status);
CREATE INDEX sync_pending_changes_repeater_idx
  ON public.sync_pending_changes (repeater_id);
CREATE INDEX sync_pending_changes_created_idx
  ON public.sync_pending_changes (created_at DESC);

-- 3) RLS: service role writes, admin reads
ALTER TABLE public.sync_pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read pending changes"
  ON public.sync_pending_changes FOR SELECT TO authenticated
  USING (public.authorize('sync.review'::public.app_permission));

CREATE POLICY "Admin can update pending changes"
  ON public.sync_pending_changes FOR UPDATE TO authenticated
  USING (public.authorize('sync.review'::public.app_permission))
  WITH CHECK (public.authorize('sync.review'::public.app_permission));

-- 4) Seed sync.review permission for admin role
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'sync.review'),
  ('bridge_manager', 'sync.review')
ON CONFLICT DO NOTHING;