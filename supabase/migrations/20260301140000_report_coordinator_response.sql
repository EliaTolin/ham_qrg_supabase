-- =========================================================
-- Repeater Reports: aggiunge risposta coordinatore,
-- resolved_at, e notifica l'utente al cambio stato
-- =========================================================

-- 1) Nuove colonne
ALTER TABLE public.repeater_reports
  ADD COLUMN coordinator_response text,
  ADD COLUMN resolved_at timestamptz;

-- 2) Auto-set resolved_at quando lo stato diventa 'resolved'
CREATE OR REPLACE FUNCTION public.repeater_reports_set_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status = 'resolved' AND old.status IS DISTINCT FROM 'resolved' THEN
    new.resolved_at := now();
  END IF;

  IF new.status <> 'resolved' AND old.status = 'resolved' THEN
    new.resolved_at := null;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_repeater_reports_set_resolved_at
  BEFORE UPDATE ON public.repeater_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.repeater_reports_set_resolved_at();

-- 3) Notifica l'utente quando lo stato del suo report cambia
CREATE OR REPLACE FUNCTION public.notify_user_on_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _repeater_label text;
  _status_label_en text;
  _status_label_it text;
BEGIN
  -- Solo se lo stato è effettivamente cambiato
  IF old.status IS NOT DISTINCT FROM new.status THEN
    RETURN new;
  END IF;

  -- Etichetta ripetitore
  SELECT coalesce(r.callsign, r.name, 'Repeater')
    INTO _repeater_label
    FROM public.repeaters r
    WHERE r.id = new.repeater_id;

  -- Traduzioni stato
  _status_label_en := CASE new.status
    WHEN 'reviewed'  THEN 'under review'
    WHEN 'resolved'  THEN 'resolved'
    WHEN 'rejected'  THEN 'rejected'
    ELSE new.status::text
  END;

  _status_label_it := CASE new.status
    WHEN 'reviewed'  THEN 'in lavorazione'
    WHEN 'resolved'  THEN 'risolto'
    WHEN 'rejected'  THEN 'rifiutato'
    ELSE new.status::text
  END;

  INSERT INTO public.user_notifications (user_id, headings, contents, data)
  VALUES (
    new.user_id,
    jsonb_build_object(
      'en', 'Report update — ' || _repeater_label,
      'it', 'Aggiornamento segnalazione — ' || _repeater_label
    ),
    jsonb_build_object(
      'en', 'Your report on ' || _repeater_label || ' is now ' || _status_label_en
            || CASE WHEN new.coordinator_response IS NOT NULL
                    THEN ': ' || left(new.coordinator_response, 120)
                    ELSE '' END,
      'it', 'La tua segnalazione su ' || _repeater_label || ' è ora ' || _status_label_it
            || CASE WHEN new.coordinator_response IS NOT NULL
                    THEN ': ' || left(new.coordinator_response, 120)
                    ELSE '' END
    ),
    jsonb_build_object(
      'repeater_id', new.repeater_id::text,
      'report_id',   new.id::text,
      'type',        'report_status_change',
      'new_status',  new.status::text
    )
  );

  RETURN new;
END;
$$;

CREATE TRIGGER trg_notify_user_on_report_status_change
  AFTER UPDATE ON public.repeater_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_report_status_change();

-- 4) Restringe la policy SELECT: ogni utente vede solo i propri report
--    (i manager vedono tutto tramite la policy RBAC già esistente)
DROP POLICY IF EXISTS "Authenticated can read all reports" ON public.repeater_reports;

CREATE POLICY "Users can read own reports"
  ON public.repeater_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "report_managers can read all reports"
  ON public.repeater_reports
  FOR SELECT
  TO authenticated
  USING (public.authorize('reports.manage'::public.app_permission));