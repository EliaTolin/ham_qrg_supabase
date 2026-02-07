-- Add node_id column to repeater_access and copy existing talkgroup values.
-- talkgroup is kept for now to avoid breaking the frontend.

ALTER TABLE public.repeater_access
  ADD COLUMN IF NOT EXISTS node_id integer;

COMMENT ON COLUMN public.repeater_access.node_id IS
  'Virtual room/channel ID: DMR Talkgroup, EchoLink Node, Wires-X Room, AllStar Node';

-- Copy existing talkgroup values into node_id
UPDATE public.repeater_access
   SET node_id = talkgroup
 WHERE talkgroup IS NOT NULL;
