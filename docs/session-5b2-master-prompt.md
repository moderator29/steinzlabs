═══════════════════════════════════════════════════════════════════════════════
NAKA LABS — SESSION 5B-2: FINISH EVERYTHING LEFT + NEXT-GEN VTX + DNA + PAYMENTS
═══════════════════════════════════════════════════════════════════════════════

Previous session (5B-1) shipped 13 phases + relayer gap-fill. Platform grade: 82/100. Four items were deferred as "not blockers" — this session starts by closing those gaps, then ships everything else left for production excellence.

You are a senior full-stack engineer at the top 1% level. Shipped at Nansen, Arkham, Phantom, Hyperliquid, Coinbase. You read code before you write code. You think deeply before you change anything. You build next-generation interfaces that make other developers stop and say "how did they do that?"

THINK MASSIVELY. THINK DEEPLY. THINK PERFECTLY. Fix every error you encounter while building. Never leave broken code. Every phase must ship clean.

═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE SESSION RULES
═══════════════════════════════════════════════════════════════════════════════

1. READ EXISTING CODE BEFORE MODIFYING. For every file you touch, open it, understand it, think about it, then improve it. Never blind-rewrite. Critical audit targets: /app/api/vtx-ai/route.ts, /components/vtx/*, /lib/trading/relayer.ts, /lib/services/*, /app/dashboard/wallet-intelligence/*, /app/dashboard/security/*, /app/dashboard/whale-tracker/*, /app/api/cron/*, admin routes. READ. THINK. UPGRADE.

2. THINK DEEPLY BEFORE EACH BATCH. Write a 10-line plan in /docs/session-5b2-batch-N-plan.md documenting: files you will read, architecture decisions, risks, commit boundaries, how features connect. Then execute.

3. FIX EVERY ERROR ENCOUNTERED. If you find broken code during the audit step, fix it immediately. If npm run build shows warnings, fix them. If a TypeScript error appears, fix it. If a lint error appears, fix it. Never ship a batch with known errors.

4. BATCH STRUCTURE (2 BATCHES TOTAL):
   - BATCH 1 = Phase 0 + Phases 1-8 (Relayer gap-fill audit + Payments + 2FA + Settings + GoPlus Removal + FULL VTX NEXT-GEN including backend rewrite, 8 tools, inline cards, 3-column UI, overview/preview flow). Run all 9 phases to completion. Commit after EVERY phase. Push after every commit. STOP at end of batch. Output consolidated Batch 1 SQL. Wait for user to say "Continue with Batch 2".
   - BATCH 2 = Phases 9-15 (DNA Analyzer + Contract Intelligence + On-Chain Relayer polish + Admin Panel Rebuild + Feature Interconnection + Final Audit). Only start when user says "Continue with Batch 2". Run all 7 phases to completion. Commit after every phase. STOP. Deliver final platform audit with ratings.

5. COMMIT + PUSH DISCIPLINE:
   ```
   git checkout main
   git pull origin main
   git checkout -b session-5b2-production
   git push -u origin session-5b2-production
   ```
   After EVERY phase:
   ```
   git add .
   git commit -m "Phase N: [description]"
   git push origin session-5b2-production
   ```
   NEVER create PRs — user creates on GitHub manually.

6. NO placeholder code. NO "any" types in new code. NO mock data. NO fake numbers. NO hardcoded stats. NO "demo" strings. NO TODO comments. NO "coming soon" anywhere. Real data or don't ship it.

7. UPGRADE EXISTING CODE. Read current file first. Understand it. Then improve it. Do NOT rewrite working code from scratch unless this prompt says "DELETE AND REBUILD".

8. BRANDING LOCKED:
   - Dark cyber-noir aesthetic — NO color changes
   - Neon blue accent (existing CSS vars only)
   - Naka Labs brand (user-facing), steinzlabs (internal package/paths)
   - All logos via /components/brand/Logo.tsx, /components/brand/AgentAvatar.tsx, /components/brand/NakaLoader.tsx
   - NO emojis in UI except inside VTX AI responses (sparingly)

9. GOPLUS IS SILENT INFRASTRUCTURE. Critical. Remove ALL user-facing GoPlus branding:
   - grep -rn "GoPlus\|goplus\|Go Plus\|Powered by GoPlus" app/ components/
   - Replace user-facing text with: "Security Verified", "Risk Analysis", "Safety Check", "Naka Security"
   - Keep /lib/services/goplus.ts (backend only)
   - Keep /docs/*.md references (internal dev docs)
   - UI NEVER says "GoPlus" — only "Security Verified ✓" with neutral shield icon
   - Same silent treatment as Alchemy, Helius, Anthropic
   - If component has "GoPlus" in name, rename it (GoPlusBadge → SecurityBadge)

10. NO markdown in AI responses from VTX or Customer Support. NO em dashes. NO asterisks for bold. NO bold markers. Plain conversational text. Cards render the structure, AI text stays concise.

11. FIX TypeScript errors immediately. Never leave broken builds. npm run build must exit 0 after every phase.

12. INSTITUTIONAL QUALITY. Every UI matches or exceeds Nansen, Arkham, Phantom, Hyperliquid, Coinbase Advanced.

13. NEXT-GEN FRONTEND:
    - Smooth Framer Motion transitions
    - Glassmorphism: bg-slate-950/80 backdrop-blur-xl border-slate-800/50
    - Neon blue accent lines with subtle glow
    - Micro-animations on hover/click
    - Skeleton loaders while data loads (never blank)
    - Error states with retry buttons
    - Empty states with helpful CTAs
    - Keyboard shortcuts where appropriate
    - Mobile-first responsive at 375px (iPhone SE)

14. CONTINUE MOMENTUM. When you finish a phase, immediately start the next phase in the batch. No pausing. Commit, push, move to next.

15. NON-CUSTODIAL ARCHITECTURE LOCKED. Platform never holds private keys. All trade signing happens client-side via MetaMask/Phantom/built-in-wallet-with-user-password. Never propose custodial infra. /lib/trading/builtinSigner.ts stub stays as "BuiltinAutoSigningNotSupported" marker.

─────────────────────────────────────────────────────────
TIMEOUT RESILIENCE
─────────────────────────────────────────────────────────

On timeout: note exact stop location in /docs/session-5b2-progress.md, type "TIMEOUT OCCURRED — RESUMING FROM: [location]", continue from that exact point. NEVER restart a phase.

If a file edit fails 3 times: skip it, log to /docs/session-5b2-skipped.md, continue, revisit at batch end.

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Platform: Naka Labs
Stack: Next.js 14, Supabase, Vercel Pro, TypeScript, Tailwind
Branch: session-5b2-production (from main after 5B-1 merged)
GitHub: moderator29/steinzlabs

Recent session history:
- Session 5A: Brand migration, login hotfix, dashboard redesign, GoPlus client, foundation SQL
- Session 5B-1: 13 phases (trading terminal, whale tracker, clusters, VTX, security, wallet intel, SSE) + relayer gap-fill (4 monitor crons + pending_trades flow)

ENV VARS (all exist, do not recreate):
Supabase, Alchemy, Anthropic, Resend, 0x, Jupiter, CoinGecko, DexScreener, Helius, Birdeye, Arkham, LunarCrush, GoPlus, VAPID, Turnstile, Sentry, PostHog, JWT_SECRET, SUPABASE_JWT_SECRET, TELEGRAM_BOT_TOKEN, Upstash Redis, CRON_SECRET, TELEGRAM_WEBHOOK_SECRET.

TREASURY WALLETS (existing, use these, do not create new):
- TREASURY_WALLET_EVM
- TREASURY_WALLET_SOL

KNOWN STATE FROM 5B-1 AUDIT:
- 82/100 platform grade
- All 19 5B-1 SQL tables present in Supabase (verified)
- Trading terminal functional (Phase 2 of 5B-1)
- Swap next-gen with 5 providers (Phase 4)
- Whale Tracker with 5K curated whales (Phase 5)
- Wallet Clusters with 2D force graph (Phase 7)
- VTX has ?q= and ?conversation= support (Phase 6)
- Security pages upgraded (Phase 9)
- Wallet Intelligence redesigned (Phase 10)
- SSE whale activity stream (Phase 11)
- Non-custodial relayer with pending_trades flow (gap-fill)

═══════════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════════
BATCH 1 — PHASE 0 + PHASES 1-8: FOUNDATIONS + FULL VTX NEXT-GEN REDESIGN
═══════════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════════

Execute Phase 0 through Phase 8 consecutively. Do NOT stop between phases. After Phase 8 is committed and pushed, STOP.

═══════════════════════════════════════════════════════════════════════════════
PHASE 0 — RELAYER GAP-FILL AUDIT + DEFERRED ITEMS + LIVE VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

Four items deferred from 5B-1 relayer gap-fill. Fix them all. Also audit the relayer itself end-to-end to verify it actually works in production-like conditions.

── TASK 0.1: READ + AUDIT RELAYER CODE ──

Read these files from 5B-1 gap-fill completely. Understand every line:
- /lib/trading/relayer.ts
- /lib/trading/builtinSigner.ts (stub)
- /lib/trading/notifications.ts
- /app/api/cron/limit-order-monitor/route.ts
- /app/api/cron/dca-executor/route.ts
- /app/api/cron/stop-loss-monitor/route.ts
- /app/api/cron/copy-trade-monitor/route.ts
- /app/api/cron/pending-trades-cleanup/route.ts
- /app/api/trading/pending-trades/route.ts
- /app/api/trading/pending-trades/[id]/confirm/route.ts
- /app/api/trading/pending-trades/[id]/reject/route.ts
- /components/trading/PendingTradesBanner.tsx
- /supabase/migrations/2026_session5b1_relayer.sql

Find and document in /docs/session-5b2-phase0-relayer-audit.md:
- Any bugs (code that doesn't actually do what it claims)
- Any TypeScript warnings or type mismatches
- Any broken error handling
- Any missing status transitions (e.g., pending_trade confirmed but source order not updated)
- Any places user confirmation could silently fail
- Any race conditions between monitor crons + user confirmation
- Any security gaps (e.g., user could confirm someone else's pending trade?)

Fix every issue found. Commit each fix separately.

── TASK 0.2: BUILD INLINE WALLET SIGNING HOOK ──

Problem: Current pending-trade confirm flow redirects to /dashboard/swap?pendingId=X. Not ideal UX — user loses context, has to navigate back.

Solution: Build window.__nakaSignPendingTrade global function that can be called from PendingTradesBanner directly without navigation.

Create /lib/wallet/pendingSigner.ts:
```ts
/**
 * Sign a pending trade inline without leaving the current page.
 * Supports EVM (MetaMask + built-in), Solana (Phantom + built-in).
 * Returns tx hash on success, throws on rejection.
 */
