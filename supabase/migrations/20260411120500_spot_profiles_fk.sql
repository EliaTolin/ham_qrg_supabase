-- Add direct FK user_id → profiles(id) for PostgREST embedding support.
-- Without this, `profiles!user_id(...)` fails because the relationship
-- goes through auth.users which PostgREST cannot resolve.

ALTER TABLE public.repeater_spots
  ADD CONSTRAINT repeater_spots_profile_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE
