-- =========================================================
-- Migration 5 — Add simple FK access_id → repeater_access(id)
-- for PostgREST embedding support.
--
-- The composite FK (access_id, repeater_id) → repeater_access(id, repeater_id)
-- ensures data integrity (access belongs to repeater), but PostgREST
-- cannot resolve composite FKs for joins like `repeater_access!access_id(...)`.
-- This simple FK enables the join while the composite FK handles integrity.
-- =========================================================

ALTER TABLE public.repeater_spots
  ADD CONSTRAINT repeater_spots_access_id_fkey
    FOREIGN KEY (access_id) REFERENCES public.repeater_access(id)
    ON DELETE SET NULL
