-- =========================================================
-- Queue-based async sync: pgmq queue + sync_runs tracking
-- =========================================================

-- 1) Enable pgmq extension
CREATE EXTENSION IF NOT EXISTS pgmq;

-- 2) Create the queue
SELECT pgmq.create('sync_repeater_iz8wnh_queue');

-- 3) Sync run tracking table
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  dry_run     BOOLEAN NOT NULL DEFAULT false,

  total_messages      INT NOT NULL DEFAULT 0,
  processed_messages  INT NOT NULL DEFAULT 0,

  repeaters_processed INT NOT NULL DEFAULT 0,
  access_processed    INT NOT NULL DEFAULT 0,
  fetch_errors        INT NOT NULL DEFAULT 0,
  sync_errors         INT NOT NULL DEFAULT 0,

  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled, no policies = service role only
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- 4) Public wrappers for pgmq (schema not exposed via PostgREST)

CREATE OR REPLACE FUNCTION public.queue_send_batch(
  p_queue_name TEXT,
  p_msgs       JSONB[]
)
RETURNS SETOF BIGINT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.send_batch(p_queue_name, p_msgs);
$$;

CREATE OR REPLACE FUNCTION public.queue_read(
  p_queue_name TEXT,
  p_vt         INTEGER,
  p_qty        INTEGER
)
RETURNS TABLE(msg_id BIGINT, read_ct INTEGER, enqueued_at TIMESTAMPTZ, vt TIMESTAMPTZ, message JSONB)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT msg_id, read_ct, enqueued_at, vt, message
  FROM pgmq.read(p_queue_name, p_vt, p_qty);
$$;

CREATE OR REPLACE FUNCTION public.queue_delete(
  p_queue_name TEXT,
  p_msg_id     BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.delete(p_queue_name, p_msg_id);
$$;

-- 5) Atomic stat increment function
CREATE OR REPLACE FUNCTION public.increment_sync_run_stats(
  p_run_id              UUID,
  p_repeaters_processed INT DEFAULT 0,
  p_access_processed    INT DEFAULT 0,
  p_fetch_errors        INT DEFAULT 0,
  p_sync_errors         INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.sync_runs
  SET
    processed_messages  = processed_messages + 1,
    repeaters_processed = repeaters_processed + p_repeaters_processed,
    access_processed    = access_processed    + p_access_processed,
    fetch_errors        = fetch_errors        + p_fetch_errors,
    sync_errors         = sync_errors         + p_sync_errors,
    status = CASE
      WHEN processed_messages + 1 >= total_messages THEN 'completed'
      ELSE 'in_progress'
    END,
    completed_at = CASE
      WHEN processed_messages + 1 >= total_messages THEN now()
      ELSE NULL
    END
  WHERE id = p_run_id;
END;
$$;
