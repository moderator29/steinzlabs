-- §11 Bubble Map timeline: write-on-read snapshots need a way to
-- de-duplicate within a calendar day. Add a generated date column and
-- a UNIQUE index on (token_address, chain, snap_date) so the upsert
-- in /api/intelligence/holders/[token]/route.ts can use
-- onConflict='token_address,chain,snap_date' safely.
--
-- Idempotent — every statement is IF NOT EXISTS.

-- date_trunc on a timestamptz isn't immutable (depends on session tz),
-- so wrap with AT TIME ZONE 'UTC' for stability across sessions.
ALTER TABLE public.holder_snapshots
  ADD COLUMN IF NOT EXISTS snap_date date
  GENERATED ALWAYS AS (((snapped_at AT TIME ZONE 'UTC')::date)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_holder_snapshots_token_chain_day
  ON public.holder_snapshots (token_address, chain, snap_date);

-- Speed up the timeline read endpoint (filter by token + chain, sort by snapped_at).
CREATE INDEX IF NOT EXISTS idx_holder_snapshots_token_chain_snapped
  ON public.holder_snapshots (token_address, chain, snapped_at);
