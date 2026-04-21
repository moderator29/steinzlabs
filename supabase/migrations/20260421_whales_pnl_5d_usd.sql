-- §2.6 carry-over: add 5-day realized PnL window alongside the
-- existing 7d / 30d columns. The cron at /api/cron/whale-backfill-pnl
-- now computes a 5d FIFO PnL per whale so the whale directory can
-- surface a short-horizon view without changing the 7d/30d defaults.
ALTER TABLE public.whales
  ADD COLUMN IF NOT EXISTS pnl_5d_usd numeric;
