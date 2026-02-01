-- =========================================================
-- Prerequisites for sync_repeater_iz8wnh Edge Function
-- =========================================================

-- 1) New enum values for access_mode
ALTER TYPE public.access_mode ADD VALUE IF NOT EXISTS 'ALLSTAR';
ALTER TYPE public.access_mode ADD VALUE IF NOT EXISTS 'WINLINK';

-- 2) Sync columns on repeaters
ALTER TABLE public.repeaters
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.repeaters
  ADD CONSTRAINT repeaters_external_id_unique UNIQUE (external_id);

-- 3) Sync columns on repeater_access
ALTER TABLE public.repeater_access
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.repeater_access
  ADD CONSTRAINT repeater_access_external_id_unique UNIQUE (external_id);

-- 4) Rename dmr_id to talkgroup (more universal: DMR TG, EchoLink Node, Wires-X Room, AllStar Node)
ALTER TABLE public.repeater_access RENAME COLUMN dmr_id TO talkgroup;
COMMENT ON COLUMN public.repeater_access.talkgroup IS
  'Virtual room/channel ID: DMR Talkgroup, EchoLink Node, Wires-X Room, AllStar Node';

-- 5) Seed networks used by the HamQRG API
INSERT INTO public.networks (name, kind) VALUES
  ('BrandMeister', 'dmr'),
  ('EchoLink', 'voip'),
  ('Wires-X', 'c4fm'),
  ('ADN', 'dmr'),
  ('ircDDB', 'dstar'),
  ('IT-DMR', 'dmr'),
  ('DMR+', 'dmr'),
  ('DMR-Marc', 'dmr'),
  ('AllStar', 'voip'),
  ('YSF', 'c4fm')
ON CONFLICT DO NOTHING;
