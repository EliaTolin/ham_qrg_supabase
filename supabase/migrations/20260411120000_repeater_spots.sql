-- =========================================================
-- Migration 1/3 — Cluster Spots: schema, indexes, RLS, realtime
-- Feature: 001-cluster-spots
-- Spec: specs/001-cluster-spots/data-model.md
-- =========================================================

-- 1. Precondition: UNIQUE(id, repeater_id) on repeater_access
--    Required for the composite FK from repeater_spots.
--    Technically redundant (id is already PK) but Postgres
--    needs it to reference a composite key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repeater_access_id_repeater_unique'
  ) THEN
    ALTER TABLE public.repeater_access
      ADD CONSTRAINT repeater_access_id_repeater_unique UNIQUE (id, repeater_id);
  END IF;
END $$;

-- 2. Create table
CREATE TABLE IF NOT EXISTS public.repeater_spots (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         NOT NULL,
  repeater_id      uuid         NOT NULL,
  access_id        uuid,
  callsign_snapshot text        NOT NULL,
  started_at       timestamptz  NOT NULL DEFAULT now(),
  duration_minutes smallint     NOT NULL,
  expires_at       timestamptz  NOT NULL,
  closed_at        timestamptz,
  closed_by        uuid,
  created_at       timestamptz  NOT NULL DEFAULT now(),

  -- CHECK constraints
  CONSTRAINT repeater_spots_duration_check
    CHECK (duration_minutes BETWEEN 1 AND 600),
  CONSTRAINT repeater_spots_temporal_check
    CHECK (closed_at IS NULL OR closed_at >= started_at),
  CONSTRAINT repeater_spots_closed_by_consistency_check
    CHECK (closed_by IS NULL OR closed_at IS NOT NULL),

  -- Foreign keys
  CONSTRAINT repeater_spots_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT repeater_spots_repeater_id_fkey
    FOREIGN KEY (repeater_id) REFERENCES public.repeaters(id) ON DELETE CASCADE,
  CONSTRAINT repeater_spots_access_repeater_fkey
    FOREIGN KEY (access_id, repeater_id)
    REFERENCES public.repeater_access(id, repeater_id)
    ON DELETE SET NULL,
  CONSTRAINT repeater_spots_closed_by_fkey
    FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Indexes
-- Spot di un ponte ordinati per recenza (scheda dettaglio ponte, FR-013)
CREATE INDEX IF NOT EXISTS idx_spots_repeater_started
  ON public.repeater_spots (repeater_id, started_at DESC);

-- Ultimi spot globali (sezione "ultimi spot", FR-014)
CREATE INDEX IF NOT EXISTS idx_spots_started
  ON public.repeater_spots (started_at DESC);

-- Vincolo "1 spot attivo per utente" + lookup veloce (SC-006)
-- "Attivo" per l'indice = closed_at IS NULL (anche se scaduto).
-- L'asimmetria con "attivo per visualizzazione" (closed_at IS NULL AND
-- expires_at > now()) è intenzionale: la RPC create_spot chiude sempre
-- esplicitamente il precedente prima di inserire il nuovo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_active_per_user
  ON public.repeater_spots (user_id)
  WHERE closed_at IS NULL;

-- 4. Row-Level Security
ALTER TABLE public.repeater_spots ENABLE ROW LEVEL SECURITY;

-- SELECT: tutti gli utenti autenticati possono leggere tutti gli spot
CREATE POLICY "authenticated can read all spots"
  ON public.repeater_spots
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: nessuna policy diretta. Gli INSERT passano dalla RPC
-- create_spot (SECURITY DEFINER) che garantisce validazione callsign
-- + chiusura atomica del precedente.

-- UPDATE: l'owner può chiudere il proprio spot
CREATE POLICY "users can close own spots"
  ON public.repeater_spots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: nessuna policy. La chiusura è soft via closed_at.
-- Solo FK CASCADE da auth.users può cancellare fisicamente (GDPR, FR-011a).

-- Nessuna policy admin in v1 (Q5 clarification — moderazione fuori scope).

-- 5. Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'repeater_spots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.repeater_spots;
  END IF;
END $$;
