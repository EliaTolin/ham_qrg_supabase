-- Add direct FK user_favorite_repeaters.user_id → profiles(id) for
-- PostgREST embedding support. The existing FK points to auth.users,
-- which PostgREST cannot resolve through a join.

ALTER TABLE public.user_favorite_repeaters
  ADD CONSTRAINT user_favorite_repeaters_profile_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE
