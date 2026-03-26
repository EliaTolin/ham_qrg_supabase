-- =========================================================
-- Repeater Reports: aggiunge closed_by per tracciare chi ha
-- chiuso (resolved/rejected) la segnalazione
-- =========================================================

-- 1) Nuova colonna
ALTER TABLE public.repeater_reports
  ADD COLUMN closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indice per eventuali query filtrate per chi ha chiuso
CREATE INDEX repeater_reports_closed_by_idx
  ON public.repeater_reports (closed_by)
  WHERE closed_by IS NOT NULL;

-- 2) Auto-set closed_by quando lo stato diventa resolved/rejected
--    e reset quando torna a pending/reviewed
CREATE OR REPLACE FUNCTION public.repeater_reports_set_closed_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status IN ('resolved', 'rejected')
     AND old.status IS DISTINCT FROM new.status THEN
    new.closed_by := auth.uid();
  END IF;

  IF new.status IN ('pending', 'reviewed')
     AND old.status IN ('resolved', 'rejected') THEN
    new.closed_by := NULL;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_repeater_reports_set_closed_by
  BEFORE UPDATE ON public.repeater_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.repeater_reports_set_closed_by();
