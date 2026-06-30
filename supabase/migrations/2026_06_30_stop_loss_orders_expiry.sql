-- Trailing Stop-Loss advanced order type (#66).
--
-- The stop_loss_orders table already carries the trailing fields
-- (trailing_stop_percent, highest_price_seen) and the stop-loss-monitor cron
-- already evaluates a trailing high-water mark. The only missing piece for the
-- MEVX-style "Trailing Stoploss Order" (Market / Limit / Trailing-SL with a
-- Trailing Delta % + expiry) is an optional expiry, mirroring limit_orders.
--
-- Adds:
--   expires_at  - optional UTC cutoff; the monitor flips active -> expired past
--                 this time (NULL = good-til-cancelled, the existing behavior).
--
-- Non-custodial: no execution/custody change. Idempotent.

alter table public.stop_loss_orders
  add column if not exists expires_at timestamptz;

-- Partial index so the monitor's expiry sweep (active rows with a deadline)
-- stays cheap as the table grows.
create index if not exists idx_stop_loss_orders_active_expires
  on public.stop_loss_orders (expires_at)
  where status = 'active' and expires_at is not null;
