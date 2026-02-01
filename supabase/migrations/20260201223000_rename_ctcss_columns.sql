-- =========================================================
-- Rename ctcss_hz → ctcss_tx_hz and add ctcss_rx_hz
-- (aligns DB schema with database.types.ts and code)
-- =========================================================

-- 1) Rename existing column
ALTER TABLE public.repeater_access RENAME COLUMN ctcss_hz TO ctcss_tx_hz;

-- 2) Add ctcss_rx_hz column
ALTER TABLE public.repeater_access
  ADD COLUMN IF NOT EXISTS ctcss_rx_hz numeric(6,1) NULL;

-- 3) Update check constraint
ALTER TABLE public.repeater_access DROP CONSTRAINT IF EXISTS repeater_access_ctcss_ck;
ALTER TABLE public.repeater_access
  ADD CONSTRAINT repeater_access_ctcss_tx_ck
    CHECK (ctcss_tx_hz IS NULL OR (ctcss_tx_hz >= 0 AND ctcss_tx_hz <= 300));
ALTER TABLE public.repeater_access
  ADD CONSTRAINT repeater_access_ctcss_rx_ck
    CHECK (ctcss_rx_hz IS NULL OR (ctcss_rx_hz >= 0 AND ctcss_rx_hz <= 300));

-- 4) Recreate index on new column name
DROP INDEX IF EXISTS repeater_access_ctcss_idx;
CREATE INDEX repeater_access_ctcss_tx_idx ON public.repeater_access (ctcss_tx_hz);
CREATE INDEX repeater_access_ctcss_rx_idx ON public.repeater_access (ctcss_rx_hz);
