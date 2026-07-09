-- Fix realized-PnL double count (applied live via MCP, mirrored here for VC).
-- receipt-reconciliation marked a matched BUY as "consumed" by writing pnl_usd
-- to it (identical to the sell leg), so every consumer that sums/filters pnl_usd
-- counted a single round trip twice (2x dashboard PnL, inflated reputation
-- win-rate + performance percentile). Add a dedicated marker column so a buy can
-- be marked consumed without contributing a pnl_usd value; realized pnl now
-- lives only on the sell row.
ALTER TABLE public.user_copy_trades ADD COLUMN IF NOT EXISTS pnl_matched_at timestamptz;

-- Backfill existing buy legs: they were "consumed" by writing pnl_usd (buys never
-- legitimately carry a realized pnl_usd; only sells compute it). Move the marker
-- to the new column and null the value so historical aggregates stop double
-- counting.
UPDATE public.user_copy_trades
   SET pnl_matched_at = COALESCE(receipt_reconciled_at, now()),
       pnl_usd = NULL
 WHERE action = 'buy' AND pnl_usd IS NOT NULL;
