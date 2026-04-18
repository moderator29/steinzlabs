# Session 5B-1 — Relayer Gap-Fill

Branch: `session-5b1-production`
Scope: wire the 4 monitor crons (limit orders, DCA, stop-loss/TP, copy trading) end-to-end via a non-custodial trade relayer.

## What was built

### Relayer core — `lib/trading/relayer.ts`
`executeTrade(intent)` runs three layers before recording a pending trade:
1. **GoPlus security gate** — blocks honeypots (trust < 40) and any token in `DANGER`/`trust < 20`. Native assets and GoPlus outages do not block.
2. **Best route discovery** — EVM routes aggregated via `getAllRoutes()` (1inch / Kyberswap / OpenOcean). Solana defers routing to the existing Jupiter quote at confirm time.
3. **Persist + notify** — inserts a `pending_trades` row (status `pending`, 10-min expiry) and best-effort Telegram notifies the user.

Never signs server-side. All wallet sources (`builtin`, `external_evm`, `external_solana`) go through the same client-confirm path.

### Non-custodial lock — `lib/trading/builtinSigner.ts`
Intentional stub. Throws `BuiltinAutoSigningNotSupported`. Documents the architectural decision so future contributors cannot accidentally wire server-side signing.

### Notifications — `lib/trading/notifications.ts`
Telegram push via `user_telegram_links`. Never throws.

### Monitor crons — all 4 replaced
- `app/api/cron/limit-order-monitor` — expires past `expires_at`, price check via DexScreener, triggers `above`/`below`; security-blocked orders set `status='failed'`.
- `app/api/cron/dca-executor` — respects `max_price_usd`/`min_price_usd` guards (records `skipped` execution + advances schedule); advances `next_execution_at` only after successful pending-trade so infra failures retry next run.
- `app/api/cron/stop-loss-monitor` — trailing stop updates `highest_price_seen` high-water mark, then evaluates trail → SL → TP in priority order.
- `app/api/cron/copy-trade-monitor` — oneclick follows only, 3-minute whale activity lookback, validates `user_copy_rules` (per-trade, daily cap, chains, blacklist, max slippage), dedupes by `source_tx_hash`, sizes USDC→token buys only.

### Pending trades API
- `GET /api/trading/pending-trades` — user's active pendings.
- `POST /api/trading/pending-trades/[id]/confirm` — user posts `txHash`; server marks confirmed and propagates to source table (`limit_orders` executed, `dca_bots` inserts `dca_executions` row + advances counters, `stop_loss_orders` records `triggered_tx_hash`, `user_copy_trades` marked success).
- `POST /api/trading/pending-trades/[id]/reject` — user rejects this firing.

### UI — `components/trading/PendingTradesBanner.tsx`
Mounted in `app/dashboard/layout.tsx`. Floating bottom-right, polls every 20s. Shows reason, chain, amount, expected out, expiry countdown, and inline GoPlus warning (honeypot / trust < 50). Signing delegates to `window.__nakaSignPendingTrade` (wallet layer) with a graceful `/dashboard/swap?pendingId=...` fallback.

Only existing design tokens used: `bg-slate-900/95`, `border-blue-500/30`, `bg-blue-600`.

### Cleanup cron
- `app/api/cron/pending-trades-cleanup` runs every 5 min — marks `status='expired'` on pending rows past `expires_at`.
- `vercel.json` now has 17 crons total.

## User-facing UX

For all 4 auto-trading features, the user experience is now:

1. User configures a limit order / DCA bot / stop-loss / copy-trade follow.
2. Monitor cron detects the trigger every 1–5 minutes.
3. GoPlus checks the token; honeypots/critical risks are blocked and the order marked failed.
4. Pending trade recorded + push to Telegram: **"Limit order ready to confirm. Open Naka Labs and tap Confirm within 10 minutes."**
5. User opens the app, sees the banner with details + warnings, clicks **Confirm in Wallet**.
6. Their wallet (MetaMask / Phantom / built-in in-browser signer) signs; the broadcast tx hash is posted back.
7. The source order is marked executed and the user's history reflects the trade.

This preserves non-custodial guarantees: private keys never leave the browser.

## Security posture

- GoPlus honeypot / critical-risk gate on every trigger.
- RLS on `pending_trades` restricts reads/writes to owning user; service role for crons.
- 10-minute expiry bounds replay risk for any stale signed intent.
- Cron endpoints continue to verify `CRON_SECRET`.
- `builtinSigner.ts` stub makes accidental custody impossible to slip in unnoticed.

## SQL to run

Paste into Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS pending_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_reason TEXT NOT NULL CHECK (source_reason IN (
    'limit_order', 'dca', 'stop_loss', 'take_profit', 'trail_stop', 'copy_trade'
  )),
  source_order_id UUID,
  source_order_table TEXT CHECK (source_order_table IN (
    'limit_orders', 'dca_bots', 'stop_loss_orders', 'user_copy_trades'
  )),
  chain TEXT NOT NULL,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN (
    'external_evm', 'external_solana', 'builtin'
  )),
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  amount_in NUMERIC NOT NULL,
  slippage_bps INTEGER NOT NULL DEFAULT 100,
  expected_amount_out NUMERIC,
  expected_price_usd NUMERIC,
  route_provider TEXT,
  route_data JSONB NOT NULL,
  security_trust_score INTEGER,
  security_is_honeypot BOOLEAN,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'rejected', 'expired', 'failed'
  )),
  confirmed_tx_hash TEXT,
  confirmed_at TIMESTAMPTZ,
  failure_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pending_trades_user_status_idx ON pending_trades(user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS pending_trades_source_idx ON pending_trades(source_order_table, source_order_id);
CREATE INDEX IF NOT EXISTS pending_trades_cleanup_idx ON pending_trades(expires_at) WHERE status = 'pending';
ALTER TABLE pending_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_pending_trades" ON pending_trades;
CREATE POLICY "users_own_pending_trades" ON pending_trades FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_pending_trades" ON pending_trades;
CREATE POLICY "service_role_pending_trades" ON pending_trades FOR ALL TO service_role USING (true);
CREATE OR REPLACE VIEW pending_trades_active AS SELECT * FROM pending_trades WHERE status = 'pending' AND expires_at > NOW();
GRANT SELECT ON pending_trades_active TO authenticated, service_role;
```

Full migration file: [supabase/migrations/2026_session5b1_relayer.sql](../supabase/migrations/2026_session5b1_relayer.sql).

## Still pending (5B-2 or later)

- **`window.__nakaSignPendingTrade` wallet adapter** — the banner delegates to this hook. Until the wallet layer implements it, users are redirected to `/dashboard/swap?pendingId=<id>` as a fallback; the swap page needs to read `pendingId` and auto-submit after signing. Low effort, one session.
- **On-chain receipt reconciliation cron** — today `executed_amount_out` and `executed_price` on confirm come from whatever the client posts. A follow-up cron reading receipts from Alchemy/Helius would harden this.
- **Copy-trade sell direction** — currently copies only buys. Selling to match whale exits requires position-lookup logic (user's current token balance), deferred.
- **Push notifications** — only Telegram wired. Browser push deferred until VAPID flow is live in the wallet-layer session.

## Items requiring user action

1. Run the SQL above in Supabase SQL Editor (creates `pending_trades` + view + RLS).
2. Create PR on GitHub from `session-5b1-production` → `main`, review, merge.
3. Vercel will pick up the new 17th cron automatically on deploy.

No env vars need adding.