export async function signPendingTradeInline(params: {
  pendingId: string;
  chain: string;
  walletSource: 'external_evm' | 'external_solana' | 'builtin';
  routeData: any; // from pending_trades.route_data JSONB
}): Promise<{ txHash: string }> {
  // 1. If walletSource = external_evm: use window.ethereum.request with eth_sendTransaction (MetaMask signs inline)
  // 2. If walletSource = external_solana: use window.solana (Phantom) sendAndConfirm
  // 3. If walletSource = builtin: decrypt user's builtin wallet in browser, sign, broadcast via Alchemy/Helius
  //    - Built-in wallet decryption: use existing /lib/wallet/walletManager.ts patterns
  //    - User password prompt modal required (cannot auto-sign)
  // 4. After signing: POST tx_hash to /api/trading/pending-trades/[id]/confirm
  // 5. Return { txHash }
}
```

Attach to window in /app/dashboard/layout.tsx or via a client-only provider component:
```tsx
// At top of dashboard layout
useEffect(() => {
  (window as any).__nakaSignPendingTrade = signPendingTradeInline;
  return () => delete (window as any).__nakaSignPendingTrade;
}, []);
```

Update /components/trading/PendingTradesBanner.tsx:
- When user clicks "Confirm" button on a pending trade
- Call window.__nakaSignPendingTrade(...) inline — no redirect
- Show inline loading state during signing
- Show success toast with tx link on completion
- Show error toast on failure with retry option
- Keep fallback: if window.__nakaSignPendingTrade not mounted (shouldn't happen), fall back to /dashboard/swap?pendingId=X

Test mental model: banner appears → user clicks Confirm → password prompt (built-in) or wallet popup (MetaMask/Phantom) → user approves → tx broadcasts → banner shows success → moves off screen after 3s.

── TASK 0.3: ON-CHAIN RECEIPT RECONCILIATION CRON ──

Problem: After user confirms pending trade, we store tx_hash but don't verify actual on-chain result. Executed amount could differ from quote due to slippage, or tx could fail post-broadcast.

Create /app/api/cron/receipt-reconciliation/route.ts (runs every 2 min):
```ts
// Query pending_trades and source order tables (limit_orders, dca_executions, stop_loss_orders, user_copy_trades)
// Where status in ('confirmed', 'executed') AND actual_amount_out IS NULL AND tx_hash IS NOT NULL
// For each row:
//   - Fetch receipt from Alchemy (EVM) or Helius (Solana)
//   - If tx reverted: update status to 'failed', store revert reason
//   - If tx succeeded: parse logs to extract actual token output
//     EVM: decode Transfer events from tx logs
//     Solana: parse inner instructions + token balance changes
//   - Calculate actual_amount_out, actual_price, actual_slippage_bps, actual_gas_usd
//   - Update source order row with these fields
//   - If actual output < quote_output by > slippage tolerance: flag as "high slippage" for user notification
//
// Add columns to source tables if missing:
// - actual_amount_out, actual_price, actual_gas_usd, actual_slippage_bps, tx_reverted (BOOLEAN), revert_reason
```

Add to /vercel.json:
```json
{ "path": "/api/cron/receipt-reconciliation", "schedule": "*/2 * * * *" }
```

Create SQL migration for new columns:
```sql
-- Add receipt reconciliation columns to all relevant tables
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS actual_price NUMERIC;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS actual_gas_usd NUMERIC;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS actual_slippage_bps INTEGER;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS tx_reverted BOOLEAN DEFAULT false;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS revert_reason TEXT;
ALTER TABLE limit_orders ADD COLUMN IF NOT EXISTS receipt_reconciled_at TIMESTAMPTZ;

-- Same for dca_executions, stop_loss_orders, user_copy_trades
ALTER TABLE dca_executions ADD COLUMN IF NOT EXISTS actual_amount_out NUMERIC;
-- ... (all 4 fields on each table)

-- Index for reconciliation cron performance
CREATE INDEX IF NOT EXISTS limit_orders_pending_reconcile_idx ON limit_orders(receipt_reconciled_at) WHERE tx_hash IS NOT NULL AND actual_amount_out IS NULL;
CREATE INDEX IF NOT EXISTS dca_executions_pending_reconcile_idx ON dca_executions(receipt_reconciled_at) WHERE tx_hash IS NOT NULL AND actual_amount_out IS NULL;
CREATE INDEX IF NOT EXISTS stop_loss_pending_reconcile_idx ON stop_loss_orders(receipt_reconciled_at) WHERE triggered_tx_hash IS NOT NULL AND actual_amount_out IS NULL;
CREATE INDEX IF NOT EXISTS copy_trades_pending_reconcile_idx ON user_copy_trades(receipt_reconciled_at) WHERE copied_tx_hash IS NOT NULL AND actual_amount_out IS NULL;
```

Output SQL in Phase 0 report for user to run in Supabase.

── TASK 0.4: COPY-TRADE SELL DIRECTION ──

Problem: Current copy-trade-monitor only processes 'buy' whale actions. If a whale sells, user's copy is ignored.

Fix /app/api/cron/copy-trade-monitor/route.ts:
- Query whale_activity for both 'buy' AND 'sell' actions
- For 'sell' action: check if user holds the token being sold (query user's wallet balance via Alchemy/Helius)
- If user holds >= (whale_sell_amount_as_pct_of_whale_holdings * user_balance), trigger copy-sell
- Size proportional to user's position (not absolute USD)
- Respect user_copy_rules: min_liquidity_usd, chains_allowed
- GoPlus check: sell action bypasses honeypot gate (selling OUT of a token is exit, not entry)
- Create pending trade with action='sell'

Update /lib/trading/relayer.ts to handle sell direction:
- executeTrade with intent.action='sell' OR infer from from_token / to_token direction
- Route: sell token → receive USDC (or stablecoin on user's preferred chain)
- Safety: still check GoPlus address_security on the pair (prevent selling into scammer)

── TASK 0.5: LIVE END-TO-END VERIFICATION ──

This is critical — prove the relayer actually works.

Create /scripts/verify-relayer-live.ts:
```ts
/**
 * End-to-end relayer verification script.
 * Run with: npx tsx scripts/verify-relayer-live.ts
 *
 * Creates a test limit order for a known safe token at a realistic trigger price.
 * Waits for monitor cron to detect it and create pending trade.
 * Logs each step. User manually confirms and we verify status transition.
 */
```

More importantly, create /docs/session-5b2-phase0-verification.md documenting:

1. How the relayer flow actually works (diagram + narrative)
2. What tables are involved at each step
3. How to debug if a pending trade doesn't appear
4. How to debug if a confirmed tx doesn't update source order
5. SQL queries to check system health:
   - `SELECT COUNT(*) FROM pending_trades WHERE status='pending' AND expires_at > NOW()`
   - `SELECT status, COUNT(*) FROM limit_orders GROUP BY status`
   - `SELECT status, COUNT(*) FROM dca_bots GROUP BY status`
   - etc.

This becomes the ops runbook for the relayer.

── TASK 0.6: MONITORING DASHBOARD WIDGET ──

Create /components/admin/RelayerHealthCard.tsx for admin panel:
- Shows live stats: active limit orders, active DCA bots, active SL/TP, pending trades (by status)
- Cron execution success rate last 24h (from cron_execution_log table)
- Recent failures with reason
- Link to full admin monitoring

── TASK 0.7: COMMIT PHASE 0 ──

Commit each task separately:
1. Relayer audit findings + fixes
2. Inline wallet signing hook + PendingTradesBanner update
3. Receipt reconciliation cron + SQL
4. Copy-trade sell direction
5. Verification script + ops runbook
6. Admin monitoring widget

Push after each commit. Final commit message: "Phase 0: Relayer gap-fill complete — inline signing, receipt reconciliation, sell direction, live verification, monitoring"

═══════════════════════════════════════════════════════════════════════════════
PHASE 1 — CRYPTO PAYMENTS INTEGRATION
═══════════════════════════════════════════════════════════════════════════════

User pays for tier upgrades via USDC/SOL/ETH to treasury wallets. Backend detects payment, upgrades tier automatically. No Stripe. No credit cards.

Pricing tiers (already defined in existing pricing page):
- Free: $0/mo (default)
- Mini: $6/mo
- Pro: $9/mo  
- Max: $15/mo

── TASK 1.1: SQL MIGRATION FOR PAYMENTS ──

```sql
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('mini', 'pro', 'max')),
  amount_usd NUMERIC NOT NULL,
  accepted_tokens TEXT[] NOT NULL,
  treasury_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  memo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'detecting', 'confirmed', 'expired', 'failed')),
  detected_tx_hash TEXT,
  detected_amount NUMERIC,
  detected_token TEXT,
  detected_from_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_intents_memo_idx ON payment_intents(memo);
CREATE INDEX IF NOT EXISTS payment_intents_user_status_idx ON payment_intents(user_id, status);
CREATE INDEX IF NOT EXISTS payment_intents_detecting_idx ON payment_intents(status, expires_at) WHERE status IN ('awaiting_payment', 'detecting');
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_payments" ON payment_intents;
CREATE POLICY "users_own_payments" ON payment_intents FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_payments" ON payment_intents;
CREATE POLICY "service_role_payments" ON payment_intents FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_intent_id UUID REFERENCES payment_intents(id),
  action TEXT NOT NULL CHECK (action IN ('upgrade', 'renewal', 'downgrade', 'refund')),
  from_tier TEXT,
  to_tier TEXT NOT NULL,
  period_months INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NOT NULL,
  amount_paid_usd NUMERIC,
  amount_paid_token NUMERIC,
  paid_token TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sub_history_user_idx ON subscription_history(user_id, created_at DESC);
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_sub_history" ON subscription_history;
CREATE POLICY "users_read_own_sub_history" ON subscription_history FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_sub_history" ON subscription_history;
CREATE POLICY "service_role_sub_history" ON subscription_history FOR ALL TO service_role USING (true);

-- Add subscription fields to profiles if not present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'mini', 'pro', 'max'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_auto_renew BOOLEAN DEFAULT false;
```

── TASK 1.2: PAYMENT FLOW BACKEND ──

Create /app/api/payments/create-intent/route.ts:
- User selects tier → creates payment_intents row
- Generates unique memo (8-char alphanumeric)
- Computes token amounts based on current prices (via CoinGecko):
  - USDC: exact $6/$9/$15
  - SOL: amount_usd / sol_price + 0.5% buffer
  - ETH: amount_usd / eth_price + 0.5% buffer
- Returns payment instructions:
  - treasury_address (TREASURY_WALLET_EVM for ETH/USDC on EVM chains, TREASURY_WALLET_SOL for SOL/USDC on Solana)
  - amount per token
  - memo (must be included in tx note for Solana, or appended to tx input data for EVM)
  - expires_at (15 minutes from creation)
  - QR code data

Create /app/api/cron/payment-detector/route.ts (runs every 30 sec):
- Query payment_intents where status in ('awaiting_payment', 'detecting')
- For each: check if corresponding tx arrived at treasury address
  - EVM: use Alchemy getAssetTransfers with toAddress = treasury, filter by memo in input data
  - Solana: use Helius getSignaturesForAddress on treasury + parse each tx for memo
- If tx found matching memo:
  - Verify amount matches within 1% tolerance
  - Verify token is in accepted_tokens
  - Mark intent as 'confirmed', store tx_hash, detected_amount
  - Upgrade user tier via /lib/subscriptions/upgradeUserTier(user_id, tier)
  - Insert subscription_history row
  - Set profiles.tier_expires_at = NOW() + 30 days
  - Send confirmation notification (push + Telegram)
- If expires_at passed and no payment: mark 'expired'

Add to /vercel.json:
```json
{ "path": "/api/cron/payment-detector", "schedule": "*/30 * * * * *" }
```
Wait — Vercel crons minimum is 1 minute. Use:
```json
{ "path": "/api/cron/payment-detector", "schedule": "* * * * *" }
```

Create /lib/subscriptions/upgradeUserTier.ts with logic:
- If user already has active subscription: extend by 30 days from current expiry
- If upgrade from lower tier mid-period: prorate remaining value + extend

── TASK 1.3: PAYMENT FLOW UI ──

UPGRADE /app/dashboard/pricing/page.tsx (read existing first). New components:

/components/payments/TierUpgradeModal.tsx:
- User clicks "Upgrade to Pro" → modal opens
- Step 1: confirm tier + period (monthly)
- Step 2: select token (USDC / SOL / ETH) + chain (Ethereum / Base / Solana / Arbitrum)
- Step 3: payment instructions card:
  - Large QR code
  - Treasury address (copy button)
  - Exact amount (copy button)
  - IMPORTANT: memo field (copy button) — user MUST include in tx
  - 15-min countdown timer
  - "I've sent the payment" button (doesn't affect anything — payment detector runs regardless)
- Step 4: confirmation screen shown when payment detected
  - Green check
  - Tx hash + block explorer link
  - "Your Pro subscription is active until YYYY-MM-DD"

/components/payments/ActiveSubscriptionCard.tsx:
- Shows on Settings → Billing
- Current tier, renewal date, payment history
- "Renew Now" button
- "Cancel" (no auto-renew) / "Enable auto-renew" toggle

── TASK 1.4: PAYMENT SECURITY ──

- Treasury addresses in env vars, NEVER in frontend code
- Frontend receives treasury address from /api/payments/create-intent only after auth
- Rate limit: user can only have 3 active payment_intents at once
- Memo uniqueness: must be unique across all payment_intents, collision = retry with new memo
- Amount tolerance: 1% below is accepted (covers network fee rounding), > 1% above is accepted (user overpaid, we grant tier anyway and note in subscription_history)
- Below tolerance: intent stays in 'awaiting_payment', user notified of partial payment

── TASK 1.5: TIER ENFORCEMENT MIDDLEWARE ──

Upgrade /middleware.ts or create /lib/subscriptions/tierGuard.ts:
- For every request to a Pro/Max-only feature, check profiles.tier + tier_expires_at
- If expired: show upgrade banner
- If wrong tier: redirect to pricing with `?locked_feature=x`
- Features per tier documented in /docs/tier-gates.md

Known Pro/Max gates:
- VTX Agent: Pro (500 messages/month), Max (unlimited)
- Whale Tracker follow count: Free (3), Mini (10), Pro (50), Max (unlimited)
- Copy Trading: Mini+ only
- Stop-Loss with trailing: Pro+ only
- Priority cron execution for Max tier

Apply these gates in relevant API routes.

── TASK 1.6: COMMIT PHASE 1 ──

```
git add .
git commit -m "Phase 1: Crypto Payments — USDC/SOL/ETH to treasury, payment detector cron, tier upgrade flow, subscription history, tier gates"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 2 — 2FA (TOTP + RECOVERY CODES + DEVICE LIST)
═══════════════════════════════════════════════════════════════════════════════

Full 2FA enrollment and enforcement. TOTP-based (Google Authenticator / Authy / 1Password).

── TASK 2.1: SQL MIGRATION FOR 2FA ──

```sql
CREATE TABLE IF NOT EXISTS user_2fa (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  secret_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted TOTP secret
  secret_iv TEXT NOT NULL,
  backup_codes_encrypted TEXT NOT NULL, -- array of 10 codes
  backup_codes_used BOOLEAN[] NOT NULL DEFAULT '{false,false,false,false,false,false,false,false,false,false}',
  enrolled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_2fa" ON user_2fa;
CREATE POLICY "users_own_2fa" ON user_2fa FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_2fa" ON user_2fa;
CREATE POLICY "service_role_2fa" ON user_2fa FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS trusted_devices_user_idx ON trusted_devices(user_id, last_seen_at DESC);
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_devices" ON trusted_devices;
CREATE POLICY "users_own_devices" ON trusted_devices FOR ALL TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "service_role_devices" ON trusted_devices;
CREATE POLICY "service_role_devices" ON trusted_devices FOR ALL TO service_role USING (true);
```

── TASK 2.2: 2FA BACKEND ──

Install: npm install speakeasy qrcode

