-- #P1: whale-backfill-pnl used last_active_at both as the staleness selector
-- (ORDER BY / WHERE) AND overwrote it with the on-chain activity timestamp —
-- self-poisoning. Dedicated refresh cursor so last_active_at stays pure
-- on-chain and metrics rotate by how stale they actually are.
ALTER TABLE public.whales ADD COLUMN IF NOT EXISTS metrics_refreshed_at timestamptz;
