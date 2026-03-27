-- =========================================================
-- Add sync.review to app_permission enum.
-- Must be in a separate migration from its first usage
-- because PostgreSQL cannot use a new enum value in the
-- same transaction where it was added.
-- =========================================================

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'sync.review';