Create /lib/auth/totp.ts:
- generateSecret() → { base32, otpauthUrl }
- verifyToken(secret, code) → boolean
- encryptSecret(secret) / decryptSecret(encrypted, iv) using AES-256-GCM (reuse /lib/wallet/encryption.ts patterns)
- generateBackupCodes() → 10 random 8-char codes
- hashBackupCode(code) for secure storage

Create /app/api/auth/2fa/enroll/route.ts (POST):
- Generate TOTP secret
- Return QR code SVG + backup codes (PLAIN TEXT — only shown once)
- Store encrypted secret + hashed backup codes in user_2fa
- Set enabled=false until user verifies with first code

Create /app/api/auth/2fa/verify/route.ts (POST):
- User submits TOTP code from authenticator
- Decrypt stored secret
- Verify code against current TOTP
- If valid: set user_2fa.enabled=true, enrolled_at=NOW()
- Return success

Create /app/api/auth/2fa/challenge/route.ts (POST):
- Called during login after password verified (if 2FA enabled)
- Accepts TOTP code OR backup code
- If TOTP code valid: authenticated, mark as trusted device if "Remember this device"
- If backup code: verify against stored hashes, mark as used, warn user they have N backup codes left
- Return session token

Create /app/api/auth/2fa/disable/route.ts (POST):
- Requires current password + valid TOTP code
- Sets enabled=false
- Keeps secret in DB (user can re-enable without re-enrolling)

Create /app/api/auth/2fa/regenerate-backup-codes/route.ts (POST):
- Requires valid TOTP code
- Generates new 10 backup codes
- Returns plain text once
- Stores new hashes

── TASK 2.3: 2FA UI ──

/app/dashboard/settings/security/page.tsx — security settings page with:
- 2FA section: toggle, status (enabled/disabled)
- If disabled + user clicks enable → enrollment modal
- If enabled → "Disable 2FA" + "Regenerate backup codes" + "View used codes count"

/components/auth/TwoFactorEnrollmentModal.tsx:
- Step 1: "Scan QR with your authenticator app" — show QR + manual entry secret
- Step 2: "Enter code from app to verify" — input field
- Step 3: "Save your backup codes" — 10 codes in monospace, print/download/copy options, required checkbox "I've saved these codes"
- Step 4: Done — 2FA now active

/components/auth/TwoFactorChallenge.tsx:
- Inserted into login flow after password
- "Enter code from your authenticator app" with 6-digit input
- "Use backup code instead" link → accepts 8-char code
- "Remember this device for 30 days" checkbox
- On success: continue to dashboard

/components/auth/TrustedDevicesList.tsx:
- Shows active trusted devices
- Columns: device name, last seen, IP/city, expires at
- "Revoke" button per device
- "Revoke All" nuclear button

── TASK 2.4: LOGIN FLOW INTEGRATION ──

Update /app/login/page.tsx:
- After password check, query user_2fa.enabled
- If enabled: check trusted_devices for current device_id (read from cookie or localStorage)
- If trusted and not expired: proceed to dashboard
- If not trusted or expired: show TwoFactorChallenge
- On successful challenge: if user checked "Remember", create trusted_device row with 30-day expiry + set cookie

Device ID: hash of (user_agent + accept_headers + screen_resolution) stored in httpOnly cookie. Simple fingerprint, not bulletproof but good enough for convenience layer.

── TASK 2.5: COMMIT PHASE 2 ──

```
git add .
git commit -m "Phase 2: 2FA — TOTP enrollment, backup codes, trusted devices with 30-day remember, full login integration"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 3 — SETTINGS INSTITUTIONAL REBUILD
═══════════════════════════════════════════════════════════════════════════════

Current /app/dashboard/settings/* is likely a dumping ground. Consolidate into proper sections with institutional UI.

── TASK 3.1: READ EXISTING SETTINGS ──

Audit every file under /app/dashboard/settings/ and /app/dashboard/profile/. List what exists, what's duplicated, what's missing.

── TASK 3.2: NEW SETTINGS STRUCTURE ──

DELETE AND REBUILD if necessary. New structure:

/app/dashboard/settings/page.tsx — overview with cards linking to sections
/app/dashboard/settings/profile/page.tsx — display name, username, email (read-only), avatar, timezone, locale (future i18n)
/app/dashboard/settings/security/page.tsx — password change, 2FA (from Phase 2), trusted devices, login history
/app/dashboard/settings/notifications/page.tsx — email preferences, push notification settings, Telegram link management, notification digest
/app/dashboard/settings/trading/page.tsx — default slippage, expert mode toggle, MEV protection, default chart timeframe, default indicators, auto-approve under $X
/app/dashboard/settings/billing/page.tsx — current tier, renewal date, payment history, upgrade/downgrade, auto-renew
/app/dashboard/settings/integrations/page.tsx — Telegram bot link, API keys (future 5C), webhook URLs (future 5C)
/app/dashboard/settings/wallets/page.tsx — connected wallets management (external MetaMask/Phantom + built-in Steinz)
/app/dashboard/settings/privacy/page.tsx — data export, account deletion, visibility preferences
/app/dashboard/settings/preferences/page.tsx — dashboard layout preferences, default landing tab, collapsed/expanded sidebar, theme (always dark for now), keyboard shortcuts toggle

Each page: institutional feel, data-dense, tight spacing, form fields inline-edited with auto-save and visual confirmation.

── TASK 3.3: ACCOUNT DELETION FLOW ──

Privacy → "Delete Account" with:
- Required: current password
- Required: TOTP code (if 2FA enabled)
- Required: typing username to confirm
- 7-day grace period (soft delete, flag account, can be restored by login within 7 days)
- After 7 days: cron-based hard delete of user data + anonymize activity logs
- Email notification at soft delete + at hard delete

Create /app/api/user/delete/route.ts (POST) + /app/api/cron/account-deletion/route.ts (runs daily 4am UTC).

── TASK 3.4: DATA EXPORT ──

Privacy → "Export My Data" button
- GDPR compliance
- Generates JSON export: all user rows across all tables where user_id = current_user
- Email delivery via Resend with signed download link (expires in 24h)
- Job-queued via Upstash Redis, result stored in Supabase Storage temporarily

── TASK 3.5: COMMIT PHASE 3 ──

```
git add .
git commit -m "Phase 3: Settings institutional rebuild — 10 sections, account deletion flow, GDPR data export, auto-save everywhere"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 4 — GOPLUS BRANDING REMOVAL (SILENT INFRASTRUCTURE)
═══════════════════════════════════════════════════════════════════════════════

GoPlus is our security engine. Users don't need to know it's GoPlus — it's Naka security. Same as Alchemy/Helius, invisible to users.

── TASK 4.1: FULL CODEBASE SCAN ──

Run:
```
grep -rn "GoPlus\|goplus\|Go Plus\|Powered by GoPlus\|gopluslabs" app/ components/ --include="*.tsx" --include="*.ts" --include="*.css" > /tmp/goplus-mentions.txt
wc -l /tmp/goplus-mentions.txt
```

Document every mention in /docs/session-5b2-goplus-removal.md.

── TASK 4.2: REPLACE USER-FACING TEXT ──

For each UI mention:
- "Powered by GoPlus" → remove entirely OR "Security verified by Naka"
- "GoPlus Security Score" → "Security Score"
- "GoPlus flagged" → "Flagged by Naka Security"
- "GoPlus says honeypot" → "Token flagged as honeypot"
- Shield icons: keep, but no GoPlus logo anywhere

── TASK 4.3: RENAME COMPONENTS ──

If any component/class has "GoPlus" in name:
- GoPlusBadge → SecurityBadge (already built in 5B-1 relayer)
- GoPlusReport → SecurityReport
- GoPlusAlert → SecurityAlert
- etc.

Git-aware rename (not just text replace):
```
git mv components/security/GoPlusBadge.tsx components/security/SecurityBadge.tsx
# update all imports
```

── TASK 4.4: KEEP BACKEND REFERENCES ──

