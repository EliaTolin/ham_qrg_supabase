-- Add foreign key constraint to repeaters table
alter table public.user_favorite_repeaters
  add constraint user_favorite_repeaters_repeater_id_fkey
  foreign key (repeater_id)
  references public.repeaters (id)
  on delete cascade;
