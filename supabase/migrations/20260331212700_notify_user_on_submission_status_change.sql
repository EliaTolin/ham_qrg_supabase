-- =========================================================
-- Notifica l'utente quando lo stato della sua submission cambia
-- (stesso pattern di notify_user_on_report_status_change)
-- =========================================================

create or replace function public.notify_user_on_submission_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  _label text;
  _status_label_en text;
  _status_label_it text;
begin
  -- Solo se lo stato è effettivamente cambiato
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Etichetta ripetitore (callsign o name)
  _label := coalesce(new.callsign, new.name, 'Repeater');

  -- Traduzioni stato
  _status_label_en := case new.status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    else new.status::text
  end;

  _status_label_it := case new.status
    when 'approved' then 'approvata'
    when 'rejected' then 'rifiutata'
    else new.status::text
  end;

  insert into public.user_notifications (user_id, headings, contents, data)
  values (
    new.user_id,
    jsonb_build_object(
      'en', 'Submission update — ' || _label,
      'it', 'Aggiornamento segnalazione — ' || _label
    ),
    jsonb_build_object(
      'en', 'Your submission for ' || _label || ' has been ' || _status_label_en,
      'it', 'La tua segnalazione per ' || _label || ' è stata ' || _status_label_it
    ),
    jsonb_build_object(
      'submission_id', new.id::text,
      'type',          'submission_status_change',
      'new_status',    new.status::text
    )
  );

  return new;
end;
$$;

create trigger trg_notify_user_on_submission_status_change
  after update on public.repeater_submissions
  for each row
  execute function public.notify_user_on_submission_status_change();
