-- Add foreign key from repeater_feedback.user_id to profiles.id
-- so PostgREST can resolve the profiles!user_id join hint.
alter table public.repeater_feedback
  add constraint repeater_feedback_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
