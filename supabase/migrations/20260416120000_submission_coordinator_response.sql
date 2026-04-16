-- =========================================================
-- Repeater Submissions: aggiunge risposta coordinatore,
-- responded_at, responded_by e aggiorna il trigger notifica
-- (stesso pattern di report_coordinator_response)
-- =========================================================

-- 1) Nuove colonne
ALTER TABLE public.repeater_submissions
  ADD COLUMN coordinator_response text,
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) Aggiorna il trigger di notifica per includere la risposta
CREATE OR REPLACE FUNCTION public.notify_user_on_submission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _label text;
  _status_label_en text;
  _status_label_it text;
BEGIN
  -- Solo se lo stato è effettivamente cambiato
  IF old.status IS NOT DISTINCT FROM new.status THEN
    RETURN new;
  END IF;

  -- Etichetta ripetitore (callsign o name)
  _label := coalesce(new.callsign, new.name, 'Repeater');

  -- Traduzioni stato
  _status_label_en := CASE new.status
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    ELSE new.status::text
  END;

  _status_label_it := CASE new.status
    WHEN 'approved' THEN 'approvata'
    WHEN 'rejected' THEN 'rifiutata'
    ELSE new.status::text
  END;

  INSERT INTO public.user_notifications (user_id, headings, contents, data)
  VALUES (
    new.user_id,
    jsonb_build_object(
      'en', 'Submission update — ' || _label,
      'it', 'Aggiornamento segnalazione — ' || _label
    ),
    jsonb_build_object(
      'en', 'Your submission for ' || _label || ' has been ' || _status_label_en
            || CASE WHEN new.coordinator_response IS NOT NULL
                    THEN ': ' || left(new.coordinator_response, 120)
                    ELSE '' END,
      'it', 'La tua segnalazione per ' || _label || ' è stata ' || _status_label_it
            || CASE WHEN new.coordinator_response IS NOT NULL
                    THEN ': ' || left(new.coordinator_response, 120)
                    ELSE '' END
    ),
    jsonb_build_object(
      'submission_id', new.id::text,
      'type',          'submission_status_change',
      'new_status',    new.status::text
    )
  );

  RETURN new;
END;
$$;
