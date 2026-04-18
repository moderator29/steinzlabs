═══════════════════════════════════════════════════════════════════════════
NAKA LABS — SESSION 5B-1: INSTITUTIONAL TRADING TERMINAL, WHALE TRACKER,
WALLET CLUSTERS, VTX AGENT PAGE REDESIGN, SWAP NEXT-GEN UPGRADE,
SECURITY PAGES UPGRADE, ALL FEATURES UPGRADED
═══════════════════════════════════════════════════════════════════════════

You are a senior full-stack engineer operating at a top 1% level. You have shipped at Coinbase, Uniswap, Nansen, Arkham, DeBank, Phantom, Hyperliquid, GMX. Your reputation depends on this work being institutional-grade. Every UI you produce must feel native to the Naka Labs platform and match Nansen/Arkham/DeBank quality bar.

═══════════════════════════════════════════════════════════════════════════
ABSOLUTE SESSION RULES — READ BEFORE ANY ACTION
═══════════════════════════════════════════════════════════════════════════

1. STAGED EXECUTION — THIS IS THE MOST IMPORTANT RULE:
   - BATCH 1 = Phases 1 through 7 — run all 7 phases to completion, commit each phase, push after each phase, then STOP. Report status. Output Batch 1 SQL migrations for user to run in Supabase. Wait for user to say "Continue with Batch 2".
   - BATCH 2 = Phases 8 through 13 — only start when user explicitly says "Continue with Batch 2". Run all 6 phases to completion. Deliver final comprehensive platform audit at end. STOP.

2. WORK FULLY AUTONOMOUSLY WITHIN A BATCH. Do NOT stop between phases within a batch. Do NOT ask for permission. Do NOT pause to confirm. Push all phases in the batch to completion before stopping.

3. Commit to branch "session-5b1-production" after EVERY phase. Push to origin after EVERY phase. Never lose work.

4. NO placeholder code. NO "any" types. NO mock data. NO fake numbers. NO hardcoded stats. NO "demo" strings. NO TODO comments. NO "coming soon" unless feature explicitly deferred to Session 5C with documented reason.

5. UPGRADE existing code. Read the current file FIRST. Understand it. Then improve it. Do NOT rewrite working code from scratch unless this prompt explicitly says "DELETE AND REBUILD".

6. When this prompt says DELETE AND REBUILD, fully delete the old implementation and build the new one from the architecture spec in this prompt.

7. After fixing bugs or making major changes: show the old code in a comment prefix, show the new code. Prove the change.

8. NO markdown in AI responses from VTX, Customer Support, or any AI chat agent. NO em dashes. NO asterisks. NO bold markers in chat output. Plain clean text only with numbered lists.

9. Fix TypeScript errors immediately when you encounter them. Never leave broken builds.