- /lib/services/goplus.ts stays (backend only, never imported in client components as user-visible)
- /docs/*.md references stay (internal dev docs)
- Env var names (GOPLUS_APP_KEY, GOPLUS_APP_SECRET) stay

── TASK 4.5: AUDIT ENFORCED ──

After changes, re-run the grep. Should return ONLY /lib/services/goplus.ts + /docs/ references. If any client-facing code still mentions GoPlus, fix.

── TASK 4.6: COMMIT PHASE 4 ──

```
git add .
git commit -m "Phase 4: GoPlus branding removed — silent security infrastructure, user-facing text says Naka Security"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 5 — VTX AGENT BACKEND FULL REWRITE
═══════════════════════════════════════════════════════════════════════════════

VTX is the centerpiece of Naka Labs. Current state (from 5B-1 Phase 8): 3-column UI with basic tool use. This phase rewrites the backend for production excellence.

── TASK 5.1: AUDIT EXISTING VTX ──

Read in full:
- /app/api/vtx-ai/route.ts (main inference endpoint)
- /app/api/vtx/conversations/route.ts
- /lib/vtx/* (any helper files)
- /components/vtx/*

Identify:
- Current tool definitions (from 5B-1 Phase 8)
- Rate limiting approach
- Streaming pattern
- Conversation state management
- Error handling
- Prompt construction

── TASK 5.2: NEW VTX ARCHITECTURE ──

Use Claude Sonnet 4.6 (current latest, check via web_search if in doubt). Stream with SSE.

Upgrade /app/api/vtx-ai/route.ts:

System prompt (master version, locked):
```
You are VTX, Naka Labs' on-chain intelligence agent. You analyze crypto markets, wallets, whales, tokens, and transactions with institutional rigor.

Core principles:
1. Use tools before answering factual questions. Never guess prices, token stats, or wallet activity.
2. Be concise. Data-dense. No markdown, no asterisks, no em dashes. Plain text with numbered lists where helpful.
3. For any token or wallet mentioned: auto-call get_token_security or get_address_security. Security first.
4. Cite data sources inline (e.g., "price $43.21 via DexScreener 2s ago").
5. When user wants to trade: call prepare_swap, render SwapCard, let user click Execute.
6. For complex questions requiring multiple lookups: chain tool calls efficiently, synthesize at the end.
7. Expert mode users (they'll be flagged in context): can bypass honeypot warnings with explicit acknowledgment.
8. NEVER recommend trades. You are analysis, not advice. User decides.

Capabilities overview you can describe when asked what you do:
- Real-time token analytics (price, volume, liquidity, holders)
- Wallet intelligence (portfolio, PnL, trading DNA, counterparties)
- Whale tracking (who's moving, what they're buying)
- Security analysis (honeypot, rugpull, contract risks)
- Swap execution (quote + inline trade via pending-trades flow)
- Alert management (set price alerts, whale follow alerts)
- Cluster analysis (identify coordinated wallet groups)
- Trend detection (what's pumping, what narratives are forming)

Tone: institutional but approachable. Think senior analyst at Nansen. No hype, no emojis (sparingly for emphasis only). User is sharp, don't patronize.
```

── TASK 5.3: TOOL DEFINITIONS (8 CORE TOOLS) ──

Implement these 8 tools with proper Anthropic tool_use schemas:

1. **get_token_price** — {chain, token_address or symbol} → price, 24h change, volume, liquidity, mcap
2. **get_token_security** — {chain, token_address} → full GoPlus report (risk score, flags, reasons)
3. **get_address_security** — {address} → GoPlus address security check (sanctioned? phishing? mixer?)
4. **analyze_wallet** — {address, chain} → portfolio, PnL, top holdings, recent activity, archetype
5. **get_whale_activity** — {filters: token?, min_value?, time_range?} → recent whale transactions matching filters
6. **get_trending** — {chain?, timeframe?} → top movers, new launches, narratives trending
7. **prepare_swap** — {from_token, to_token, amount, chain, wallet_source} → quote from swap-aggregator, returns SwapCard data
8. **set_alert** — {type: price|whale|security, target, threshold} → creates alert in user's account

Tool execution happens server-side. Each tool returns structured data that VTX uses to synthesize response + optionally renders as inline card.

── TASK 5.4: STREAMING + TOOL USE LOOP ──

Multi-turn tool use pattern:
1. User message arrives → start streaming
2. Claude requests tool use → backend executes tool → stream tool result back to Claude
3. Claude synthesizes → continues streaming text response
4. If Claude requests another tool → loop
5. Maximum 5 tool calls per user message (prevent infinite loops)
6. Final response may include inline cards (detected via structured markers in stream)

Use AbortController for cleanup on disconnect.

── TASK 5.5: RATE LIMITING ──

- Free tier: 20 messages/day, max 2 tools per message, Claude Haiku 4.5
- Mini tier: 100 messages/day, max 3 tools per message, Haiku or Sonnet fallback
- Pro tier: 500 messages/day, max 5 tools per message, Claude Sonnet 4.6
- Max tier: unlimited, max 5 tools per message, Sonnet 4.6 priority queue

Rate limit keys in Redis:
- `vtx:rate:user:{userId}:day:{YYYY-MM-DD}` → count
- `vtx:rate:tools:req:{requestId}` → count

Reset daily via /app/api/cron/vtx-usage-reset/route.ts (already exists from 5A, verify it clears Redis keys properly).

── TASK 5.6: CONVERSATION PERSISTENCE ──

Each user message + Claude response stored in vtx_conversations / vtx_messages tables.

If tables don't exist create them:
```sql
CREATE TABLE IF NOT EXISTS vtx_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS vtx_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES vtx_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content JSONB NOT NULL,
  model TEXT,
  tokens_in INT,
  tokens_out INT,
  tools_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vtx_conv_user_idx ON vtx_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vtx_msg_conv_idx ON vtx_messages(conversation_id, created_at ASC);
```

Auto-title conversations: after 2 messages, ask Claude to generate a 4-word title from context.

── TASK 5.7: COMMIT PHASE 5 ──

```
git add .
git commit -m "Phase 5: VTX backend rewrite — Sonnet 4.6, 8 core tools, streaming tool use loop, rate limits per tier, conversation persistence"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 6 — VTX INLINE CARD SYSTEM (7 CARD TYPES)
═══════════════════════════════════════════════════════════════════════════════

Cards make VTX responses interactive. Text explains, cards provide structured data + actions.

── TASK 6.1: CARD PROTOCOL ──

VTX response stream can embed cards via structured markers:
```
Here's the current price: [[CARD:token_price:{"address":"...","chain":"..."}]]. The token is healthy with...
```

Client parses markers and renders React components inline.

Create /lib/vtx/cardParser.ts with markdown-like tokenizer that extracts cards from stream.

── TASK 6.2: 7 CARD COMPONENTS ──

All under /components/vtx/cards/:

1. **TokenCard.tsx** — token info: logo, name, symbol, price, 24h chart sparkline, volume, liquidity, mcap, security badge, action buttons (buy, sell, track, alert)

2. **SwapCard.tsx** — swap preview: from/to tokens, amounts, rate, route, price impact, security status, Execute button (calls pending-trades flow via relayer)

3. **WalletCard.tsx** — wallet overview: address, label (if whale), portfolio value, 30d PnL, top holdings preview, follow button, full profile link

4. **ChartCard.tsx** — inline chart: uses lightweight-charts, token + timeframe + indicators specified by Claude, click to open full trading terminal

5. **AlertCard.tsx** — alert configuration preview: alert type, conditions, channels (push/telegram), edit/save buttons

6. **SecurityCard.tsx** — deep security report: risk score, level, category breakdown, flags list, recommendation

7. **WhaleActivityCard.tsx** — recent whale moves: timeline view with whale labels, actions, values, tokens, tx links

Each card:
- Branded: bg-slate-900/60 border-slate-800 rounded-xl
- Loading state (skeleton)
- Error state (fallback text)
- Interactive (buttons route to full pages or trigger actions)
- Mobile-responsive

── TASK 6.3: CARD RENDERER ──

Create /components/vtx/MessageRenderer.tsx:
- Parses message content (text + cards)
- Renders text as plain prose
- Renders cards as React components in-flow
- Handles scroll pinning (stays at bottom during stream)

── TASK 6.4: COMMIT PHASE 6 ──

```
git add .
git commit -m "Phase 6: VTX inline card system — 7 card types (token, swap, wallet, chart, alert, security, whale activity), parser + renderer"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 7 — VTX 3-COLUMN INSTITUTIONAL UI
═══════════════════════════════════════════════════════════════════════════════

UPGRADE the existing 3-column layout from 5B-1 Phase 8 to production excellence.

── TASK 7.1: AUDIT + UPGRADE ──

Read /app/dashboard/vtx-ai/page.tsx fully. Upgrade while preserving working functionality.

── TASK 7.2: LEFT SIDEBAR (SESSIONS) ──

- "+ New Chat" button (prominent, top)
- Search sessions box
- Grouped list: Today, Yesterday, This Week, This Month, Older
- Each session: title (editable), last message snippet, timestamp
- Hover: show delete + archive icons
- Active session highlighted
- Footer: credit counter "X / 2000 messages today" (or Pro: "Unlimited")
- Collapse/expand on mobile

── TASK 7.3: MAIN AREA ──

- Top: session title (click to rename inline), share button, archive button, delete button
- Messages scroll area with virtualization if >50 messages
- Each message: 
  - User: right-aligned, monospace font for addresses if detected
  - Assistant: left-aligned with agent avatar, supports inline cards
  - Tool use: collapsible "VTX checked X" indicator
- Auto-scroll to bottom during streaming, pause auto-scroll if user scrolls up
- Bottom: input bar with:
  - Textarea (auto-expanding, max 10 lines)
  - Naka Prompts button (opens overlay panel)
  - Expert mode toggle (Pro+ only)
  - Trade mode toggle (allows prepare_swap tool)
  - Send button (disabled when empty or at rate limit)
  - Credit display inline with Send

── TASK 7.4: RIGHT SIDEBAR (CONTEXT) ──

Shows "pinned" context that VTX can reference:
- Pinned tokens (live prices update)
- Pinned wallets (recent activity)
- Pinned insights (user-saved analysis)
- User can toggle with keyboard shortcut Ctrl+/
- VTX tool outputs can auto-pin to this panel via new tool: pin_to_context

── TASK 7.5: RESPONSIVE ──

Mobile (< 768px):
- Left sidebar hidden by default, opens as overlay
- Right sidebar hidden by default, opens as overlay
- Main area full width
- Input bar sticky bottom

Tablet (768-1024px):
- Left sidebar collapsed to icons-only by default
- Right sidebar hidden by default
- Main area flex-grow

Desktop (> 1024px):
- All 3 columns visible
- Left 280px, Right 320px, Main flex-grow

── TASK 7.6: KEYBOARD SHORTCUTS ──

- Cmd/Ctrl + K: focus search
- Cmd/Ctrl + N: new chat
- Cmd/Ctrl + /: toggle right sidebar
- Cmd/Ctrl + Enter: send message (if input focused)
- Up arrow on empty input: edit last user message
- Escape: close any open overlay

── TASK 7.7: COMMIT PHASE 7 ──

```
git add .
git commit -m "Phase 7: VTX 3-column institutional UI — sessions sidebar, main chat with cards, context panel, keyboard shortcuts, responsive"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 8 — VTX OVERVIEW / PREVIEW FLOW (CONNECT EVERYTHING)
═══════════════════════════════════════════════════════════════════════════════

VTX is the mesh layer connecting all features. This phase wires it everywhere.

── TASK 8.1: ENTRY POINTS ──

VTX accessible from every feature:
- Dashboard MiniVtxPanel (from 5A Fix 2 — verify still works)
- Global floating button (top-right on every dashboard page)
- Cmd/Ctrl + J global keyboard shortcut
- Every TokenCard/WalletCard has "Ask VTX" action
- Every whale detail page has "Ask VTX about this whale"
- Every security report has "Ask VTX for interpretation"

Each entry point: pre-fills a relevant prompt + opens VTX with ?q= and ?source=xxx params.

── TASK 8.2: OVERVIEW MODE ──

Special VTX mode: user asks "Give me a market overview" or clicks "VTX Overview" button on dashboard.

VTX auto-executes a sequence:
1. get_trending → top movers
2. get_whale_activity (min $100K) → recent big moves
3. Market globals + Fear & Greed
4. User's portfolio summary if wallet connected
5. Synthesize into an "Overview" card package: 4-5 inline cards + concise narrative

Takes 10-15 seconds. Uses multiple tool calls. Final output is a curated market briefing.

── TASK 8.3: PREVIEW FLOW ──

When VTX generates cards with actionable content (swap card, alert card):
- Card renders in chat with Execute/Save button
- Click → opens modal with full details + "Confirm"
- On confirm: action executes via appropriate API
- Confirmation message in chat thread
- User stays in VTX — never leaves to sub-page

This makes VTX capable of ending entire workflows without leaving.

── TASK 8.4: SESSION SHARING ──

Build share flow:
- Session detail page: "Share" button generates public read-only link
- Link format: naka-labs.com/vtx/shared/[shareToken]
- Share view: /app/vtx/shared/[shareToken]/page.tsx
- Read-only, no login required
- Shows conversation + cards
- "Fork to my account" button (requires login, clones conversation)

Create vtx_shared_conversations table + /app/api/vtx/share/route.ts for creating shares.

── TASK 8.5: COMMIT PHASE 8 ──

```
git add .
git commit -m "Phase 8: VTX overview/preview flow + entry points — connected everywhere, overview briefing mode, inline execution, session sharing"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
END OF BATCH 1 — STOP AND REPORT (after Phase 8)
═══════════════════════════════════════════════════════════════════════════════

After Phase 8 is committed and pushed, STOP. Output CONSOLIDATED Batch 1 SQL migrations as a single code block for user to run in Supabase.

Report:

```
BATCH 1 COMPLETE — Phase 0 + Phases 1 through 8

Branch: session-5b2-production (pushed to origin)

Phase 0 — Relayer gap-fill (inline signing, receipt reconciliation, sell direction, live verification, admin monitoring)
Phase 1 — Crypto Payments (USDC/SOL/ETH to treasury with payment detector, tier gates)
Phase 2 — 2FA (TOTP + recovery codes + trusted devices)
Phase 3 — Settings institutional rebuild (10 sections, GDPR compliance)
Phase 4 — GoPlus branding removed (silent infrastructure)
Phase 5 — VTX backend rewrite (Sonnet 4.6, 8 tools, streaming, rate limits)
Phase 6 — VTX inline card system (7 card types)
Phase 7 — VTX 3-column institutional UI (sessions, context panel, shortcuts)
Phase 8 — VTX overview/preview flow (entry points, overview mode, inline execution, session sharing)

Latest commits: [list 9 commit hashes]

USER ACTIONS BEFORE BATCH 2:
1. Copy the CONSOLIDATED Batch 1 SQL (output above) → Supabase SQL Editor → Run
2. Verify new tables: payment_intents, subscription_history, user_2fa, trusted_devices, vtx_shared_conversations (and any columns added to existing tables for receipt reconciliation)
3. (Optional) Create PR from session-5b2-production → main on GitHub, test Batch 1 features on preview URL
4. Reply "Continue with Batch 2" when ready

Build status: clean (npm run build exit 0)
TypeScript: 0 new errors in new files
No mock data, no placeholders, no any types in new code.

Waiting for user confirmation to proceed with Batch 2 (Phases 9-15: DNA Analyzer + Contract Intelligence + Admin Rebuild + Interconnection + Final Audit).
```

Then STOP. Do not proceed to Phase 9 until user says "Continue with Batch 2".

═══════════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════════
BATCH 2 — PHASES 9-15: INTELLIGENCE + ADMIN + INTERCONNECTION + FINAL AUDIT
═══════════════════════════════════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════════════════════

Only start when user says "Continue with Batch 2". Execute Phases 9 through 15 consecutively. Do NOT stop between phases. After Phase 15 (final platform audit) is committed and pushed, STOP and deliver full comprehensive report.

═══════════════════════════════════════════════════════════════════════════════
PHASE 9 — DNA ANALYZER (JACOB-STYLE ALPHA INTELLIGENCE REPORT)
═══════════════════════════════════════════════════════════════════════════════

The "wow" feature. AI-powered wallet transaction DNA analysis. Think Nansen Profiler + Arkham Archetype + Jacob's alpha reports.

── TASK 9.1: ARCHITECTURE ──

For any wallet address, generate:
1. Trading Style (swing trader / day trader / hodler / degen / sniper / bot / etc.)
2. Risk Profile (conservative / moderate / aggressive / degenerate)
3. Specialization (DeFi native / NFT trader / memecoin sniper / LP provider / governance voter)
4. Notable Moves (top 5 best and worst trades with context)
5. Archetype (computed label: "Institutional Accumulator", "Smart Money OG", "Degen Early", "Rug Survivor", etc.)
6. Behavioral Patterns (trading time of day, days of week, hold duration distribution)
7. Signal Strength (how actionable is this wallet's data for copying/following)

── TASK 9.2: SQL MIGRATION ──

```sql
CREATE TABLE IF NOT EXISTS wallet_dna_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  trading_style TEXT,
  risk_profile TEXT,
  specialization TEXT[],
  archetype TEXT,
  signal_strength NUMERIC CHECK (signal_strength BETWEEN 0 AND 100),
  notable_moves JSONB DEFAULT '[]'::jsonb,
  behavioral_patterns JSONB DEFAULT '{}'::jsonb,
  full_report TEXT NOT NULL, -- AI-generated narrative
  tx_sample_size INT,
  analysis_period_days INT,
  generated_by TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- 7 days default
  UNIQUE(address, chain)
);
CREATE INDEX IF NOT EXISTS dna_reports_archetype_idx ON wallet_dna_reports(archetype);
CREATE INDEX IF NOT EXISTS dna_reports_signal_idx ON wallet_dna_reports(signal_strength DESC);
ALTER TABLE wallet_dna_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_reads_dna" ON wallet_dna_reports;
CREATE POLICY "anyone_reads_dna" ON wallet_dna_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_role_dna" ON wallet_dna_reports;
CREATE POLICY "service_role_dna" ON wallet_dna_reports FOR ALL TO service_role USING (true);
```

── TASK 9.3: DNA GENERATION PIPELINE ──

Create /lib/dna/analyzer.ts:

```ts
export async function generateDnaReport(address: string, chain: string): Promise<DnaReport> {
  // 1. Fetch wallet data:
  //    - Portfolio (Alchemy/Helius)
  //    - Last 500 transactions (with values, tokens, timestamps)
  //    - Counterparties from tx log
  //    - Protocols interacted with
  //    - Current holdings
  
  // 2. Compute quantitative patterns:
  //    - Trading frequency (txs per day average)
  //    - Average hold duration
  //    - Win rate (profitable trades / total trades)
  //    - Avg trade size
  //    - Time-of-day distribution
  //    - Day-of-week distribution
  //    - Token diversity (Gini coefficient)
  
  // 3. Build rich context for Claude:
  //    - Top 10 trades with full context
  //    - Pattern summary
  //    - Known label from whales table (if exists)
  
  // 4. Call Claude Sonnet 4.6 with DNA generation prompt:
  const systemPrompt = `You are Naka Labs' elite on-chain analyst. Generate a DNA report for this wallet.
  
  Structure your response as JSON:
  {
    "trading_style": "...",
    "risk_profile": "...",
    "specialization": ["...", "..."],
    "archetype": "...", // Creative 2-4 word label like "Memecoin Ninja" or "DeFi Titan" or "Rug Survivor"
    "signal_strength": 75, // 0-100, how actionable is this wallet for followers
    "notable_moves": [
      { "description": "...", "pnl_usd": ..., "token": "...", "context": "..." }
    ],
    "behavioral_patterns": {
      "primary_chains": ["..."],
      "active_hours_utc": [10, 11, 14, 15],
      "avg_hold_hours": 48,
      "preferred_dex": "..."
    },
    "narrative": "...2-3 paragraph story of this wallet's trading journey..."
  }
  
  Be specific. Use actual numbers from the data. Don't hedge. Make it compelling.`;
  
  // 5. Parse JSON, validate, store in wallet_dna_reports
  // 6. Set expires_at = NOW() + 7 days
}
```

── TASK 9.4: DNA ANALYZER PAGE ──

Create /app/dashboard/dna-analyzer/page.tsx:

Layout:
- Search bar: "Enter wallet address"
- Recent analyses (user's history)
- Popular archetypes sidebar

Upon address submission:
- If cached report exists (not expired): show instantly
- Else: show "Analyzing..." with progress (fetching data, computing patterns, AI synthesis)
- 30-60 second wait → report appears

Report card layout:
- Header: address, ENS, archetype badge (big, stylized)
- Signal Strength gauge (0-100 with color)
- Stats grid: Trading Style, Risk Profile, Specializations
- Notable Moves carousel (top 5)
- Behavioral Patterns charts (time-of-day heatmap, hold duration histogram)
- Narrative section (2-3 paragraph AI story)
- Actions: Follow wallet, Copy rule, Share report, Regenerate

── TASK 9.5: DNA INTEGRATION IN WALLET INTELLIGENCE ──

Wallet Intelligence page (from 5B-1 Phase 10) Overview tab:
- Replace existing "archetype" text field with embedded DNA Report
- If no DNA report exists: "Generate DNA Analysis" button → triggers pipeline

── TASK 9.6: DNA IN VTX ──

Add tool to VTX: `get_wallet_dna(address, chain)` → returns DNA report.

When VTX mentions a wallet, it can pull the DNA via this tool and render WalletCard with DNA preview.

── TASK 9.7: COMMIT PHASE 9 ──

```
git add .
git commit -m "Phase 9: DNA Analyzer — AI-powered wallet archetype generation, signal strength, behavioral patterns, full narrative reports"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 10 — CONTRACT INTELLIGENCE (CONSOLIDATE WITH SECURITY SCANNER)
═══════════════════════════════════════════════════════════════════════════════

Contract Intel and Security Scanner from 5B-1 have overlap. Consolidate.

── TASK 10.1: ARCHITECTURE DECISION ──

Create ONE unified page: /app/dashboard/intelligence/[chain]/[address]/page.tsx

- Accepts any address: token, contract, wallet
- Detects type and routes to appropriate view
- Token → full analysis (price, holders, security, recent trades)
- Contract → code analysis, admin functions, interactions, upgrade history
- Wallet → DNA + holdings + activity

Old pages redirect:
- /security-scanner → /intelligence/[chain]/[address]?mode=security
- /contract-intelligence → /intelligence/[chain]/[address]?mode=contract
- /wallet-intelligence/[address] → /intelligence/[chain]/[address]?mode=wallet

── TASK 10.2: UNIFIED INTELLIGENCE PAGE ──

Header: auto-detected type badge, address, chain, label (if known)

Tabs (contextual based on address type):
- Overview (always)
- Security (token/contract: GoPlus via Naka Security)
- Code (contract only: source, admin functions, dependencies)
- Holders (token only: top holders, distribution, whales)
- Activity (always: recent txs, filtered by type)
- Counterparties (wallet/contract only)
- DNA (wallet only: DNA Report)
- Clusters (wallet only: related wallets)

Each tab: institutional UI, data-dense, monospace for addresses, action buttons.

── TASK 10.3: APPROVAL MANAGER CONSOLIDATION ──

Existing /dashboard/security/approvals from 5B-1 Phase 9 stays as separate page (it's user-specific, not address-specific).

── TASK 10.4: PHISHING CHECKER ──

Create /app/dashboard/security/phishing-check/page.tsx:
- Input: URL
- Calls GoPlus checkPhishingUrl (now branded as "Naka Security URL check")
- Returns: is_phishing, website info, risk flags
- History of user's checks

── TASK 10.5: COMMIT PHASE 10 ──

```
git add .
git commit -m "Phase 10: Intelligence unified — Contract + Security + Wallet consolidated, smart routing by address type, DNA integration, phishing checker"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 11 — ADMIN PANEL INSTITUTIONAL REBUILD
═══════════════════════════════════════════════════════════════════════════════

── TASK 11.1: AUDIT EXISTING ADMIN ──

Read every file under /app/dashboard/admin/* and /app/api/admin/*. List what exists.

── TASK 11.2: NEW ADMIN STRUCTURE ──

Admin role gate: profiles.role = 'admin'. Enforce via middleware on all /dashboard/admin/* routes.

Sections:
- /dashboard/admin — overview dashboard with KPIs
- /dashboard/admin/users — user management, search, tier adjust, ban/unban
- /dashboard/admin/whales — whale submissions review queue, approve/reject, manually add
- /dashboard/admin/clusters — cluster labels review, approve/reject community labels
- /dashboard/admin/payments — payment_intents monitoring, tx verification, manual grant
- /dashboard/admin/subscriptions — active subscriptions, expiration alerts, manual extend
- /dashboard/admin/relayer — live relayer health (from Phase 0 admin widget), stuck pending trades, cron execution logs
- /dashboard/admin/vtx — VTX usage stats, cost tracking, conversation moderation (report button triggers admin review)
- /dashboard/admin/security — platform security events, flagged tokens, user 2FA adoption
- /dashboard/admin/system — env vars status, cron health, Redis stats, Supabase query performance

── TASK 11.3: ADMIN UI STANDARDS ──

Institutional, data-dense, ops-friendly:
- Tables with sort/filter/export (CSV, JSON)
- Bulk actions
- Audit log: every admin action logged to admin_actions table
- Impersonation mode (careful): admin can temporarily view-as a user for support

SQL for admin actions audit:
```sql
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_actions_admin_idx ON admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON admin_actions(target_type, target_id);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_admin_actions" ON admin_actions;
CREATE POLICY "service_role_admin_actions" ON admin_actions FOR ALL TO service_role USING (true);
```

── TASK 11.4: COMMIT PHASE 11 ──

```
git add .
git commit -m "Phase 11: Admin Panel institutional rebuild — 10 sections, audit log, bulk actions, impersonation, data exports"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 12 — FEATURE INTERCONNECTION VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

Every feature should connect to every other feature where it makes sense. Audit + wire.

── TASK 12.1: INTERCONNECTION MAP ──

Document in /docs/session-5b2-interconnection.md — grid of "from feature → to feature" with expected behavior.

Examples:
- Token in VTX response → "Open in Trading Terminal" link
- Whale in whale tracker → "Ask VTX about this whale" link
- Wallet in Intelligence page → "View DNA Report" link → "Copy trade from this wallet" link
- Security alert → "See affected tokens" → "Scan my holdings"
- Context Feed item → "Open token" / "Ask VTX"
- Alert triggered → "View source token" / "Take action in Trading Terminal"

── TASK 12.2: VERIFY + FIX ──

For every interconnection in the map, verify the link actually works. Fix broken ones.

── TASK 12.3: NAVIGATION HISTORY ──

Add a "recently viewed" breadcrumb persisted per user:
- Last 20 items across tokens, wallets, whales, clusters
- Accessible from top nav dropdown
- Stored in Redis with 7-day TTL

── TASK 12.4: COMMIT PHASE 12 ──

```
git add .
git commit -m "Phase 12: Feature interconnection verified + navigation history — every feature links intelligently to every other"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 13 — WHALE TRACKER COMPLETION (TOKENS + COUNTERPARTIES)
═══════════════════════════════════════════════════════════════════════════════

5B-1 Phase 5 left Tokens Held and Counterparties tabs as placeholder. Finish them.

── TASK 13.1: TOKENS HELD TAB ──

On whale detail page → Tokens Held tab:
- Fetch current holdings via Alchemy (EVM) / Helius (Solana)
- Enrich with price, 24h change, entry price estimate (from first tx where token received)
- Compute unrealized PnL per token
- Sortable: value, PnL %, PnL USD, hold duration
- Each row: token logo, symbol, amount, value USD, avg entry, current, PnL, actions (copy this trade, set alert)

── TASK 13.2: COUNTERPARTIES TAB ──

- Query wallet_edges for this whale's top 20 counterparties
- Enrich: counterparty label, type (whale/exchange/contract), tx count, total USD volume
- Sortable by tx count, volume
- Each row: jump-to-counterparty link

── TASK 13.3: AI CLUSTER NAMING CRON ──

/app/api/cron/ai-cluster-naming/route.ts (runs every 6 hours):
- Query cluster_cache rows where label IS NULL
- For each: call Claude to generate creative cluster name based on behavior evidence
- Insert into cluster_labels with ai_generated=true, status='approved'
- Rate limit: max 50 clusters named per run (prevents Claude cost blowup)

── TASK 13.4: SNIPER BOT REAL-TIME ──

If /app/dashboard/sniper-bot exists (check): upgrade to real-time:
- SSE stream for new token launches from DexScreener
- User sets criteria: chain, min liquidity, max tax, holder count
- When match found: create pending trade via relayer + notify user
- User's 1-tap confirm executes snipe

── TASK 13.5: COMMIT PHASE 13 ──

```
git add .
git commit -m "Phase 13: Whale Tracker completion — Tokens Held tab, Counterparties tab, AI cluster naming cron, Sniper Bot real-time upgrade"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 14 — POLISH + SELF-AUDIT
═══════════════════════════════════════════════════════════════════════════════

── TASK 14.1: CROSS-BATCH SELF-AUDIT ──

Audit every phase from 0 through 13. Write /docs/session-5b2-self-audit.md.

Checks:
- npm run build → exit 0
- grep new files for "TODO|FIXME|XXX" — 0 allowed
- grep new files for ": any" — 0 allowed
- grep all "steinz labs" user-facing text — 0 allowed
- grep "GoPlus" in client-facing code — 0 allowed (verify Phase 4 thoroughness)
- All new API routes: auth check, Sentry capture, proper error handling
- All new components: loading, error, empty states
- All new Supabase queries: lazy init
- All new cron routes: CRON_SECRET verified
- Branding: no new colors, all existing tokens
- Mobile responsive: all new pages at 375px

── TASK 14.2: FIX EVERY FAIL ──

For every FAIL or PARTIAL: fix in same phase. Do not defer.

── TASK 14.3: PERFORMANCE PASS ──

- Identify heavy client-side loops
- Remove unused imports (tree-shaking helper)
- Dynamic imports for heavy libs (three.js, recharts when not on main path)
- Images via next/image everywhere
- API routes that could be cached but aren't

── TASK 14.4: COMMIT PHASE 14 ──

```
git add .
git commit -m "Phase 14: Polish + self-audit — fixed all issues from cross-batch audit, performance optimizations"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 15 — FINAL PLATFORM AUDIT + RATINGS + RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════════

── TASK 15.1: COMPREHENSIVE PLATFORM AUDIT ──

Write /docs/session-5b2-FINAL-audit.md. Rate every feature A/B/C/D:

1. Landing Page
2. Authentication (signup/login/reset) + 2FA
3. Dashboard Homepage
4. Context Feed
5. Market / Trading Page
6. Trading Terminal
7. Swap
8. Pricing + Crypto Payments
9. VTX Agent (centerpiece)
10. Whale Tracker
11. Wallet Clusters
12. Wallet Intelligence + DNA Analyzer
13. Intelligence Unified Page (contract + security + wallet)
14. Approval Manager
15. Phishing Checker
16. Notifications + Alerts
17. Telegram Integration
18. Sniper Bot
19. Transactions / Portfolio
20. Wallet Page (builtin + external)
21. Settings (all 10 sections)
22. Profile
23. Admin Panel (all 10 sections)
24. AI Customer Support
25. Watchlist
26. Bookmarks
27. Relayer Health
28. On-Chain Receipt Reconciliation
29. Developer Portal (if present)
30. Session Sharing (VTX public shares)

Overall platform grade: X/100

── TASK 15.2: PRODUCTION READINESS CHECKLIST ──

Full checklist in /docs/session-5b2-production-ready.md:

### Architecture
- [ ] Non-custodial integrity preserved (no server-side signing anywhere)
- [ ] GoPlus silent (no user-facing mentions)
- [ ] All 19+ SQL tables migrated and RLS enabled
- [ ] All cron endpoints require CRON_SECRET
- [ ] Treasury wallets in env, never in frontend
- [ ] Rate limiting enforced on auth + VTX + public endpoints

### Features
- [ ] Trading Terminal functional with 5B-1 features
- [ ] Limit orders / DCA / stop-loss execute via pending trades
- [ ] Copy trading (buy + sell direction)
- [ ] VTX 8 tools operational
- [ ] Crypto payments detect + upgrade tier
- [ ] 2FA enrollment + challenge + trusted devices
- [ ] DNA Analyzer generates reports
- [ ] Admin Panel operational

### Observability
- [ ] Sentry capturing all errors with context
- [ ] Structured logging in crons + API routes
- [ ] Cron execution log populating
- [ ] Admin relayer health dashboard live

### Quality
- [ ] Zero `: any` in 5A/5B-1/5B-2 code
- [ ] Zero TODOs in new code
- [ ] Build clean
- [ ] Mobile responsive all routes

### Compliance
- [ ] GDPR data export working
- [ ] Account deletion flow working
- [ ] Terms + Privacy pages live

── TASK 15.3: SESSION 5C RECOMMENDATIONS ──

Write /docs/session-5c-recommendations.md covering what's next:

Items likely for Session 5C:
1. Auto-Copy Trading (needs dedicated safety-focused session)
2. CI/CD + Vitest + Playwright (dev quality gates)
3. Internationalization (next-intl is installed, not configured)
4. Webhook API for partners
5. Public embed widgets (Smart Money ticker, security badges)
6. Advanced admin analytics (user growth, revenue, cost tracking)
7. Mobile PWA polish (install prompts, offline mode, push notifications)
8. Performance optimization pass (bundle < 250KB target)
9. Social features (public whale portfolios, community leaderboards)
10. NFT-specific tracking

── TASK 15.4: FINAL COMMIT ──

```
git add .
git commit -m "Phase 15: Final Session 5B-2 audit — 30 features graded, overall X/100, production readiness checklist, Session 5C recommendations"
git push origin session-5b2-production
```

═══════════════════════════════════════════════════════════════════════════════
END OF BATCH 2 — END OF SESSION 5B-2
═══════════════════════════════════════════════════════════════════════════════

Final report:

```
SESSION 5B-2 COMPLETE — 16 phases shipped across 2 batches

Branch: session-5b2-production (pushed to origin)
Total commits: 16
Build: clean

KEY DELIVERABLES:
- Relayer gap-fill complete (inline signing, receipt reconciliation, sell direction)
- Crypto Payments live (USDC/SOL/ETH to treasury, tier upgrades automatic)
- 2FA full implementation (TOTP + recovery codes + trusted devices)
- Settings institutional rebuild (10 sections, GDPR compliance)
- GoPlus completely silent (Naka Security branding only)
- VTX next-gen (backend rewrite + 8 tools + 7 cards + 3-column UI + overview flow + sharing)
- DNA Analyzer (AI-powered wallet archetype generation)
- Intelligence unified page (contract + security + wallet consolidation)
- Phishing Checker dedicated page
- Admin Panel institutional rebuild (10 sections + audit log)
- Feature interconnection verified + navigation history
- Whale Tracker complete (Tokens + Counterparties tabs, AI cluster naming)
- Sniper Bot real-time (if existed)
- Final platform audit with grade

PLATFORM GRADE: X/100 (improved from 82/100)
PRODUCTION READINESS: X%

USER ACTIONS:
1. Copy CONSOLIDATED Batch 2 SQL (output in next block) into Supabase and Run
2. Create PR from session-5b2-production → main
3. Test preview URL thoroughly (trading, VTX, DNA, admin)
4. Merge to main
5. Review /docs/session-5b2-FINAL-audit.md and /docs/session-5c-recommendations.md

Naka Labs is production-excellent.
Session 5C reserved for: Auto-Copy, testing infra, i18n, public API, admin analytics, mobile PWA polish.
```

═══════════════════════════════════════════════════════════════════════════════
BEGIN NOW. BATCH 1 (Phase 0 + Phases 1-8). 
ACKNOWLEDGE RULES IN ONE LINE THEN RUN EVERY PHASE TO COMPLETION WITHOUT STOPPING.
Stop only at end of Phase 8 and wait for user to say "Continue with Batch 2" before starting Phase 9.
═══════════════════════════════════════════════════════════════════════════════
