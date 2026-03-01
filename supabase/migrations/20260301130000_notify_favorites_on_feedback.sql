-- =========================================================
-- Trigger: notifica gli utenti che hanno nei preferiti
-- un ripetitore che ha ricevuto un nuovo feedback
-- =========================================================

create or replace function public.notify_favorites_on_feedback()
returns trigger
language plpgsql
security definer
as $$
declare
  _repeater_label text;
  _fav_user_id uuid;
begin
  -- Recupera callsign o name del ripetitore
  select coalesce(r.callsign, r.name, 'Repeater')
    into _repeater_label
    from public.repeaters r
    where r.id = new.repeater_id;

  -- Per ogni utente che ha questo ripetitore nei preferiti (escluso chi ha lasciato il feedback)
  for _fav_user_id in
    select ufr.user_id
      from public.user_favorite_repeaters ufr
      where ufr.repeater_id = new.repeater_id
        and ufr.user_id <> new.user_id
  loop
    insert into public.user_notifications (user_id, headings, contents, data)
    values (
      _fav_user_id,
      jsonb_build_object(
        'en', 'New feedback on ' || _repeater_label,
        'it', 'Nuovo feedback su ' || _repeater_label
      ),
      jsonb_build_object(
        'en', 'Your favorite repeater ' || _repeater_label || ' received a ' || new.type::text,
        'it', 'Il tuo ponte preferito ' || _repeater_label || ' ha ricevuto un ' || new.type::text
      ),
      jsonb_build_object(
        'repeater_id', new.repeater_id::text,
        'type', 'new_feedback',
        'feedback_type', new.type::text
      )
    );
  end loop;

  return new;
end;
$$;

create trigger trg_notify_favorites_on_feedback
  after insert on public.repeater_feedback
  for each row
  execute function public.notify_favorites_on_feedback();