10. BRANDING IS LOCKED — DO NOT CHANGE ANY COLOR, CSS VARIABLE, DESIGN TOKEN, OR AESTHETIC:
    - READ /app/globals.css and /tailwind.config.ts FIRST to understand the existing design system
    - Primary brand blue: neon electric blue (whatever CSS variable exists — keep exactly as-is)
    - Background: deep space navy (#05081e or bg-slate-950 or whatever's defined)
    - Cards: bg-slate-900/50 with border-slate-800
    - Accents: blue-500/30 rings, blue glow shadows
    - Status colors: green for bullish, red for bearish, amber for warnings
    - Text hierarchy: white primary, slate-400 secondary, slate-500 tertiary
    - Font stack: existing
    - Every new component must use ONLY existing design tokens
    - If you need a new semantic color, ADD IT to the existing system — don't replace any existing color
    - Every new component must feel native to Naka Labs, not bolted on

11. INSTITUTIONAL-GRADE EXECUTION STANDARD:
    - Data-dense, not padding-heavy
    - Sharp typography
    - Tight spacing (not generous whitespace)
    - Professional numbers (monospace for addresses, tabular for stats)
    - Every table scrollable horizontally on mobile
    - Every chart responsive
    - Every interaction has loading + error + empty states
    - Every API call has timeout + retry + Sentry capture
    - Every Supabase query uses lazy init pattern (no module-level createClient)
    - Match Nansen, Arkham, DeBank — NOT Coinbase Pro, not Robinhood, not Binance consumer app

───────────────────────────────────────────────────────────────────────────
TIMEOUT + NETWORK RESILIENCE (CRITICAL)
───────────────────────────────────────────────────────────────────────────

If you encounter stream idle timeout, API timeout, socket closed, or network error:
1. Note EXACTLY where you stopped: file path, line number, phase, task
2. Type: TIMEOUT OCCURRED — RESUMING FROM: [exact location]
3. Continue from that exact point
4. NEVER restart a phase from the beginning

If a specific file edit fails 3 times:
1. Skip it
2. Add the filename and error to /docs/session-5b1-skipped.md
3. Continue with next task
4. Revisit skipped files at end of the batch

Commit after every task that touches 3+ files. Small commits = never lose work.

Write progress to /docs/session-5b1-progress.md after each phase. Include file count, key changes, git commit hash.

───────────────────────────────────────────────────────────────────────────
BRANCH + COMMIT DISCIPLINE
───────────────────────────────────────────────────────────────────────────

Start session:
```
git checkout main
git pull origin main
git checkout -b session-5b1-production
git push -u origin session-5b1-production
```

After every phase:
```
git add .
git commit -m "Phase X complete: [2-line description]"
git push origin session-5b1-production
```

DO NOT create pull requests. User creates them manually on GitHub after each batch is reported complete.

Acknowledge rules in ONE line then begin Phase 1.

═══════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════

Platform: Naka Labs (brand), codebase uses "steinzlabs" internally
Stack: Next.js 14 App Router, Supabase, Vercel Pro, TypeScript, Tailwind, @supabase/ssr
Branch: session-5b1-production (from main after Session 5A merge)
Vercel Plan: PRO (upgraded — crons now work)

SESSION 5A DELIVERED (already merged to main):
- Naka Labs brand migration
- Upstash Redis cache layer (/lib/cache/redis.ts)
- fetchWithRetry utility (/lib/api/fetchWithRetry.ts)
- Turnstile login hotfix (useSessionGuard legacy cookie bug fixed)
- Dashboard redesign: CompactKpiBar, PersonalizedHome, MiniVtxPanel, Global Search with Cmd+K
- Context Feed 3-layer filter ($500K mcap gate, signal priority, personal boost)
- Telegram bot (/start, /link, /status, /unlink commands)
- VTX page wrapped in Suspense with ?q= and ?conversation=<id> support
- Foundation Supabase tables: naka_prompts (7 seeded), cluster_cache, market_stats_history, smart_money_rankings
- Auth tables: auth_wallet_nonces, wallet_identities, user_telegram_links

ENV VARS ALREADY IN VERCEL:
All Supabase keys, Alchemy, Anthropic, Resend, 0x, Jupiter, CoinGecko, DexScreener, Helius, Birdeye, Arkham, LunarCrush, GoPlus, Turnstile, Sentry, PostHog, JWT_SECRET, SUPABASE_JWT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, VAPID keys, CRON_SECRET.

USER DIRECTIVES FOR SESSION 5B-1:
- Every feature gets upgraded (not new builds where code exists — UPGRADE what's there)
- Real-only: no mock, no placeholder, no fake data, no "coming soon" unless explicitly deferred
- Branding locked (Rule 10)
- Staged execution (Rule 1) — 4 phases, stop; 3 phases, stop; 3 phases, stop; 3 phases + final audit
- Final deliverable (Phase 13): comprehensive audit of ENTIRE platform with Session 5B-2 / 5C recommendations

WHAT SESSION 5B-1 COVERS (13 phases across 2 batches):

BATCH 1 (Phases 1-7) — TRADING INFRASTRUCTURE + WHALE + CLUSTERS:
  Phase 1: Vercel cron restore + Batch 1 SQL migration foundation + GoPlus client
  Phase 2: Real Trading Terminal UI — multi-timeframe charts, indicators, drawing tools
  Phase 3: Limit Orders + DCA Bots + Stop-Loss/Take-Profit backend + UI
  Phase 4: Swap Page Next-Gen Upgrade — multi-route aggregation, MEV protection, execution intelligence
  Phase 5: Whale Tracker Full Build — 5,000 curated whales, submission system, SSE-ready
  Phase 6: One-Click Copy Trading with safety rails
  Phase 7: Wallet Clusters Full Build — 5 detection algorithms, 2D graph default, 3D toggle, community labels

BATCH 2 (Phases 8-13) — INTELLIGENCE + SECURITY + REAL-TIME + AUDIT:
  Phase 8: VTX Agent Page Full Institutional Redesign (3-column, tool use, trade-in-chat)
  Phase 9: Security Pages Upgrade — Security Scanner, Contract Intelligence, Approval Manager, all security sub-pages
  Phase 10: Wallet Intelligence institutional redesign (6-tab deep profile, Alpha Report)
  Phase 11: Real-time SSE infrastructure for Whale Tracker + Sniper Bot
  Phase 12: Session 5B-1 self-audit + fix all issues found
  Phase 13: Comprehensive platform audit + Session 5B-2 recommendations

═══════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════
BATCH 1 — PHASES 1-7: TRADING INFRASTRUCTURE + WHALE + CLUSTERS
═══════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════

Execute Phases 1 through 7 consecutively. Do NOT stop between phases within this batch. After Phase 7 is committed and pushed, STOP. Output all SQL migrations for user to run in Supabase. Report status. Wait for user to say "Continue with Batch 2".

═══════════════════════════════════════════════════════════════════════════
PHASE 1 — VERCEL CRON RESTORE + BATCH 1 SQL FOUNDATION
═══════════════════════════════════════════════════════════════════════════

── TASK 1.1: RESTORE VERCEL.JSON CRON SCHEDULE ──

Read /docs/vercel-cron-schedule-pending.md which contains the cron config backup from Session 5A.

Recreate /vercel.json at project root with the exact content from the backup:

```json
{
  "crons": [
    { "path": "/api/cron/context-feed-poll", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/whale-activity-poll", "schedule": "*/1 * * * *" },
    { "path": "/api/cron/smart-money-ranking", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/cluster-analysis", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/network-metrics", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/trends-aggregator", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/narrative-detection", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/fear-greed-index", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/alert-monitor", "schedule": "*/1 * * * *" },
    { "path": "/api/cron/market-stats-snapshot", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/daily-digest", "schedule": "0 9 * * *" }
  ]
}
```

Add additional crons needed for Session 5B-1 features:
```json
{ "path": "/api/cron/limit-order-monitor", "schedule": "*/1 * * * *" },
{ "path": "/api/cron/dca-executor", "schedule": "*/5 * * * *" },
{ "path": "/api/cron/stop-loss-monitor", "schedule": "*/1 * * * *" },
{ "path": "/api/cron/whale-ranking-refresh", "schedule": "0 */4 * * *" },
{ "path": "/api/cron/copy-trade-monitor", "schedule": "*/1 * * * *" }
```

Full final /vercel.json should have all 16 crons.

Remove any "NOTE: Not currently scheduled" comments from Session 5A cron endpoint files.

── TASK 1.2: SQL MIGRATION FOR BATCH 1 ──

Create /supabase/migrations/2026_session5b1_batch1.sql with these tables. Output the FULL SQL as a code block in your end-of-phase report for user to run in Supabase SQL Editor.

```sql
-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS SESSION 5B-1 BATCH 1 MIGRATION
-- Trading terminal: limit orders, DCA bots, stop-loss/TP
-- Swap: route analytics, execution history enhancement
-- Run ONCE in Supabase SQL Editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- LIMIT ORDERS
CREATE TABLE IF NOT EXISTS limit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  from_token_logo TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  to_token_logo TEXT,
  from_amount NUMERIC NOT NULL,
  trigger_price_usd NUMERIC NOT NULL,
  trigger_direction TEXT NOT NULL CHECK (trigger_direction IN ('above', 'below')),
  slippage_bps INTEGER DEFAULT 100,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'executed', 'cancelled', 'expired', 'failed')),
  executed_at TIMESTAMPTZ,
  executed_tx_hash TEXT,
  executed_amount_out NUMERIC,
  executed_price NUMERIC,
  failure_reason TEXT,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS limit_orders_user_status_idx ON limit_orders(user_id, status);
CREATE INDEX IF NOT EXISTS limit_orders_active_monitoring_idx ON limit_orders(status, trigger_price_usd) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS limit_orders_token_idx ON limit_orders(to_token_address, status) WHERE status = 'active';
ALTER TABLE limit_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_limit_orders" ON limit_orders;
CREATE POLICY "users_own_limit_orders" ON limit_orders FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_limit_orders" ON limit_orders;
CREATE POLICY "service_role_limit_orders" ON limit_orders FOR ALL TO service_role USING (true);

-- DCA BOTS
CREATE TABLE IF NOT EXISTS dca_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  from_token_address TEXT NOT NULL,
  from_token_symbol TEXT,
  from_token_logo TEXT,
  to_token_address TEXT NOT NULL,
  to_token_symbol TEXT,
  to_token_logo TEXT,
  amount_per_execution NUMERIC NOT NULL,
  interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 3600),
  total_executions INTEGER,
  executions_completed INTEGER DEFAULT 0,
  total_invested_usd NUMERIC DEFAULT 0,
  total_received_amount NUMERIC DEFAULT 0,
  avg_entry_price NUMERIC,
  next_execution_at TIMESTAMPTZ NOT NULL,
  last_execution_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
  slippage_bps INTEGER DEFAULT 100,
  max_price_usd NUMERIC,
  min_price_usd NUMERIC,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dca_bots_user_status_idx ON dca_bots(user_id, status);
CREATE INDEX IF NOT EXISTS dca_bots_next_execution_idx ON dca_bots(next_execution_at) WHERE status = 'active';
ALTER TABLE dca_bots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_dca_bots" ON dca_bots;
CREATE POLICY "users_own_dca_bots" ON dca_bots FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_dca_bots" ON dca_bots;
CREATE POLICY "service_role_dca_bots" ON dca_bots FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS dca_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES dca_bots(id) ON DELETE CASCADE,
  execution_number INTEGER NOT NULL,
  tx_hash TEXT,
  amount_in NUMERIC NOT NULL,
  amount_out NUMERIC,
  price_at_execution NUMERIC,
  gas_usd NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  failure_reason TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dca_executions_bot_idx ON dca_executions(bot_id, executed_at DESC);
ALTER TABLE dca_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_dca_executions" ON dca_executions;
CREATE POLICY "users_read_own_dca_executions" ON dca_executions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM dca_bots WHERE dca_bots.id = dca_executions.bot_id AND dca_bots.user_id = auth.uid())
);
DROP POLICY IF EXISTS "service_role_dca_executions" ON dca_executions;
CREATE POLICY "service_role_dca_executions" ON dca_executions FOR ALL TO service_role USING (true);

-- STOP LOSS / TAKE PROFIT
CREATE TABLE IF NOT EXISTS stop_loss_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  token_logo TEXT,
  position_amount NUMERIC NOT NULL,
  entry_price_usd NUMERIC,
  stop_loss_price_usd NUMERIC,
  take_profit_price_usd NUMERIC,
  trailing_stop_percent NUMERIC,
  highest_price_seen NUMERIC,
  exit_to_token_address TEXT NOT NULL,
  exit_to_token_symbol TEXT,
  slippage_bps INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered_sl', 'triggered_tp', 'triggered_trail', 'cancelled', 'expired', 'failed')),
  triggered_at TIMESTAMPTZ,
  triggered_tx_hash TEXT,
  triggered_price NUMERIC,
  realized_pnl_usd NUMERIC,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('external_evm', 'external_solana', 'builtin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stop_loss_user_status_idx ON stop_loss_orders(user_id, status);
CREATE INDEX IF NOT EXISTS stop_loss_active_idx ON stop_loss_orders(token_address, status) WHERE status = 'active';
ALTER TABLE stop_loss_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_stop_loss" ON stop_loss_orders;
CREATE POLICY "users_own_stop_loss" ON stop_loss_orders FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_stop_loss" ON stop_loss_orders;
CREATE POLICY "service_role_stop_loss" ON stop_loss_orders FOR ALL TO service_role USING (true);

-- SWAP ROUTE ANALYTICS
CREATE TABLE IF NOT EXISTS swap_route_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('0x', 'jupiter', '1inch', 'cowswap', 'kyberswap', 'openocean')),
  quote_price NUMERIC,
  executed_price NUMERIC,
  price_impact_bps INTEGER,
  slippage_bps INTEGER,
  gas_usd NUMERIC,
  savings_vs_next_best_usd NUMERIC,
  mev_protection_used BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tx_hash TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS swap_route_pair_idx ON swap_route_analytics(from_token, to_token, captured_at DESC);
CREATE INDEX IF NOT EXISTS swap_route_provider_idx ON swap_route_analytics(provider, captured_at DESC);
ALTER TABLE swap_route_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_swap_analytics" ON swap_route_analytics;
CREATE POLICY "authenticated_read_swap_analytics" ON swap_route_analytics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_swap_analytics" ON swap_route_analytics;
CREATE POLICY "service_role_swap_analytics" ON swap_route_analytics FOR ALL TO service_role USING (true);

-- TRADING PREFERENCES PER USER
CREATE TABLE IF NOT EXISTS user_trading_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_slippage_bps INTEGER DEFAULT 100,
  expert_mode BOOLEAN DEFAULT false,
  auto_approve_under_usd NUMERIC DEFAULT 0,
  preferred_dex_route TEXT DEFAULT 'best_price',
  mev_protection_enabled BOOLEAN DEFAULT true,
  default_chart_timeframe TEXT DEFAULT '1h',
  default_indicators JSONB DEFAULT '["ema_20", "ema_50"]'::jsonb,
  last_used_token_from TEXT,
  last_used_token_to TEXT,
  last_used_chain TEXT,
  favorite_pairs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_trading_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_trading_prefs" ON user_trading_preferences;
CREATE POLICY "users_own_trading_prefs" ON user_trading_preferences FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_trading_prefs" ON user_trading_preferences;
CREATE POLICY "service_role_trading_prefs" ON user_trading_preferences FOR ALL TO service_role USING (true);

-- CHART DRAWINGS PERSISTENCE
CREATE TABLE IF NOT EXISTS user_chart_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  drawings JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token_address, chain)
);
CREATE INDEX IF NOT EXISTS chart_drawings_user_token_idx ON user_chart_drawings(user_id, token_address);
ALTER TABLE user_chart_drawings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_drawings" ON user_chart_drawings;
CREATE POLICY "users_own_drawings" ON user_chart_drawings FOR ALL TO authenticated USING (user_id = auth.uid());

-- PRICE ALERT FROM CHART
CREATE TABLE IF NOT EXISTS chart_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  token_symbol TEXT,
  trigger_price_usd NUMERIC NOT NULL,
  trigger_direction TEXT NOT NULL CHECK (trigger_direction IN ('above', 'below')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
  notification_channels JSONB DEFAULT '["push", "telegram"]'::jsonb,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chart_alerts_user_idx ON chart_price_alerts(user_id, status);
CREATE INDEX IF NOT EXISTS chart_alerts_monitoring_idx ON chart_price_alerts(token_address, status) WHERE status = 'active';
ALTER TABLE chart_price_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_chart_alerts" ON chart_price_alerts;
CREATE POLICY "users_own_chart_alerts" ON chart_price_alerts FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_chart_alerts" ON chart_price_alerts;
CREATE POLICY "service_role_chart_alerts" ON chart_price_alerts FOR ALL TO service_role USING (true);
```

Output full SQL in end-of-phase report. Write user instructions to /docs/session-5b1-batch1-migration.md.

── TASK 1.3: COMMIT PHASE 1 ──

```
git add .
git commit -m "Phase 1: Restore Vercel cron schedule (Pro plan); create Batch 1 SQL migrations for trading terminal + swap analytics"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 2 — REAL TRADING TERMINAL UI (MULTI-TIMEFRAME + INDICATORS + DRAWING)
═══════════════════════════════════════════════════════════════════════════

Current /app/dashboard/trading-suite/page.tsx is a "coming soon" marketing page. Current /components/market/CandlestickChart.tsx is basic chart. Both need major upgrade.

── TASK 2.1: DELETE AND REBUILD TRADING SUITE PAGE ──

DELETE AND REBUILD /app/dashboard/trading-suite/page.tsx as the real institutional trading terminal.

New structure:
```tsx
"use client";
import { Suspense } from "react";
import { TradingTerminalLayout } from "@/components/trading/TradingTerminalLayout";
import { NakaLoader } from "@/components/brand/NakaLoader";

export default function TradingSuitePage() {
  return (
    <Suspense fallback={<NakaLoader text="Loading trading terminal..." />}>
      <TradingTerminalLayout />
    </Suspense>
  );
}
```

── TASK 2.2: TRADING TERMINAL LAYOUT ──

Create /components/trading/TradingTerminalLayout.tsx:

Grid layout (desktop):
- TOP BAR (48px): chain selector | pair selector (with search) | price | 24h change | 24h vol | market cap | liquidity
- LEFT MAIN (70%): advanced candlestick chart with toolbar
- RIGHT SIDEBAR (30%): tabs for [Order Form | Positions | Orders | Alerts]
- BOTTOM BAR (200px, collapsible): tabs for [Open Orders | Order History | Trades | Positions | DCA Bots | Stop-Loss]

Mobile layout:
- Stacked: pair selector → price → chart (full width) → order form tab → collapsible bottom panels

Use existing CSS tokens (bg-slate-900/50, border-slate-800, etc.). Institutional grid lines. Monospace numbers.

── TASK 2.3: ADVANCED CANDLESTICK CHART ──

UPGRADE /components/market/CandlestickChart.tsx to institutional level:

Install: npm install lightweight-charts@5 (if older version, upgrade)

Features:
- Timeframe selector bar: 1m / 5m / 15m / 1h / 4h / 1d / 1w / 1M (persisted to user_trading_preferences.default_chart_timeframe)
- Chart type toggle: Candlestick / Line / Area / Bars
- Indicators menu (multi-select from dropdown):
  - SMA (20, 50, 200)
  - EMA (9, 21, 50, 200)
  - RSI (14)
  - MACD (12, 26, 9)
  - Bollinger Bands (20, 2)
  - Volume Profile
  - VWAP
- Drawing tools toolbar (left edge of chart):
  - Cursor (default)
  - Trend line
  - Horizontal line (support/resistance)
  - Rectangle / zone
  - Fibonacci retracement
  - Price label
  - Clear all button
- Drawings persisted to user_chart_drawings table per user+token
- Click on price level with horizontal line tool → offers "Create alert at $X" → saves to chart_price_alerts
- Crosshair with OHLCV tooltip
- Compare mode: button to add second token overlay (up to 3 comparisons, normalized %)
- Fullscreen button
- Export PNG button
- Go-to-date picker for historical navigation

Data source: OHLCV from CoinGecko for major tokens, DexScreener for others. Cache via Upstash Redis with 30s TTL.

Create /app/api/market/ohlcv/[chain]/[token]/route.ts:
```ts
import { NextRequest, NextResponse } from "next/server";
import { cacheWithFallback } from "@/lib/cache/redis";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export async function GET(request: NextRequest, { params }: { params: { chain: string; token: string } }) {
  const timeframe = request.nextUrl.searchParams.get("tf") || "1h";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "500");
  
  const cacheKey = `ohlcv:${params.chain}:${params.token}:${timeframe}:${limit}`;
  const ttl = timeframe === "1m" ? 15 : timeframe === "5m" ? 30 : 60;
  
  const data = await cacheWithFallback(cacheKey, ttl, async () => {
    // Try CoinGecko for major tokens first, fallback to DexScreener
    // Normalize to { time, open, high, low, close, volume }[]
    // Implementation reads from CoinGecko /coins/{id}/ohlc and DexScreener /pairs/{chain}/{token}
    return await fetchOhlcvData(params.chain, params.token, timeframe, limit);
  });
  
  return NextResponse.json(data);
}
```

Implement fetchOhlcvData in /lib/services/ohlcv.ts with proper error handling and fallback between sources.

── TASK 2.4: ORDER FORM COMPONENT ──

Create /components/trading/OrderForm.tsx:

Tabs at top: [Market | Limit | DCA | Stop/TP]

MARKET tab (existing swap flow, unified): same UX as /dashboard/swap but inline in terminal. Reuse existing swap quote API.

LIMIT tab:
- From token (auto-filled from pair, can change)
- Amount
- Trigger price input (default: current price + direction toggle Above/Below)
- Expires in: 1 day / 1 week / 1 month / Never
- Slippage: default from preferences
- Expected output calculated live
- Place Limit Order button

DCA tab:
- From token, To token
- Amount per execution
- Interval: 1 hour / 6 hours / 1 day / 1 week / custom
- Total executions: unlimited or specific count
- Max price (optional skip execution if above)
- Min price (optional skip if below)
- Create DCA Bot button

STOP/TP tab:
- Token you hold (from your positions OR manual input)
- Position amount
- Stop Loss %: default -10% from current
- Take Profit %: default +30% from current
- OR Trailing Stop %: default 15%
- Exit to: USDC (default)
- Create Stop/TP button

All forms use existing design tokens. Institutional feel. Tight spacing.

── TASK 2.5: POSITIONS + ORDERS BOTTOM PANELS ──

Create /components/trading/PositionsPanel.tsx:
- Shows user's token holdings for currently selected wallet (from wallet_identities)
- Columns: Token | Amount | Avg Entry | Current Price | PnL % | PnL USD | Actions (close / set SL-TP)

Create /components/trading/OpenOrdersPanel.tsx:
- Query limit_orders where status='active' for user
- Columns: Pair | Side | Trigger | Amount | Expires | Created | Actions (cancel)

Create /components/trading/OrderHistoryPanel.tsx:
- Query limit_orders + dca_executions + stop_loss_orders union, filter by status='executed'/'triggered_*'
- Paginated

Create /components/trading/DcaBotsPanel.tsx:
- Lists user's DCA bots with stats (executions, avg entry, total invested, unrealized PnL)
- Actions: pause, resume, cancel

Create /components/trading/StopLossPanel.tsx:
- Lists active stop-loss/TP orders
- Visual indicator of distance from trigger

── TASK 2.6: COMMIT PHASE 2 ──

```
git add .
git commit -m "Phase 2: Institutional trading terminal UI — multi-timeframe charts, 8 indicators, 6 drawing tools, order form with Market/Limit/DCA/Stop-TP tabs, bottom panels for positions/orders/history"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 3 — LIMIT ORDERS + DCA BOTS + STOP-LOSS BACKEND + UI WIRING
═══════════════════════════════════════════════════════════════════════════

── TASK 3.1: LIMIT ORDER BACKEND ──

Create /app/api/trading/limit-orders/route.ts (GET + POST):
- GET: returns user's limit_orders filtered by status query param
- POST: creates new limit order, validates params, stores in DB

Create /app/api/trading/limit-orders/[id]/route.ts (DELETE):
- Cancel an active limit order

Create /app/api/cron/limit-order-monitor/route.ts:
- Runs every 1 minute (in vercel.json)
- Queries all active limit_orders
- Batches by chain + token, fetches current prices via DexScreener/CoinGecko
- For each order: if trigger condition met, execute via swap API, update status to 'executed', set executed_tx_hash
- If chain call fails: increment failure count, set status='failed' after 3 tries
- If order expired: set status='expired'

Use fetchWithRetry, Sentry capture on errors.

── TASK 3.2: DCA BOT BACKEND ──

Create /app/api/trading/dca-bots/route.ts (GET + POST):
- GET: returns user's DCA bots
- POST: creates new DCA bot, sets next_execution_at to now + interval

Create /app/api/trading/dca-bots/[id]/route.ts (PATCH + DELETE):
- PATCH: pause/resume/update
- DELETE: cancel

Create /app/api/cron/dca-executor/route.ts:
- Runs every 5 minutes
- Queries dca_bots where status='active' AND next_execution_at <= NOW()
- For each bot: check min/max price guards, execute swap via swap API
- Insert dca_executions row with result
- Update bot: executions_completed++, total_invested_usd, total_received_amount, avg_entry_price, next_execution_at = now + interval
- If executions_completed >= total_executions (if set), mark status='completed'

── TASK 3.3: STOP-LOSS / TAKE-PROFIT BACKEND ──

Create /app/api/trading/stop-loss/route.ts (GET + POST):
- GET: user's stop-loss orders
- POST: create stop-loss + take-profit (or trailing stop)

Create /app/api/trading/stop-loss/[id]/route.ts (PATCH + DELETE):
- PATCH: adjust trigger prices
- DELETE: cancel

Create /app/api/cron/stop-loss-monitor/route.ts:
- Runs every 1 minute
- Queries stop_loss_orders where status='active'
- Batches by token, fetches prices
- For each order:
  - If trailing_stop_percent set: update highest_price_seen if current > highest; check if price dropped by trail% from highest → trigger
  - If stop_loss_price_usd set: if current <= SL → trigger_sl
  - If take_profit_price_usd set: if current >= TP → trigger_tp
- On trigger: execute market sell via swap API, set status + triggered_tx_hash + triggered_price + realized_pnl_usd

── TASK 3.4: WIRE UI TO BACKEND ──

In OrderForm.tsx Limit tab: on submit, POST to /api/trading/limit-orders, show toast, refresh OpenOrdersPanel.
In OrderForm.tsx DCA tab: POST to /api/trading/dca-bots, show toast, refresh DcaBotsPanel.
In OrderForm.tsx Stop/TP tab: POST to /api/trading/stop-loss, show toast.

Add live status indicators on active orders:
- Green pulse dot if within 5% of trigger
- Yellow if 5-15% away
- Grey if >15% away

Mobile: all forms stack vertically, full-width buttons.

── TASK 3.5: TRADING PREFERENCES ──

Create /app/api/user/trading-preferences/route.ts (GET + PATCH):
- GET: reads user_trading_preferences for user, creates default if missing
- PATCH: updates fields

Create /components/trading/TradingPreferencesModal.tsx:
- Settings gear icon on trading terminal opens this
- Fields: default slippage, expert mode toggle, MEV protection, default timeframe, default indicators
- Auto-saves on change

── TASK 3.6: COMMIT PHASE 3 ──

```
git add .
git commit -m "Phase 3: Limit orders + DCA bots + Stop-loss/TP full backend and UI wiring with 3 cron monitors; trading preferences per user"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 4 — SWAP PAGE NEXT-GEN UPGRADE
═══════════════════════════════════════════════════════════════════════════

Current /app/dashboard/swap/page.tsx is 1,049 lines. Works well but needs upgrades for Nansen/1inch parity.

UPGRADE, don't rebuild. Read the existing file FIRST. Enhance it.

── TASK 4.1: MULTI-ROUTE AGGREGATION ──

Current state: uses 0x for EVM, Jupiter for Solana. Upgrade: compare ALL available routes and show user the best.

Create /lib/services/swap-aggregator.ts:
```ts
interface RouteQuote {
  provider: '0x' | 'jupiter' | '1inch' | 'kyberswap' | 'openocean';
  chain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  amountOutUsd: number;
  priceImpactBps: number;
  gasUsd: number;
  netOutputUsd: number; // amountOutUsd - gasUsd
  route: any; // provider-specific route data
  fetchedAt: number;
}

export async function getAllRoutes(params: {
  chain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  slippageBps: number;
}): Promise<RouteQuote[]> {
  const providers = params.chain === 'solana' 
    ? ['jupiter'] 
    : ['0x', '1inch', 'kyberswap', 'openocean'];
  
  const quotes = await Promise.allSettled(
    providers.map(p => fetchRouteFromProvider(p, params))
  );
  
  return quotes
    .filter((r): r is PromiseFulfilledResult<RouteQuote> => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => b.netOutputUsd - a.netOutputUsd);
}
```

Add 1inch integration (/lib/services/oneinch.ts), KyberSwap (/lib/services/kyberswap.ts), OpenOcean (/lib/services/openocean.ts). Keep existing 0x and Jupiter.

For each provider: quote endpoint wrapper, fetchWithRetry, proper error handling.

── TASK 4.2: ROUTE COMPARISON UI ──

Add to swap page a "Routes" accordion below the main swap card that shows:
- Best route highlighted (green border, "BEST" badge)
- Each alternative: provider logo, amount out, savings vs best, gas, button to "Use this route"
- User can override default to use specific provider

Default behavior: auto-select highest netOutputUsd. User can disable by unchecking "Use best route" in trading preferences.

── TASK 4.3: MEV PROTECTION INTEGRATION ──

Add MEV protection toggle on swap page (default ON per user_trading_preferences.mev_protection_enabled).

For EVM swaps with MEV protection enabled:
- Route EVM transactions through Flashbots Protect RPC (https://rpc.flashbots.net)
- Or use CowSwap's MEV-protected route if available
- Or Matcha (0x) private transactions

Show MEV protection status as badge: "MEV PROTECTED" when enabled and route supports it.

Create /lib/services/mev.ts with provider selection logic.

── TASK 4.4: EXECUTION INTELLIGENCE ──

After user confirms swap, before execution:
- Show pre-execution summary: expected output, price impact, slippage, gas, MEV status
- Show "Similar swaps in last hour" analytics: median output for this pair size, current route vs last 10 swaps
- Warning banners: if price impact > 2%, if slippage > 5%, if liquidity < $50K

Post-execution:
- Save result to swap_route_analytics with all route comparison data
- Show "You saved $X vs next best route" on success toast
- Update swap_logs with additional metadata (provider used, mev_protection_used, savings)

Create /components/swap/PreExecutionSummary.tsx and /components/swap/RouteComparison.tsx.

── TASK 4.5: SMART SWAP FEATURES ──

Add these features to swap page:

1. "Set limit order instead" option if current price is unfavorable:
   - If price impact > 3%, show suggestion: "High price impact. Set a limit order at $X to save $Y"
   - One-click converts the swap attempt to a limit order form

2. Recent swaps widget:
   - Query swap_logs for user's last 5 swaps
   - Show: pair, amount, status, tx link
   - "Repeat last swap" button

3. Token trust indicators (institutional):
   - On "To" token: show Smart Money exposure (query smart_money_rankings for wallets holding this token)
   - Show token age, deployer verified, security score from GoPlus
   - Red banner if flagged (honeypot, tax >10%, blacklisted)

4. Gas estimation intelligence:
   - Show EVM gas in USD, not just gwei
   - Show estimated confirmation time (fast / standard / slow)
   - Allow priority fee override for EVM (expert mode only)

── TASK 4.6: SWAP PAGE UI POLISH ──

Without changing colors/branding:
- Tighten spacing (reduce padding on cards from p-6 to p-4 where appropriate)
- Monospace font for all numeric values (prices, amounts, addresses)
- Clearer loading states (skeleton shimmers, not just spinners)
- Better error recovery UX (specific error messages with action buttons)
- Keyboard shortcuts: Enter to submit, Tab to swap directions, Esc to clear amount

── TASK 4.7: COMMIT PHASE 4 ──

```
git add .
git commit -m "Phase 4: Swap page next-gen upgrade — multi-route aggregation (5 providers), MEV protection, execution intelligence, smart features (limit-instead, recent swaps, trust indicators)"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 4 COMPLETE — CONTINUE DIRECTLY TO PHASE 5 (DO NOT STOP)
═══════════════════════════════════════════════════════════════════════════

Phase 4 is complete and pushed. Immediately continue to Phase 5. DO NOT STOP. DO NOT WAIT. BATCH 1 CONTINUES through Phase 7.
═══════════════════════════════════════════════════════════════════════════
PHASES 5-7: WHALE TRACKER + COPY TRADING + WALLET CLUSTERS (WITHIN BATCH 1)
═══════════════════════════════════════════════════════════════════════════

Execute Phases 5, 6, 7 in order as part of Batch 1. After Phase 7, STOP and report end of Batch 1.

═══════════════════════════════════════════════════════════════════════════
PHASE 5 — WHALE TRACKER FULL BUILD (5,000 CURATED WHALES + SSE)
═══════════════════════════════════════════════════════════════════════════

── TASK 5.1: BATCH 2 SQL MIGRATION ──

Create /supabase/migrations/2026_session5b1_batch2.sql. Output full SQL in end-of-phase report.

```sql
-- WHALES CATALOG
CREATE TABLE IF NOT EXISTS whales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  entity_type TEXT CHECK (entity_type IN ('vc', 'trader', 'fund', 'exchange', 'dev', 'influencer', 'institutional', 'unknown')),
  portfolio_value_usd NUMERIC,
  pnl_7d_usd NUMERIC,
  pnl_30d_usd NUMERIC,
  pnl_90d_usd NUMERIC,
  win_rate NUMERIC,
  trade_count_30d INT,
  avg_hold_hours NUMERIC,
  archetype TEXT,
  whale_score INT DEFAULT 0,
  follower_count INT DEFAULT 0,
  x_handle TEXT,
  tg_handle TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain)
);
CREATE INDEX IF NOT EXISTS whales_score_idx ON whales(whale_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS whales_chain_idx ON whales(chain, whale_score DESC);
CREATE INDEX IF NOT EXISTS whales_entity_idx ON whales(entity_type);
CREATE INDEX IF NOT EXISTS whales_search_idx ON whales USING gin(to_tsvector('english', coalesce(label, '') || ' ' || address));
ALTER TABLE whales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_whales" ON whales;
CREATE POLICY "anyone_reads_whales" ON whales FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "service_role_whales" ON whales;
CREATE POLICY "service_role_whales" ON whales FOR ALL TO service_role USING (true);

-- WHALE ACTIVITY
CREATE TABLE IF NOT EXISTS whale_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'transfer_in', 'transfer_out', 'swap', 'approve', 'stake', 'unstake', 'mint', 'burn')),
  token_address TEXT,
  token_symbol TEXT,
  amount NUMERIC,
  value_usd NUMERIC,
  counterparty TEXT,
  counterparty_label TEXT,
  block_number BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, whale_address, chain)
);
CREATE INDEX IF NOT EXISTS whale_activity_whale_idx ON whale_activity(whale_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_token_idx ON whale_activity(token_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_ts_idx ON whale_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_activity_value_idx ON whale_activity(value_usd DESC) WHERE value_usd > 50000;
ALTER TABLE whale_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_whale_activity" ON whale_activity;
CREATE POLICY "anyone_reads_whale_activity" ON whale_activity FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_whale_activity" ON whale_activity;
CREATE POLICY "service_role_whale_activity" ON whale_activity FOR ALL TO service_role USING (true);

-- USER WHALE FOLLOWS
CREATE TABLE IF NOT EXISTS user_whale_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_id UUID REFERENCES whales(id) ON DELETE CASCADE,
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  label TEXT,
  copy_mode TEXT DEFAULT 'alerts' CHECK (copy_mode IN ('alerts', 'oneclick')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address, chain)
);
CREATE INDEX IF NOT EXISTS user_whale_follows_user_idx ON user_whale_follows(user_id);
CREATE INDEX IF NOT EXISTS user_whale_follows_whale_idx ON user_whale_follows(whale_address, chain);
ALTER TABLE user_whale_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_whale_follows" ON user_whale_follows;
CREATE POLICY "users_own_whale_follows" ON user_whale_follows FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_whale_follows" ON user_whale_follows;
CREATE POLICY "service_role_whale_follows" ON user_whale_follows FOR ALL TO service_role USING (true);

-- USER COPY RULES (for one-click copy with safety guards)
CREATE TABLE IF NOT EXISTS user_copy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  max_per_trade_usd NUMERIC NOT NULL,
  daily_cap_usd NUMERIC NOT NULL,
  chains_allowed TEXT[],
  tokens_blacklist TEXT[],
  min_liquidity_usd NUMERIC DEFAULT 50000,
  max_slippage_bps INT DEFAULT 200,
  require_confirmation BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, whale_address, chain)
);
ALTER TABLE user_copy_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_copy_rules" ON user_copy_rules;
CREATE POLICY "users_own_copy_rules" ON user_copy_rules FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_copy_rules" ON user_copy_rules;
CREATE POLICY "service_role_copy_rules" ON user_copy_rules FOR ALL TO service_role USING (true);

-- USER COPY TRADES (execution log)
CREATE TABLE IF NOT EXISTS user_copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_whale TEXT NOT NULL,
  source_tx_hash TEXT NOT NULL,
  copied_tx_hash TEXT,
  token_address TEXT,
  token_symbol TEXT,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  amount_usd NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  failure_reason TEXT,
  pnl_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS copy_trades_user_idx ON user_copy_trades(user_id, created_at DESC);
ALTER TABLE user_copy_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_copy_trades" ON user_copy_trades;
CREATE POLICY "users_own_copy_trades" ON user_copy_trades FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_copy_trades" ON user_copy_trades;
CREATE POLICY "service_role_copy_trades" ON user_copy_trades FOR ALL TO service_role USING (true);

-- WHALE SUBMISSIONS (community submissions for review)
CREATE TABLE IF NOT EXISTS whale_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  proposed_label TEXT,
  proposed_entity_type TEXT,
  reason TEXT,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whale_submissions_status_idx ON whale_submissions(status, created_at DESC);
ALTER TABLE whale_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_submit_whales" ON whale_submissions;
CREATE POLICY "users_submit_whales" ON whale_submissions FOR INSERT TO authenticated WITH CHECK (submitter_id = auth.uid());
DROP POLICY IF EXISTS "users_read_own_submissions" ON whale_submissions;
CREATE POLICY "users_read_own_submissions" ON whale_submissions FOR SELECT TO authenticated USING (submitter_id = auth.uid());
DROP POLICY IF EXISTS "service_role_submissions" ON whale_submissions;
CREATE POLICY "service_role_submissions" ON whale_submissions FOR ALL TO service_role USING (true);

-- WALLET CLUSTERS (5 algorithms)
CREATE TABLE IF NOT EXISTS wallet_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('common_funding', 'coordinated_trading', 'direct_transfer', 'behavioral_fingerprint', 'sybil_pattern')),
  weight NUMERIC DEFAULT 1,
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  transaction_count INT DEFAULT 1,
  total_value_usd NUMERIC,
  UNIQUE(from_address, to_address, chain, edge_type)
);
CREATE INDEX IF NOT EXISTS wallet_edges_from_idx ON wallet_edges(from_address);
CREATE INDEX IF NOT EXISTS wallet_edges_to_idx ON wallet_edges(to_address);
CREATE INDEX IF NOT EXISTS wallet_edges_type_idx ON wallet_edges(edge_type, confidence DESC);
ALTER TABLE wallet_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_wallet_edges" ON wallet_edges;
CREATE POLICY "anyone_reads_wallet_edges" ON wallet_edges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_wallet_edges" ON wallet_edges;
CREATE POLICY "service_role_wallet_edges" ON wallet_edges FOR ALL TO service_role USING (true);

-- CLUSTER LABELS (community labels with voting)
CREATE TABLE IF NOT EXISTS cluster_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cluster_labels_cluster_idx ON cluster_labels(cluster_key, status);
ALTER TABLE cluster_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_labels" ON cluster_labels;
CREATE POLICY "anyone_reads_labels" ON cluster_labels FOR SELECT TO authenticated USING (status = 'approved');
DROP POLICY IF EXISTS "users_submit_labels" ON cluster_labels;
CREATE POLICY "users_submit_labels" ON cluster_labels FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
DROP POLICY IF EXISTS "service_role_labels" ON cluster_labels;
CREATE POLICY "service_role_labels" ON cluster_labels FOR ALL TO service_role USING (true);

-- CLUSTER LABEL VOTES
CREATE TABLE IF NOT EXISTS cluster_label_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES cluster_labels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote INT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(label_id, user_id)
);
ALTER TABLE cluster_label_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_vote_labels" ON cluster_label_votes;
CREATE POLICY "users_vote_labels" ON cluster_label_votes FOR ALL TO authenticated USING (user_id = auth.uid());

-- USER REPUTATION (for community contribution gamification)
CREATE TABLE IF NOT EXISTS user_reputation (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT DEFAULT 0,
  tier TEXT DEFAULT 'scout' CHECK (tier IN ('scout', 'analyst', 'detective', 'officer')),
  labels_approved INT DEFAULT 0,
  labels_rejected INT DEFAULT 0,
  whales_submitted_approved INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_reputation" ON user_reputation;
CREATE POLICY "anyone_reads_reputation" ON user_reputation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_reputation" ON user_reputation;
CREATE POLICY "service_role_reputation" ON user_reputation FOR ALL TO service_role USING (true);
```

── TASK 5.2: WHALE DATA SEED FILE ──

Create /supabase/seeds/whales_seed.sql with 5,000 curated whale entries.

Research and include real whale addresses from public sources:
- VC wallets: a16z, Paradigm, Polychain, Multicoin, Dragonfly, Electric Capital, Framework, Pantera (public addresses from Arkham, Etherscan)
- Known traders: @GCRClassic, @CryptoKaleo, @MustStopMurad, etc. (publicly labeled addresses)
- Exchange wallets: Binance cold wallets, Coinbase, Kraken, OKX, Bybit (public labels)
- Notable DeFi whales: Curve, Compound, Aave top holders
- Solana smart money: known SOL ecosystem whales (from SolanaFM, Helius labels)

Target distribution:
- ~3,500 EVM addresses (Ethereum + Base + Arbitrum + Polygon + BSC)
- ~1,500 Solana addresses
- Mix of entity_type: 30% trader, 25% institutional, 15% exchange, 15% fund, 10% VC, 5% dev

Format:
```sql
INSERT INTO whales (address, chain, label, entity_type, verified, whale_score) VALUES
('0x...', 'ethereum', 'a16z (Andreessen Horowitz)', 'vc', true, 95),
('0x...', 'ethereum', 'Paradigm Capital', 'vc', true, 95),
-- ... 5000 rows
ON CONFLICT (address, chain) DO NOTHING;
```

Claude Code: research 5,000 real known whales from Etherscan verified labels, Arkham public data, Solscan labeled wallets. Do NOT fabricate addresses. If you cannot confirm 5,000 real addresses, seed what you can verify (minimum 500) and document in /docs/session-5b1-whale-seed-note.md what's needed for full 5,000.

── TASK 5.3: WHALE TRACKER PAGE DELETE AND REBUILD ──

DELETE AND REBUILD /app/dashboard/whale-tracker/page.tsx as institutional Whale Tracker.

Layout:
- Top: stats bar (total whales tracked, 24h volume, active whales)
- Filter bar: chain, entity type, min portfolio, sort
- Main area: tabs [Directory | My Following | Recent Activity | Leaderboard]

DIRECTORY tab:
- Grid of whale cards (3 cols desktop, 1 mobile)
- Each card: avatar (ENS/gradient), label, entity badge, portfolio value, 30d PnL, win rate, whale score, Follow button
- Infinite scroll paginated (50 per page)
- Click card → detail page

MY FOLLOWING tab:
- Only whales user follows
- Same card format + "Configure copy rules" button

RECENT ACTIVITY tab:
- Real-time feed of whale activity (SSE stream in Phase 11, polling for now 30s)
- Rows: timestamp, whale label, action, token, amount, value USD
- Filter by: followed only / all, action type, min value

LEADERBOARD tab:
- Top 100 whales by 30d PnL, win rate, whale score (sortable)
- Compact table format

── TASK 5.4: WHALE DETAIL PAGE ──

Create /app/dashboard/whale-tracker/[address]/page.tsx:

Layout:
- Header: whale label, address, entity badge, follow button, copy mode selector (Alerts / One-Click)
- Stats grid: Portfolio, 7d/30d/90d PnL, Win Rate, Trade Count, Avg Hold
- Tabs: [Overview | Activity | Tokens Held | Counterparties | Copy Rules]

OVERVIEW tab:
- Portfolio breakdown pie chart (top 10 holdings)
- PnL chart (30d line chart)
- Archetype analysis (AI-generated via Claude based on trading pattern)

ACTIVITY tab:
- Full activity log (paginated from whale_activity table)

TOKENS HELD tab:
- Query current holdings via Alchemy/Helius for this address
- Sortable by value, PnL, entry price

COUNTERPARTIES tab:
- Top 20 addresses this whale transacts with most
- Link to their profiles if also whales

COPY RULES tab (visible only if user is following):
- Form to configure user_copy_rules: max per trade, daily cap, chain allowlist, token blacklist
- Enable/disable toggle

── TASK 5.5: WHALE ACTIVITY POLLING ──

Create /app/api/cron/whale-activity-poll/route.ts (runs every 1 minute):
- Queries whales table where is_active = true ORDER BY last_active_at DESC LIMIT 500 per run
- For each whale: fetch latest transactions via Alchemy (EVM) or Helius (Solana)
- Filter for transactions after last known timestamp
- Decode action (buy/sell/transfer etc.) based on tx data
- Insert new rows into whale_activity with ON CONFLICT DO NOTHING
- Update whale's last_active_at

Create /app/api/whales/route.ts (list whales):
- GET: paginated, filterable (chain, entity_type, sort by score/pnl)

Create /app/api/whales/[address]/route.ts:
- GET: full whale profile + aggregated stats

Create /app/api/whales/[address]/activity/route.ts:
- GET: paginated activity log

── TASK 5.6: WHALE FOLLOW API ──

Create /app/api/user/whale-follows/route.ts (GET + POST):
- POST: adds to user_whale_follows with copy_mode

Create /app/api/user/whale-follows/[id]/route.ts (PATCH + DELETE):
- PATCH: update copy_mode, label, notes
- DELETE: unfollow

── TASK 5.7: WHALE SUBMISSION FLOW ──

Create /app/dashboard/whale-tracker/submit/page.tsx:
- Form: address, chain, proposed label, entity type, reason, evidence URLs
- Submit creates whale_submissions row with status='pending'
- Show user their submission history below form

Create /app/api/user/whale-submissions/route.ts (GET + POST).

Admin review happens in admin panel (existing /dashboard/admin or add to it).

── TASK 5.8: COMMIT PHASE 5 ──

```
git add .
git commit -m "Phase 5: Whale Tracker full build — 5,000 curated whales, directory + detail pages, activity polling cron, follow/submit flows"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 6 — ONE-CLICK COPY TRADING WITH SAFETY RAILS
═══════════════════════════════════════════════════════════════════════════

Only Alerts + One-Click copy tiers in this phase. Auto-Copy deferred to Session 5C.

── TASK 6.1: COPY TRADE DETECTION CRON ──

Create /app/api/cron/copy-trade-monitor/route.ts (runs every 1 minute):
- Queries user_whale_follows WHERE copy_mode IN ('alerts', 'oneclick')
- For each unique whale being followed: check whale_activity for new entries in last 5 minutes
- For each new buy/sell from followed whale:
  - If user copy_mode = 'alerts': send notification (push + Telegram if linked + in-app alert)
  - If user copy_mode = 'oneclick': create pending user_copy_trades row with status='pending', send notification with "Copy Now" action button

Alerts sent via existing notification system (push, Telegram message via bot.ts).

── TASK 6.2: COPY TRADE EXECUTION API ──

Create /app/api/trading/copy-trade/[id]/route.ts (POST to execute):
- User clicks "Copy Now" on a pending copy trade notification
- Backend validates user_copy_rules for this whale:
  - Check max_per_trade_usd not exceeded
  - Check daily_cap_usd not hit (sum today's successful copies)
  - Check chain in chains_allowed
  - Check token NOT in tokens_blacklist
  - Check token liquidity >= min_liquidity_usd via DexScreener
- If checks pass: use whale's action data to build swap quote via swap-aggregator (sized to user's max_per_trade_usd, not whale's actual size)
- Execute swap via existing swap flow (user's wallet)
- Update user_copy_trades with tx_hash + status='success' OR 'failed' + failure_reason

── TASK 6.3: COPY TRADES DASHBOARD ──

Create /app/dashboard/whale-tracker/copy-trades/page.tsx:
- Lists all user's copy trades history
- Filter by whale, status, time range
- Columns: timestamp, whale label, action, token, amount, status, PnL, tx link
- Aggregate stats at top: total copied, success rate, total PnL, best whale

── TASK 6.4: COPY RULES UI ──

On whale detail page Copy Rules tab (from Phase 5): 
- Wire to /app/api/user/copy-rules/route.ts (new) for CRUD
- Fields: max per trade, daily cap, chains allowed (multi-select), tokens blacklist (textarea), min liquidity
- Sane defaults: $50 per trade, $500 daily cap

── TASK 6.5: COMMIT PHASE 6 ──

```
git add .
git commit -m "Phase 6: One-click copy trading with safety rails — detection cron, execution API with rule validation, copy trades dashboard"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 7 — WALLET CLUSTERS FULL BUILD (5 ALGORITHMS + 2D/3D GRAPH)
═══════════════════════════════════════════════════════════════════════════

── TASK 7.1: CLUSTER DETECTION ALGORITHMS ──

Create /lib/clusters/algorithms.ts with 5 detection algorithms:

1. COMMON FUNDING: 
   - Find wallets funded by same source wallet within 7 days of each other
   - Query wallet_edges WHERE edge_type='common_funding' OR compute on-demand
   - Confidence: higher if more wallets share same funder + shorter time window

2. COORDINATED TRADING:
   - Find wallets that buy/sell same token within same minute repeatedly
   - Minimum 3 coordinated events in 30 days
   - Confidence: higher with more events + smaller time gaps

3. DIRECT TRANSFER:
   - Wallets that transferred funds directly to each other (excluding exchange/aggregator addresses)
   - Weighted by transfer count and total USD value
   - Confidence: high if multiple bidirectional transfers

4. BEHAVIORAL FINGERPRINT:
   - Similar trading times (same hour bucket), similar token preferences, similar hold duration
   - Hash-based fingerprint comparison
   - Confidence: proportional to similarity score

5. SYBIL PATTERN:
   - Multiple wallets with identical small-amount activities (airdrop farming signature)
   - Same token claims, same protocols, same order within hours
   - Confidence: high if >5 wallets match exact pattern

Each algorithm returns: { clusterId: string, addresses: string[], confidence: number, evidence: any[] }

── TASK 7.2: CLUSTER ANALYSIS CRON ──

Create /app/api/cron/cluster-analysis/route.ts (runs every 6 hours):
- Query top 1000 most active addresses in last 7 days
- For each address, run 5 algorithms, find its cluster
- Save results to wallet_edges (for direct edges) and cluster_cache (for cluster aggregations)
- Generate AI cluster name via Claude API based on behavior pattern (stored in cluster_labels with ai_generated=true, status='approved')

── TASK 7.3: CLUSTER DETAIL PAGE ──

DELETE AND REBUILD /app/dashboard/wallet-clusters/page.tsx:

New structure:
- Search bar: "Enter wallet address or cluster name"
- List view of clusters (paginated)
- Each cluster row: cluster name, wallet count, total value, archetype badge, top members preview, View button

Create /app/dashboard/wallet-clusters/[clusterId]/page.tsx:
- Header: cluster name, member count, total portfolio, archetype
- Tabs: [Graph | Members | Activity | Labels]

GRAPH tab (main feature):
- Default: 2D force-directed graph via d3-force
- "Enter 3D Mode" button → switches to three.js 3D rotatable/zoomable
- Nodes: wallet addresses, sized by portfolio value, colored by archetype
- Edges: colored by edge_type (funding=blue, trading=green, transfer=orange, fingerprint=purple, sybil=red)
- Click node → side panel with wallet details, jump to wallet-intelligence page
- Hover edge → tooltip showing edge_type + confidence

Install: npm install d3-force @react-three/fiber three @types/three (if not present)

Create /components/clusters/ClusterGraph2D.tsx (d3-force based).
Create /components/clusters/ClusterGraph3D.tsx (three.js based).

MEMBERS tab: paginated table of all cluster members with columns: address, label, portfolio, activity.
ACTIVITY tab: aggregated recent activity across all cluster members.
LABELS tab: community-submitted labels with upvote/downvote, submit new label form.

── TASK 7.4: CLUSTER API ──

Create /app/api/clusters/route.ts (GET list of clusters, paginated).
Create /app/api/clusters/[clusterId]/route.ts (GET full cluster detail).
Create /app/api/clusters/analyze/[address]/route.ts (POST: on-demand cluster analysis for specific address, stores results in cluster_cache).
Create /app/api/clusters/[clusterId]/graph/route.ts (GET: graph data for 2D/3D rendering — nodes + edges).

── TASK 7.5: COMMUNITY LABELS FLOW ──

Create /app/api/clusters/[clusterId]/labels/route.ts (GET + POST):
- GET: list approved labels
- POST: submit new label (creates cluster_labels with status='pending')

Create /app/api/clusters/labels/[labelId]/vote/route.ts (POST):
- Vote +1 or -1 on a label
- Auto-approve if upvotes >= 10 and (upvotes/downvotes ratio) > 3
- Award reputation points to submitter when approved (+10 points)

Reputation tier upgrades handled in /lib/reputation.ts:
- 0-99 points: Scout
- 100-499: Analyst
- 500-1999: Detective
- 2000+: Officer

── TASK 7.6: COMMIT PHASE 7 ──

```
git add .
git commit -m "Phase 7: Wallet Clusters full build — 5 detection algorithms, 2D/3D force-directed graph, community labels with reputation tiers"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
END OF BATCH 1 — STOP AND REPORT (after Phase 7)
═══════════════════════════════════════════════════════════════════════════

After Phase 7 is committed and pushed, STOP. Output CONSOLIDATED Batch 1 SQL (combine all migrations from Phase 1 + Phase 5 into ONE code block) for user to run in Supabase.

Report status:

```
BATCH 1 COMPLETE — Phases 1 through 7

Branch: session-5b1-production (pushed to origin)

Phase 1 — Vercel cron restore, GoPlus client, trading SQL foundation
Phase 2 — Real trading terminal UI (multi-timeframe charts, 8 indicators, 6 drawing tools)
Phase 3 — Limit Orders + DCA Bots + Stop-Loss/TP full backend + UI + 3 cron monitors
Phase 4 — Swap next-gen (5-provider aggregation, MEV protection, execution intelligence)
Phase 5 — Whale Tracker (5,000 curated whales, directory, detail pages, activity polling)
Phase 6 — One-click copy trading (alerts + oneclick modes, safety rails)
Phase 7 — Wallet Clusters (5 algorithms, 2D/3D force graph, community labels + reputation)

Latest commits: [list 7 commit hashes]

USER ACTIONS BEFORE BATCH 2:
1. Copy the CONSOLIDATED Batch 1 SQL (output in next code block) and paste into Supabase SQL Editor, click Run.
2. Verify all new tables in Supabase Table Editor:
   Trading tables: limit_orders, dca_bots, dca_executions, stop_loss_orders, swap_route_analytics, user_trading_preferences, user_chart_drawings, chart_price_alerts, user_security_preferences
   Whale tables: whales, whale_activity, user_whale_follows, user_copy_rules, user_copy_trades, whale_submissions
   Cluster tables: wallet_edges, cluster_labels, cluster_label_votes, user_reputation
3. (Optional) Create PR from session-5b1-production → main on GitHub, test on preview URL
4. Reply "Continue with Batch 2" when ready.

Build status: clean (npm run build exit 0)
TypeScript: 0 new errors in new files
No mock data, no placeholders, no any types in new code.

Waiting for user confirmation to proceed with Batch 2 (Phases 8-13: VTX redesign, Security, Wallet Intel, SSE, self-audit, platform audit).
```

Then STOP. Do not proceed to Phase 8 until user says "Continue with Batch 2".

═══════════════════════════════════════════════════════════════════════════
BATCH 2 — PHASES 8-13: VTX + SECURITY + WALLET INTEL + SSE + AUDIT
═══════════════════════════════════════════════════════════════════════════

Only start when user explicitly says "Continue with Batch 2". Execute Phases 8 through 13 consecutively. Do NOT stop between phases within this batch. After Phase 13 (final platform audit) is committed and pushed, STOP and deliver full comprehensive report.

═══════════════════════════════════════════════════════════════════════════
PHASE 8 — VTX AGENT PAGE FULL INSTITUTIONAL REDESIGN
═══════════════════════════════════════════════════════════════════════════

Session 5A flagged this file (853 lines) as too risky to redo mid-session. Now it's primary focus.

── TASK 8.1: READ AND UNDERSTAND CURRENT VTX PAGE ──

Read /app/dashboard/vtx-ai/page.tsx in full. Understand:
- Current chat UI structure
- Message streaming flow
- How TokenCard / SwapCard get injected
- Conversation state management
- How ?q= and ?conversation=<id> params work (from Phase 6 of 5A)

DO NOT DELETE the working chat logic. UPGRADE the UI around it.

── TASK 8.2: NEW LAYOUT ──

Redesign as 3-column institutional:

LEFT SIDEBAR (280px, collapsible on mobile):
- "+ New Chat" button at top
- "Recent Sessions" list (all user's vtx_conversations, paginated)
- Each session: truncated title, last message preview, timestamp
- Search sessions box
- Bottom: credit counter (X / 2000 remaining)

MAIN AREA (flex-1):
- Top: session title (editable on click) + share button + delete button
- Messages scroll area (virtualized if >50 messages for perf)
- Each message: AgentAvatar for AI, user avatar for user, rich content rendering (text, TokenCard, SwapCard, code blocks, charts inline)
- Bottom: input bar
  - Textarea (auto-expanding)
  - Naka Prompts trigger button (opens NakaPromptsPanel overlay)
  - Expert mode toggle (if user has expert_mode pref)
  - Trade mode toggle (allows swap intent detection)
  - Send button
  - Credit display

RIGHT SIDEBAR (320px, togglable):
- "Context" panel — AI can pin relevant data here during conversation
- Pinned tokens (with live prices)
- Pinned wallets (with activity)
- Pinned insights
- User can toggle sidebar with Ctrl+/

── TASK 8.3: AI RESPONSE QUALITY UPGRADE ──

Update /app/api/vtx-ai/route.ts:

System prompt: emphasize institutional quality, no markdown, tight data-dense answers, every factual claim must cite data source, proactive suggestions.

Add structured response capability:
- AI can emit "cards" (TokenCard, SwapCard, ChartCard, WalletCard) inline in response
- AI can request tool use: "get current price for $X", "analyze wallet Y", "get recent whale activity for Z"
- Tools implemented server-side call existing APIs and inject results into conversation

Install: npm install @anthropic-ai/sdk if not latest

Use Claude Sonnet 4.6 (latest available) with tool use:
```ts
const tools = [
  { name: 'get_token_price', input_schema: {...}, description: '...' },
  { name: 'get_whale_activity', input_schema: {...} },
  { name: 'analyze_wallet', input_schema: {...} },
  { name: 'get_trending', input_schema: {...} },
  { name: 'prepare_swap', input_schema: {...} },
  // etc.
];
```

Multi-turn tool use loop: AI requests tool → backend executes → result back to AI → AI synthesizes final response with tool results.

── TASK 8.4: TRADE EXECUTION IN CHAT VERIFIED ──

User types "swap 1 USDC for SOL" → AI:
1. Detects swap intent
2. Requests prepare_swap tool → backend calls swap-aggregator
3. Returns SwapCard in response with quote
4. SwapCard renders inline with Execute button
5. User clicks Execute → swap happens IN chat (not redirect)
6. tx_hash streams back as new AI message
7. Success confirmation card rendered

Full flow must work end to end without leaving /dashboard/vtx-ai.

── TASK 8.5: NAKA PROMPTS FULLY INTEGRATED ──

NakaPromptsPanel from Session 5A — enhance:
- Click outside to close
- Search within prompts
- Favorite prompts (persist to user prefs)
- "Suggest based on current context" — AI-generated prompts based on current conversation state

── TASK 8.6: SESSION MANAGEMENT ──

Create /app/api/vtx/conversations/route.ts (if not exists from 5A — verify):
- GET: list user's conversations (paginated)
- POST: create new
- DELETE: delete by id

Add share flow: share button generates public read-only link (uses shareToken), creates vtx_shared_conversations row (NEW table, add to migration).

Add to batch3 migration:
```sql
CREATE TABLE IF NOT EXISTS vtx_shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS vtx_shared_token_idx ON vtx_shared_conversations(share_token);
ALTER TABLE vtx_shared_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_shared" ON vtx_shared_conversations;
CREATE POLICY "anyone_reads_shared" ON vtx_shared_conversations FOR SELECT TO anon, authenticated USING (expires_at IS NULL OR expires_at > NOW());
DROP POLICY IF EXISTS "owners_manage_shared" ON vtx_shared_conversations;
CREATE POLICY "owners_manage_shared" ON vtx_shared_conversations FOR ALL TO authenticated USING (owner_id = auth.uid());
```

Public share view: /app/vtx/shared/[shareToken]/page.tsx (read-only, no login needed).

── TASK 8.7: COMMIT PHASE 8 ──

```
git add .
git commit -m "Phase 8: VTX Agent full institutional redesign — 3-column layout, tool use with multi-turn, trade execution in chat verified, session sharing"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 9 — SECURITY PAGES INSTITUTIONAL UPGRADE
═══════════════════════════════════════════════════════════════════════════

── TASK 9.1: AUDIT EXISTING SECURITY PAGES ──

Find all /app/dashboard/security-*/ and /app/dashboard/security/ pages:
- /dashboard/security-scanner/ (exists)
- /dashboard/contract-intelligence/ (exists)
- Any others

Read each page. List current state (what works, what's mock, what's half-built).

── TASK 9.2: SECURITY SCANNER UPGRADE ──

Current: basic token address input → GoPlus API call → display results.

Upgrade /app/dashboard/security-scanner/page.tsx:

Redesign UI:
- Institutional 3-column layout like Nansen
- Left: input + recent scans history
- Main: full security report with all categories
- Right: action buttons (set alert, share report, view on scanners)

Security report sections:
1. HEADLINE RISK SCORE: 0-100 with color (green >75, amber 40-75, red <40)
2. HONEYPOT CHECK: yes/no with evidence
3. TAX ANALYSIS: buy tax, sell tax, transfer tax
4. OWNERSHIP: renounced? owner address? contract ownership pattern
5. LIQUIDITY: locked? how much? where?
6. HOLDER DISTRIBUTION: top 10 holders concentration, is whale distribution healthy
7. TRADING RESTRICTIONS: blacklist functions? pause function? transfer cooldown?
8. CONTRACT CODE: verified? proxy? upgradeable? external calls?
9. SIMILAR SCAM MATCHES: does code match known rug templates?
10. MARKET RISK: liquidity age, volume trend, price manipulation signals

Use existing GoPlus integration. Enhance with:
- Contract code analysis via Etherscan/Solscan API
- Holder analysis via Alchemy/Helius
- Similar scam matching via internal scam_templates table (new — seed with known patterns)

Create /app/api/security/scan/[chain]/[address]/route.ts:
- Aggregates all security data
- Caches in token_risk_scores for 1 hour
- Returns comprehensive JSON

── TASK 9.3: CONTRACT INTELLIGENCE UPGRADE ──

Upgrade /app/dashboard/contract-intelligence/page.tsx:

For any contract address:
- Contract overview: name, symbol, deployer, creation date, chain
- Code analysis: functions list, admin functions flagged, external dependencies
- Upgrade history (for proxy contracts)
- Related contracts (deployed by same deployer, interacts with this contract)
- Recent transactions (top 100)
- Interaction heat map: addresses interacting most

Institutional UI: data-dense tables, monospace addresses, expandable sections, copy buttons on hashes.

── TASK 9.4: APPROVAL MANAGER ──

Create /app/dashboard/security/approvals/page.tsx:

Shows all token approvals granted by user's connected wallets:
- Fetches via Etherscan API getTokenApprovalsByAddress
- Lists: token, spender, approved amount, risk level
- Bulk revoke button
- Warning for unlimited approvals on suspicious contracts

Uses wallet_identities for user's addresses.

── TASK 9.5: SECURITY ALERTS SUBSCRIPTION ──

Create /app/dashboard/security/alerts/page.tsx:

User can subscribe to security events:
- "Alert me if token I hold gets flagged as honeypot"
- "Alert me if a wallet I follow interacts with flagged contract"
- "Alert me on large approval transactions from my wallets"

Alerts routed through notification system (push + Telegram).

── TASK 9.6: COMMIT PHASE 9 ──

```
git add .
git commit -m "Phase 9: Security pages institutional upgrade — Security Scanner deep report, Contract Intelligence, Approval Manager, Security Alerts"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 10 — WALLET INTELLIGENCE INSTITUTIONAL REDESIGN
═══════════════════════════════════════════════════════════════════════════

── TASK 10.1: UPGRADE WALLET INTELLIGENCE PAGE ──

Read /app/dashboard/wallet-intelligence/page.tsx. Upgrade to institutional.

For any wallet address:
- Header: address, ENS, entity label (from whales table if known), balance, 30d PnL
- Tabs:
  1. Overview — portfolio, PnL, trading DNA, archetype (Jacob-style Alpha Report)
  2. Holdings — current tokens with entry prices, unrealized PnL
  3. Activity — full transaction history
  4. Counterparties — top 50 addresses interacted with
  5. Performance — PnL charts, win rate, best trades, worst trades
  6. Clusters — related wallets via cluster detection

OVERVIEW tab must have "Alpha Intelligence Report" card:
- AI-generated via Claude analyzing trading pattern
- Style: Jacob-style (reference Nansen's Profiler AI analyses)
- Sections: Trading Style, Risk Profile, Specialization, Notable Moves, Archetype

Use existing infrastructure:
- Alchemy for EVM balance + tx history
- Helius for Solana
- DexScreener for token prices
- whale_activity table if address is in whales
- wallet_edges for cluster relationships

── TASK 10.2: WALLET COMPARISON TOOL ──

Create /app/dashboard/wallet-intelligence/compare/page.tsx:

Add up to 4 wallets → compare side-by-side:
- Portfolio value
- PnL (7d, 30d, 90d)
- Win rate
- Common tokens held (overlap)
- Trading style similarity score

── TASK 10.3: WALLET ALERT SUBSCRIPTIONS ──

On wallet detail page: "Alert me when this wallet..." options:
- Makes a trade >$X
- Buys a new token
- Sells a position
- Receives large transfer

Saves to user's alerts with specific wallet_address trigger.

── TASK 10.4: COMMIT PHASE 10 ──

```
git add .
git commit -m "Phase 10: Wallet Intelligence institutional redesign — 6-tab deep profile, AI Alpha Report, comparison tool, wallet alert subscriptions"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 10 COMPLETE — CONTINUE DIRECTLY TO PHASE 11 (DO NOT STOP)
═══════════════════════════════════════════════════════════════════════════

Phase 10 is complete and pushed. Immediately continue to Phase 11. DO NOT STOP. DO NOT WAIT. BATCH 2 CONTINUES through Phase 13.
═══════════════════════════════════════════════════════════════════════════
PHASES 11-13: REAL-TIME SSE + SELF-AUDIT + PLATFORM AUDIT (WITHIN BATCH 2)
═══════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════
PHASE 11 — REAL-TIME SSE INFRASTRUCTURE
═══════════════════════════════════════════════════════════════════════════

Real-time for Whale Tracker + Sniper Bot. Context Feed stays polling (already works).

── TASK 11.1: SSE INFRASTRUCTURE ──

Create /lib/realtime/sse.ts:
```ts
// Redis-based pub/sub for multi-instance SSE
// Publishers write to Redis stream, SSE endpoints subscribe and stream to clients
```

Create /app/api/whale-activity/stream/route.ts:
- SSE endpoint
- Subscribes to Redis stream "whale-activity"
- Filters by user's followed whales
- Streams events as they occur

── TASK 11.2: WHALE ACTIVITY PUBLISHER ──

Update /app/api/cron/whale-activity-poll/route.ts:
- After inserting new whale_activity rows, publish to Redis stream
- Each event: { whale_address, chain, action, token, value_usd, tx_hash, timestamp }

── TASK 11.3: CLIENT HOOK ──

Create /lib/hooks/useWhaleActivityStream.ts:
```ts
export function useWhaleActivityStream(options: { followedOnly?: boolean }) {
  const [events, setEvents] = useState<WhaleActivity[]>([]);
  useEffect(() => {
    const es = new EventSource(`/api/whale-activity/stream?followed=${options.followedOnly}`);
    es.onmessage = (e) => setEvents(prev => [JSON.parse(e.data), ...prev].slice(0, 200));
    return () => es.close();
  }, []);
  return events;
}
```

Use in whale tracker Recent Activity tab → instant updates instead of 30s polling.

── TASK 11.4: SNIPER SSE (IF APPLICABLE) ──

If sniper bot already exists: wire its execution events to stream similarly.

── TASK 11.5: COMMIT PHASE 11 ──

```
git add .
git commit -m "Phase 11: Real-time SSE for whale activity + sniper bot — Redis pub/sub, client hooks, replaces polling"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 12 — SESSION 5B-1 SELF-AUDIT + FIX ALL ISSUES
═══════════════════════════════════════════════════════════════════════════

── TASK 12.1: COMPREHENSIVE SELF-AUDIT ──

For every phase 1-11, verify deliverables. Write /docs/session-5b1-self-audit.md with PASS/FAIL/PARTIAL per item.

Checks:
- npm run build → must pass exit 0
- grep new files for "TODO|FIXME|XXX" — 0 allowed
- grep new files for ": any" — 0 allowed
- grep all "steinz labs" user-facing text — 0 allowed
- All new API routes have: auth check (where needed), Sentry capture, fetchWithRetry for external calls, proper error responses
- All new components handle: loading state, error state, empty state
- All new Supabase queries use lazy init
- All new cron routes verify CRON_SECRET
- Branding: no new colors introduced, all use existing design tokens
- Mobile responsive: all new pages tested at iPhone SE (375px) width mental model

── TASK 12.2: FIX EVERY FAIL ──

For each FAIL or PARTIAL: fix in same session. Do not defer. If truly blocked, document in /docs/session-5b1-blocked.md with specific reason.

── TASK 12.3: PERFORMANCE AUDIT ──

Check for:
- Expensive client-side loops
- Unused imports
- Large bundle additions (three.js in cluster graph is large — ensure dynamic import)
- Images not optimized (next/image used everywhere)
- API routes that could be cached but aren't

Apply fixes.

── TASK 12.4: COMMIT PHASE 12 ──

```
git add .
git commit -m "Phase 12: Session 5B-1 self-audit + fixes for every issue found"
git push origin session-5b1-production
```

═══════════════════════════════════════════════════════════════════════════
PHASE 13 — COMPREHENSIVE PLATFORM AUDIT + 5B-2/5C RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════

Final phase. Deliver massive audit document.

── TASK 13.1: FULL PLATFORM AUDIT ──

Write /docs/session-5b1-platform-audit.md covering every feature on the platform:

For each of these features, rate A/B/C/D and note open items:
1. Landing Page
2. Authentication (signup/login/reset)
3. Dashboard Homepage
4. Context Feed
5. Market / Trading Page
6. Trading Terminal (new in 5B-1)
7. Swap (upgraded in 5B-1)
8. VTX Agent (redesigned in 5B-1)
9. Whale Tracker (built in 5B-1)
10. Wallet Clusters (built in 5B-1)
11. Wallet Intelligence (redesigned in 5B-1)
12. Security Scanner (upgraded in 5B-1)
13. Contract Intelligence (upgraded in 5B-1)
14. Approval Manager (new in 5B-1)
15. Notifications + Alerts
16. Telegram Integration
17. Sniper Bot
18. Transactions / Portfolio
19. Wallet Page (built-in wallet creation/import)
20. Settings
21. Profile
22. Pricing
23. Admin Panel
24. AI Customer Support
25. Watchlist
26. Bookmarks

For each: A=production-ready institutional grade, B=good but improvements needed, C=functional but below standard, D=incomplete or broken

── TASK 13.2: SESSION 5B-2 RECOMMENDATIONS ──

Document what Session 5B-2 should cover:
- Admin Panel institutional UI upgrade
- Crypto payments integration
- 2FA full enrollment + recovery codes
- Any C/D rated features that need work
- On-Chain Trends (8 modules — if not completed in 5B-1)
- Smart Money leaderboard (if not completed)
- Network Metrics (6 modules — if not completed)
- Bubble Map upgrade
- Sniper Bot real-time upgrade
- Mobile PWA polish

── TASK 13.3: SESSION 5C RECOMMENDATIONS ──

Items deferred further:
- Auto-Copy trading (safety-sensitive, full session)
- CI/CD + Vitest + Playwright test suite
- Internationalization (next-intl — already in deps)
- Advanced analytics dashboard for admins
- Webhook API for partners
- Embed widgets (like Nansen's embedded smart money)

── TASK 13.4: SECURITY AUDIT CHECKLIST ──

Confirm:
- All API routes check auth where needed
- No hardcoded credentials anywhere (grep confirmed)
- All Supabase queries use RLS-protected tables or admin client intentionally
- Rate limiting on VTX (Redis-based), login (existing auth_rate_limits)
- JWT_SECRET enforced (no fallback)
- Wallet encryption AES-256-GCM with PBKDF2 100k iters
- Sentry scrubs cookies/PII
- CSP headers (if applicable) via middleware
- Cron endpoints require CRON_SECRET
- Telegram webhook verifies secret token

── TASK 13.5: FINAL COMMIT + REPORT ──

```
git add .
git commit -m "Phase 13: Comprehensive platform audit covering all 26 features with Session 5B-2 and 5C recommendations"
git push origin session-5b1-production
```

Final report to user:

```
SESSION 5B-1 COMPLETE — ALL 13 PHASES DELIVERED

Branch: session-5b1-production (pushed to origin)
Total commits this session: [count]
Total files changed: [count]

DELIVERED:
- Batch 1 (Phases 1-4): Cron restore, trading terminal, swap next-gen
- Batch 2 (Phases 5-7): Whale tracker (5K curated), copy trading, wallet clusters
- Batch 3 (Phases 8-10): VTX redesign, security pages upgrade, wallet intel redesign
- Batch 4 (Phases 11-13): Real-time SSE, self-audit, platform audit

USER ACTIONS REQUIRED:
1. Run all 3 migration files in Supabase SQL Editor (batch1, batch2, batch3)
2. Create PR on GitHub from session-5b1-production to main
3. Review audit document at /docs/session-5b1-platform-audit.md
4. Review recommendations for Session 5B-2 at /docs/session-5b1-platform-audit.md

BUILD STATUS: clean (npm run build exit 0)
NEW MOCK DATA: 0
NEW ANY TYPES: 0 (in new files)
NEW TODO/FIXME: 0

Next: Session 5B-2 when you're ready. Will cover: admin panel UI, crypto payments, 2FA, any remaining C/D rated features from audit.
```

═══════════════════════════════════════════════════════════════════════════
END OF SESSION 5B-1 MASTER PROMPT
═══════════════════════════════════════════════════════════════════════════

BEGIN NOW. Acknowledge rules in ONE line. Then execute Batch 1 (Phases 1 through 7) fully autonomously — DO NOT STOP between phases. After Phase 7 is committed and pushed, output consolidated Batch 1 SQL and STOP. Wait for user to say "Continue with Batch 2" (which covers Phases 8-13 including final platform audit).
═══════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════
GOPLUS SECURITY INTEGRATION ADDENDUM — WOVEN INTO EVERY FEATURE
═══════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════

GoPlus Security API is already integrated and keys are in Vercel env. User directive: USE IT EVERYWHERE security context matters. Every feature that touches a token, contract, wallet, swap, or transaction must consult GoPlus and expose the risk intelligence to users.

GoPlus API base: https://api.gopluslabs.io/api/v1/

GoPlus endpoints available:
- /token_security/{chain_id} — token risk analysis (honeypot, tax, ownership, blacklist)
- /address_security/{address} — wallet/address risk (phishing, sanctioned, scammer)
- /approval_security/{chain_id} — approval risk (malicious spenders)
- /nft_security/{chain_id} — NFT collection risk
- /dapp_security — dApp security score
- /phishing_site — phishing URL check
- /rugpull_detecting/{chain_id} — rugpull analysis (for newer tokens)
- /input_decode — decode transaction input data to detect malicious intent
- /malicious_address — sanctioned/known-bad address check

Chain IDs GoPlus supports:
- 1 Ethereum, 56 BSC, 137 Polygon, 42161 Arbitrum, 8453 Base, 43114 Avalanche, 10 Optimism, 324 zkSync, 59144 Linea, 534352 Scroll
- Solana: use /solana/token_security endpoint (separate path)

Rate limiting: GoPlus free tier = 30 req/min. Use Redis cache aggressively (1-6 hours TTL depending on data freshness need). All calls through fetchWithRetry.

───────────────────────────────────────────────────────────────────────────
CENTRALIZED GOPLUS CLIENT (BUILD FIRST IN PHASE 1 OF EACH BATCH)
───────────────────────────────────────────────────────────────────────────

If /lib/services/goplus.ts exists, upgrade. If not, create it.

```ts
import { cacheWithFallback } from "@/lib/cache/redis";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const GOPLUS_APP_KEY = process.env.GOPLUS_APP_KEY;
const GOPLUS_APP_SECRET = process.env.GOPLUS_APP_SECRET;

// Chain ID mapping for supported chains
export const CHAIN_IDS: Record<string, string> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  base: "8453",
  avalanche: "43114",
  optimism: "10",
  zksync: "324",
  linea: "59144",
  scroll: "534352",
};

export interface TokenSecurity {
  address: string;
  chain: string;
  isHoneypot: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  hiddenOwner: boolean;
  selfDestruct: boolean;
  externalCall: boolean;
  buyTax: number;
  sellTax: number;
  transferPausable: boolean;
  cannotBuy: boolean;
  cannotSellAll: boolean;
  tradingCooldown: boolean;
  isProxy: boolean;
  isMintable: boolean;
  slippageModifiable: boolean;
  personalSlippageModifiable: boolean;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  isAirdropScam: boolean;
  isAntiWhale: boolean;
  isTrueToken: boolean;
  isOpenSource: boolean;
  ownerAddress: string | null;
  ownerBalance: string;
  ownerPercent: number;
  creatorAddress: string | null;
  creatorPercent: number;
  totalSupply: string;
  holderCount: number;
  lpHolderCount: number;
  lpTotalSupply: string;
  isInDex: boolean;
  topHolders: Array<{ address: string; balance: string; percent: number; isLocked: boolean; tag?: string }>;
  riskScore: number; // 0-100, computed from above fields
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskReasons: string[];
  rawResponse: any;
}

export async function getTokenSecurity(chain: string, address: string): Promise<TokenSecurity | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId && chain !== "solana") return null;
  
  const cacheKey = `goplus:token:${chain}:${address.toLowerCase()}`;
  return await cacheWithFallback(cacheKey, 3600, async () => {
    const url = chain === "solana"
      ? `${GOPLUS_BASE}/solana/token_security?contract_addresses=${address}`
      : `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`;
    
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    
    const res = await fetchWithRetry(url, { headers, timeoutMs: 5000, source: "goplus-token" });
    const data = await res.json();
    const result = data.result?.[address.toLowerCase()] || data.result?.[address];
    if (!result) return null;
    
    return normalizeTokenSecurity(chain, address, result);
  });
}

export interface AddressSecurity {
  address: string;
  dataSource: string | null;
  isContract: boolean;
  isSanctioned: boolean;
  isFinancialCrime: boolean;
  isBlackmail: boolean;
  isPhishingActivities: boolean;
  isFakeKyc: boolean;
  isStealingAttack: boolean;
  isHoneypotRelatedAddress: boolean;
  isMoneyLaundering: boolean;
  isDarkwebTransactions: boolean;
  isMixer: boolean;
  isMaliciousMining: boolean;
  isCybercrime: boolean;
  isNumberOne: boolean;
  riskScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskReasons: string[];
}

export async function getAddressSecurity(address: string): Promise<AddressSecurity | null> {
  const cacheKey = `goplus:addr:${address.toLowerCase()}`;
  return await cacheWithFallback(cacheKey, 21600, async () => {
    const url = `${GOPLUS_BASE}/address_security/${address}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    const res = await fetchWithRetry(url, { headers, timeoutMs: 5000, source: "goplus-address" });
    const data = await res.json();
    if (!data.result) return null;
    return normalizeAddressSecurity(address, data.result);
  });
}

export interface ApprovalSecurity {
  chainId: string;
  contractAddress: string;
  isOpenSource: boolean;
  isContract: boolean;
  doxxedOwner: boolean;
  trustList: boolean;
  malicious: boolean;
  creatorAddress: string;
  deployedTime: string;
  riskScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskReasons: string[];
}

export async function getApprovalSecurity(chain: string, contractAddress: string): Promise<ApprovalSecurity | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;
  const cacheKey = `goplus:approval:${chain}:${contractAddress.toLowerCase()}`;
  return await cacheWithFallback(cacheKey, 3600, async () => {
    const url = `${GOPLUS_BASE}/approval_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    const res = await fetchWithRetry(url, { headers, timeoutMs: 5000, source: "goplus-approval" });
    const data = await res.json();
    const result = data.result?.[contractAddress.toLowerCase()];
    if (!result) return null;
    return normalizeApprovalSecurity(chainId, contractAddress, result);
  });
}

