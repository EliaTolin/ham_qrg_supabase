alter table public.repeater_feedback
add column repeater_access_id uuid not null references public.repeater_access(id) on delete cascade;

-- Permette un feedback per ogni tipo di accesso (invece che uno solo per ripetitore)
drop index if exists public.repeater_feedback_one_per_user_per_repeater;

create unique index repeater_feedback_one_per_user_per_access
  on public.repeater_feedback (repeater_access_id, user_id);