export async function getRugpullRisk(chain: string, address: string): Promise<any | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;
  const cacheKey = `goplus:rugpull:${chain}:${address.toLowerCase()}`;
  return await cacheWithFallback(cacheKey, 1800, async () => {
    const url = `${GOPLUS_BASE}/rugpull_detecting/${chainId}?contract_addresses=${address.toLowerCase()}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    const res = await fetchWithRetry(url, { headers, timeoutMs: 5000, source: "goplus-rugpull" });
    const data = await res.json();
    return data.result?.[address.toLowerCase()] || null;
  });
}

export async function getNftSecurity(chain: string, contractAddress: string): Promise<any | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;
  const cacheKey = `goplus:nft:${chain}:${contractAddress.toLowerCase()}`;
  return await cacheWithFallback(cacheKey, 3600, async () => {
    const url = `${GOPLUS_BASE}/nft_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    const res = await fetchWithRetry(url, { headers, timeoutMs: 5000, source: "goplus-nft" });
    const data = await res.json();
    return data.result?.[contractAddress.toLowerCase()] || null;
  });
}

export async function decodeTxInput(chain: string, txInput: string, contractAddress?: string): Promise<any | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;
  const url = `${GOPLUS_BASE}/input_decode`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
  try {
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ chain_id: chainId, data: txInput, contract_address: contractAddress }),
      timeoutMs: 5000,
      source: "goplus-decode",
    });
    return await res.json();
  } catch { return null; }
}

export async function checkPhishingUrl(url: string): Promise<{ isPhishing: boolean; website?: string } | null> {
  const cacheKey = `goplus:phishing:${url}`;
  return await cacheWithFallback(cacheKey, 86400, async () => {
    const u = `${GOPLUS_BASE}/phishing_site?url=${encodeURIComponent(url)}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    const res = await fetchWithRetry(u, { headers, timeoutMs: 4000, source: "goplus-phishing" });
    const data = await res.json();
    return { isPhishing: data.result?.phishing_site === 1, website: data.result?.website };
  });
}

// Batch token security for multiple tokens at once
export async function getBatchTokenSecurity(chain: string, addresses: string[]): Promise<Record<string, TokenSecurity | null>> {
  const results: Record<string, TokenSecurity | null> = {};
  // GoPlus allows up to 100 addresses per request via comma-separated
  const chunks = chunk(addresses, 100);
  for (const batch of chunks) {
    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      batch.forEach(a => { results[a] = null; });
      continue;
    }
    const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${batch.map(a => a.toLowerCase()).join(",")}`;
    const headers: Record<string, string> = {};
    if (GOPLUS_APP_KEY) headers["Authorization"] = GOPLUS_APP_KEY;
    try {
      const res = await fetchWithRetry(url, { headers, timeoutMs: 8000, source: "goplus-batch" });
      const data = await res.json();
      for (const addr of batch) {
        const r = data.result?.[addr.toLowerCase()];
        results[addr] = r ? normalizeTokenSecurity(chain, addr, r) : null;
      }
    } catch {
      batch.forEach(a => { results[a] = null; });
    }
  }
  return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// NORMALIZATION FUNCTIONS — convert GoPlus raw response to structured TokenSecurity/AddressSecurity with computed riskScore + riskLevel + riskReasons
function normalizeTokenSecurity(chain: string, address: string, raw: any): TokenSecurity {
  const reasons: string[] = [];
  let score = 100;
  
  const isHoneypot = raw.is_honeypot === "1";
  if (isHoneypot) { reasons.push("Honeypot detected"); score -= 60; }
  
  const buyTax = parseFloat(raw.buy_tax || "0") * 100;
  const sellTax = parseFloat(raw.sell_tax || "0") * 100;
  if (buyTax > 10) { reasons.push(`High buy tax: ${buyTax.toFixed(1)}%`); score -= Math.min(20, buyTax); }
  if (sellTax > 10) { reasons.push(`High sell tax: ${sellTax.toFixed(1)}%`); score -= Math.min(25, sellTax); }
  
  const cannotSellAll = raw.cannot_sell_all === "1";
  if (cannotSellAll) { reasons.push("Cannot sell all tokens"); score -= 30; }
  
  const transferPausable = raw.transfer_pausable === "1";
  if (transferPausable) { reasons.push("Transfers can be paused"); score -= 15; }
  
  const isMintable = raw.is_mintable === "1";
  if (isMintable) { reasons.push("Token is mintable (supply can increase)"); score -= 10; }
  
  const isProxy = raw.is_proxy === "1";
  if (isProxy) { reasons.push("Contract is a proxy (upgradeable)"); score -= 5; }
  
  const hiddenOwner = raw.hidden_owner === "1";
  if (hiddenOwner) { reasons.push("Hidden owner detected"); score -= 20; }
  
  const selfDestruct = raw.selfdestruct === "1";
  if (selfDestruct) { reasons.push("Contract has selfdestruct capability"); score -= 40; }
  
  const slippageModifiable = raw.slippage_modifiable === "1";
  if (slippageModifiable) { reasons.push("Slippage (tax) can be modified"); score -= 15; }
  
  const isBlacklisted = raw.is_blacklisted === "1";
  if (isBlacklisted) { reasons.push("Blacklist function present"); score -= 10; }
  
  const isAirdropScam = raw.is_airdrop_scam === "1";
  if (isAirdropScam) { reasons.push("Known airdrop scam pattern"); score -= 50; }
  
  const ownerPercent = parseFloat(raw.owner_percent || "0") * 100;
  if (ownerPercent > 20) { reasons.push(`Owner holds ${ownerPercent.toFixed(1)}% of supply`); score -= Math.min(15, ownerPercent / 2); }
  
  const isOpenSource = raw.is_open_source === "1";
  if (!isOpenSource) { reasons.push("Contract is not open source"); score -= 15; }
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  const riskLevel: TokenSecurity["riskLevel"] = 
    score >= 85 ? "safe" :
    score >= 65 ? "low" :
    score >= 40 ? "medium" :
    score >= 20 ? "high" : "critical";
  
  return {
    address,
    chain,
    isHoneypot,
    canTakeBackOwnership: raw.can_take_back_ownership === "1",
    ownerChangeBalance: raw.owner_change_balance === "1",
    hiddenOwner,
    selfDestruct,
    externalCall: raw.external_call === "1",
    buyTax,
    sellTax,
    transferPausable,
    cannotBuy: raw.cannot_buy === "1",
    cannotSellAll,
    tradingCooldown: raw.trading_cooldown === "1",
    isProxy,
    isMintable,
    slippageModifiable,
    personalSlippageModifiable: raw.personal_slippage_modifiable === "1",
    isBlacklisted,
    isWhitelisted: raw.is_whitelisted === "1",
    isAirdropScam,
    isAntiWhale: raw.is_anti_whale === "1",
    isTrueToken: raw.is_true_token === "1",
    isOpenSource,
    ownerAddress: raw.owner_address || null,
    ownerBalance: raw.owner_balance || "0",
    ownerPercent,
    creatorAddress: raw.creator_address || null,
    creatorPercent: parseFloat(raw.creator_percent || "0") * 100,
    totalSupply: raw.total_supply || "0",
    holderCount: parseInt(raw.holder_count || "0"),
    lpHolderCount: parseInt(raw.lp_holder_count || "0"),
    lpTotalSupply: raw.lp_total_supply || "0",
    isInDex: raw.is_in_dex === "1",
    topHolders: (raw.holders || []).slice(0, 10).map((h: any) => ({
      address: h.address,
      balance: h.balance,
      percent: parseFloat(h.percent || "0") * 100,
      isLocked: h.is_locked === 1,
      tag: h.tag,
    })),
    riskScore: score,
    riskLevel,
    riskReasons: reasons,
    rawResponse: raw,
  };
}

function normalizeAddressSecurity(address: string, raw: any): AddressSecurity {
  const reasons: string[] = [];
  let score = 100;
  
  const flags: Array<[string, string, number]> = [
    ["cybercrime", "Known cybercrime address", 80],
    ["money_laundering", "Known money laundering", 75],
    ["financial_crime", "Known financial crime", 70],
    ["sanctioned", "Sanctioned (OFAC)", 90],
    ["blackmail_activities", "Blackmail activities", 60],
    ["stealing_attack", "Stealing attack history", 65],
    ["phishing_activities", "Phishing activities", 60],
    ["fake_kyc", "Fake KYC", 40],
    ["malicious_mining_activities", "Malicious mining", 40],
    ["darkweb_transactions", "Darkweb transactions", 50],
    ["mixer", "Mixer address", 30],
    ["honeypot_related_address", "Honeypot related", 50],
    ["fake_standard_interface", "Fake standard interface", 30],
  ];
  
  for (const [key, label, penalty] of flags) {
    if (raw[key] === "1") {
      reasons.push(label);
      score -= penalty;
    }
  }
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel: AddressSecurity["riskLevel"] =
    score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical";
  
  return {
    address,
    dataSource: raw.data_source || null,
    isContract: raw.contract === "1",
    isSanctioned: raw.sanctioned === "1",
    isFinancialCrime: raw.financial_crime === "1",
    isBlackmail: raw.blackmail_activities === "1",
    isPhishingActivities: raw.phishing_activities === "1",
    isFakeKyc: raw.fake_kyc === "1",
    isStealingAttack: raw.stealing_attack === "1",
    isHoneypotRelatedAddress: raw.honeypot_related_address === "1",
    isMoneyLaundering: raw.money_laundering === "1",
    isDarkwebTransactions: raw.darkweb_transactions === "1",
    isMixer: raw.mixer === "1",
    isMaliciousMining: raw.malicious_mining_activities === "1",
    isCybercrime: raw.cybercrime === "1",
    isNumberOne: raw.number_of_malicious_contracts_created > 0,
    riskScore: score,
    riskLevel,
    riskReasons: reasons,
  };
}

function normalizeApprovalSecurity(chainId: string, contractAddress: string, raw: any): ApprovalSecurity {
  const reasons: string[] = [];
  let score = 100;
  
  if (raw.is_open_source === "0") { reasons.push("Contract not open source"); score -= 25; }
  if (raw.doxxed_owner === "0") { reasons.push("Owner not doxxed"); score -= 10; }
  if (raw.malicious_behavior?.length > 0) { reasons.push(`Malicious behavior: ${raw.malicious_behavior.join(", ")}`); score -= 60; }
  if (raw.malicious_creator_behavior?.length > 0) { reasons.push("Creator has malicious history"); score -= 40; }
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel: ApprovalSecurity["riskLevel"] =
    score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical";
  
  return {
    chainId,
    contractAddress,
    isOpenSource: raw.is_open_source === "1",
    isContract: raw.contract === "1",
    doxxedOwner: raw.doxxed_owner === "1",
    trustList: raw.trust_list === "1",
    malicious: (raw.malicious_behavior?.length || 0) > 0,
    creatorAddress: raw.creator_address || "",
    deployedTime: raw.deployed_time || "",
    riskScore: score,
    riskLevel,
    riskReasons: reasons,
  };
}
```

Build this in PHASE 1 of Batch 1 as part of the infrastructure. Every later feature imports from here.

───────────────────────────────────────────────────────────────────────────
SHARED UI COMPONENT — SECURITY BADGE (BUILD ONCE, USE EVERYWHERE)
───────────────────────────────────────────────────────────────────────────

Create /components/security/SecurityBadge.tsx:

```tsx
"use client";
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  score: number;
  level: "safe" | "low" | "medium" | "high" | "critical";
  reasons?: string[];
  compact?: boolean;
  onClick?: () => void;
}

export function SecurityBadge({ score, level, reasons = [], compact = false, onClick }: Props) {
  const config = {
    safe: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", Icon: ShieldCheck, label: "Safe" },
    low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", Icon: Shield, label: "Low Risk" },
    medium: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: ShieldAlert, label: "Caution" },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", Icon: AlertTriangle, label: "High Risk" },
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", Icon: XCircle, label: "Critical" },
  }[level];
  
  const { Icon, color, bg, border, label } = config;
  
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${bg} ${border} ${color}`}
        title={reasons.join("\n") || label}
      >
        <Icon size={12} />
        <span className="font-medium">{score}</span>
      </button>
    );
  }
  
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg} ${border} ${color} hover:opacity-80 transition`}>
      <Icon size={14} />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs opacity-70">({score}/100)</span>
    </button>
  );
}
```

Use this component in every place a token, wallet, or contract shows up anywhere on the platform.

───────────────────────────────────────────────────────────────────────────
GOPLUS INTEGRATION POINTS — FEATURE BY FEATURE
───────────────────────────────────────────────────────────────────────────

PHASE 2 — TRADING TERMINAL:

When token pair is selected in the terminal:
1. Call getTokenSecurity(chain, toTokenAddress) on selection
2. Show SecurityBadge next to pair in top bar
3. Click badge → opens modal with full security report
4. If riskLevel === "critical" or isHoneypot: block trading UI with warning "This token is flagged as high risk. Trading disabled for your protection. Unlock in expert mode with full acknowledgment."

PHASE 3 — LIMIT ORDERS + DCA + STOP-LOSS:

When user tries to place order:
1. Call getTokenSecurity on target token
2. If risk >= high: show blocking modal "Token flagged: [reasons]. Are you sure you want to continue?" — require checkbox confirmation
3. If isHoneypot=true: block entirely unless expert mode
4. Store security snapshot at time of order placement in orders JSONB metadata field

PHASE 4 — SWAP PAGE:

Multi-point GoPlus integration:
1. Token selector: every token in dropdown shows mini SecurityBadge next to symbol
2. After selecting "To" token: full security scan triggers, results shown in security card above swap button
3. High/critical risk: require user to click "Acknowledge Risk" checkbox before swap button enables
4. Approval check: if this swap requires approval, call getApprovalSecurity on router/spender — warn if malicious
5. Pre-execution summary includes security score
6. After swap, if unexpectedly high tax (actual output << expected), flag for user with GoPlus context

Add to /components/swap/PreExecutionSummary.tsx:
```tsx
{tokenSecurity && tokenSecurity.riskLevel !== "safe" && (
  <div className={`p-3 rounded-lg border ${tokenSecurity.riskLevel === "critical" ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
    <div className="flex items-center gap-2 mb-2">
      <AlertTriangle size={14} className={tokenSecurity.riskLevel === "critical" ? "text-red-400" : "text-amber-400"} />
      <span className="text-sm font-medium">Security Risk Detected</span>
      <SecurityBadge score={tokenSecurity.riskScore} level={tokenSecurity.riskLevel} compact />
    </div>
    <ul className="text-xs text-slate-400 space-y-1">
      {tokenSecurity.riskReasons.slice(0, 5).map((r, i) => <li key={i}>• {r}</li>)}
    </ul>
  </div>
)}
```

PHASE 5 — WHALE TRACKER:

When displaying whale activity involving a token:
1. Each whale_activity row: inline SecurityBadge for the token (compact mode)
2. Whale detail page → Tokens Held tab: SecurityBadge per token, sort by risk
3. Filter: "Hide flagged tokens" toggle in Recent Activity tab

For whale addresses themselves:
1. Call getAddressSecurity on every whale address on directory page load (batched, cached 6h)
2. Show SecurityBadge on whale cards — if sanctioned/cybercrime flag present, show red warning badge
3. Detail page header: full AddressSecurity report card

PHASE 6 — COPY TRADING:

Before executing copy trade:
1. getTokenSecurity on target token
2. getApprovalSecurity on swap router
3. getAddressSecurity on source whale address
4. If ANY returns critical risk → cancel copy trade, notify user "Copy cancelled: [reason]"
5. Store security context in user_copy_trades metadata

Add to user_copy_rules:
```sql
ALTER TABLE user_copy_rules ADD COLUMN IF NOT EXISTS min_security_score INT DEFAULT 40;
ALTER TABLE user_copy_rules ADD COLUMN IF NOT EXISTS block_on_honeypot BOOLEAN DEFAULT true;
ALTER TABLE user_copy_rules ADD COLUMN IF NOT EXISTS block_on_sanctioned BOOLEAN DEFAULT true;
```

PHASE 7 — WALLET CLUSTERS:

1. When analyzing a cluster, call getAddressSecurity for each member
2. Cluster detail page: members table includes SecurityBadge column
3. If any cluster member is sanctioned: entire cluster gets a red warning banner
4. AI cluster naming: feed GoPlus data into Claude prompt so cluster names reflect risk profile (e.g., "Phishing Farm Cluster" instead of generic name)

PHASE 8 — VTX AGENT:

Tools added to VTX system prompt:
- get_token_security(chain, address) — calls GoPlus, returns structured risk data
- get_address_security(address) — calls GoPlus for wallet risk
- check_phishing_url(url) — for URL scanning in chat

VTX auto-enriches responses:
- User asks about any token → VTX auto-calls get_token_security, injects risk context
- User asks about any wallet → VTX auto-calls get_address_security
- User pastes a URL → VTX auto-calls check_phishing_url
- If user initiates trade via chat: security check MANDATORY, trade card shows SecurityBadge

System prompt addition:
```
When the user asks about any token or wallet address, you MUST call the appropriate security tool (get_token_security, get_address_security) before responding. Include the security assessment in your response. If risk level is "high" or "critical", emphasize this clearly. Never recommend a trade on a flagged token without explicit risk warning.
```

PHASE 9 — SECURITY PAGES:

THE CORE PAGE — Security Scanner rebuild is essentially a full GoPlus visualization:

/app/dashboard/security-scanner/page.tsx:
- Input: token address + chain selector
- Tabs:
  1. Token Security (uses getTokenSecurity)
  2. Address Security (uses getAddressSecurity)
  3. Approval Security (uses getApprovalSecurity)
  4. Rugpull Risk (uses getRugpullRisk)
  5. NFT Security (uses getNftSecurity if NFT contract)
- Every tab: full structured report with every GoPlus field rendered
- Export report as PDF button
- Share report link button
- Set alert button (subscribe to re-scan when status changes)

Contract Intelligence /app/dashboard/contract-intelligence/page.tsx:
- For any contract, call getTokenSecurity + getApprovalSecurity + getAddressSecurity
- Show combined risk assessment
- Interaction decoder: if viewing a specific tx, call decodeTxInput to show what the contract call actually does (human-readable)

Approval Manager /app/dashboard/security/approvals/page.tsx:
- For each approval in user's wallets: call getApprovalSecurity on the spender
- Sort by risk descending
- Badge each approval with risk level
- "Revoke All Malicious" bulk action button

Phishing Check:
Add new sub-page /app/dashboard/security/phishing-check/page.tsx:
- User pastes URL → calls checkPhishingUrl
- Show result with website metadata, risk flags
- History of checks saved to user's search history

PHASE 10 — WALLET INTELLIGENCE:

On wallet detail page:
1. Top header: getAddressSecurity result → SecurityBadge prominent
2. If wallet is sanctioned: full-width red banner "This wallet is sanctioned/flagged. Interaction may have legal consequences."
3. Holdings tab: every token has SecurityBadge inline
4. Counterparties tab: every counterparty address has SecurityBadge, filter by "Hide safe" to see only risky interactions
5. Activity tab: transactions with flagged tokens highlighted

Alpha Intelligence Report (AI generated):
- Feed GoPlus data into Claude prompt
- Report must include "Security Profile" section: how often does this wallet interact with flagged tokens/addresses, what's the ratio of safe:risky exposure

PHASE 11 — SSE / REAL-TIME:

When whale activity event streams:
- Include token's current security score + level in event payload (pre-cached, near-instant)
- Client renders activity row with SecurityBadge inline
- If flagged: subtle red tint on the row

PHASE 12 — SELF-AUDIT:

Audit checklist for GoPlus integration:
- [ ] /lib/services/goplus.ts created and exported
- [ ] All 7 core functions implemented (token, address, approval, rugpull, nft, decode, phishing)
- [ ] Normalization returns consistent TokenSecurity/AddressSecurity/ApprovalSecurity shape
- [ ] Batch endpoint used where >5 tokens scanned
- [ ] All results cached via Redis (TTL appropriate to data freshness)
- [ ] Every feature integration point verified:
  - Trading Terminal pair selector
  - Limit/DCA/Stop-Loss order placement
  - Swap page pre-execution
  - Whale Tracker directory + detail + activity
  - Copy Trading execution
  - Wallet Clusters members
  - VTX Agent tools registered
  - Security Scanner full report
  - Contract Intelligence combined
  - Approval Manager per-approval
  - Wallet Intelligence top + tokens + counterparties + activity
  - SSE stream payloads
- [ ] SecurityBadge component used consistently
- [ ] Expert mode bypass works (user can acknowledge risk and proceed)
- [ ] Blocking logic works (honeypot = block unless expert)
- [ ] User-facing risk explanations clear (not just scores, actual reasons)

PHASE 13 — PLATFORM AUDIT:

Include dedicated "Security Integration" section:
- Coverage map: every feature + GoPlus integration status
- Performance: avg GoPlus call latency, cache hit rate
- Recommendations for Session 5B-2/5C: add GoPlus to NFT page, Sniper Bot pre-check, Portfolio page token-by-token, landing page "Rug detected today" ticker

═══════════════════════════════════════════════════════════════════════════
SECURITY MONITORING CRON (ADD TO VERCEL.JSON)
═══════════════════════════════════════════════════════════════════════════

Add cron in Phase 1 of Batch 1 to /vercel.json:
```json
{ "path": "/api/cron/security-monitor", "schedule": "0 */2 * * *" }
```

Create /app/api/cron/security-monitor/route.ts:
- Runs every 2 hours
- For every token in users' watchlists + active limit orders + DCA bots + stop-loss orders: call getTokenSecurity
- If risk level INCREASED since last scan (stored in token_risk_scores): trigger alert
- Notify affected users via their notification channels (push + Telegram)
- Users subscribed to "security alerts" get proactive warnings

This closes the loop: if a token they hold suddenly becomes a honeypot, they get notified immediately.

═══════════════════════════════════════════════════════════════════════════
USER SECURITY PREFERENCES TABLE (ADD TO BATCH 1 SQL)
═══════════════════════════════════════════════════════════════════════════

```sql
CREATE TABLE IF NOT EXISTS user_security_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  block_honeypots BOOLEAN DEFAULT true,
  block_sanctioned BOOLEAN DEFAULT true,
  min_security_score INT DEFAULT 40,
  warn_on_new_tokens_age_days INT DEFAULT 7,
  expert_mode_enabled BOOLEAN DEFAULT false,
  expert_mode_acknowledged_at TIMESTAMPTZ,
  auto_scan_on_watchlist_add BOOLEAN DEFAULT true,
  notify_on_security_degradation BOOLEAN DEFAULT true,
  phishing_url_auto_check BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_security_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_sec_prefs" ON user_security_preferences;
CREATE POLICY "users_own_sec_prefs" ON user_security_preferences FOR ALL TO authenticated USING (user_id = auth.uid());
```

Add Settings page section "Security Preferences" that edits these fields.

═══════════════════════════════════════════════════════════════════════════
END OF GOPLUS SECURITY ADDENDUM
═══════════════════════════════════════════════════════════════════════════

Apply this integration at the specified points throughout Session 5B-1. GoPlus is not a feature — it's infrastructure that makes every other feature safer. Treat it that way.
