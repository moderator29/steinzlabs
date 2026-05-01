# Steinz Labs — Session B → C Handoff

> **READ THIS WHOLE FILE BEFORE TYPING ONE CHARACTER OF CODE.**
> Skipping it = you reintroduce a bug Phantomfcalls already paid for.
> If you only have time for one section, read §2 (rules) and §6 (gotchas).

---

## 1. Who you're working for

- **User:** Phantomfcalls (`Phantomfcalls@gmail.com`)
- **Role:** Founder/CEO, **Steinz Labs** / **Naka Labs** (same company, dual brand)
- **Telegram bot:** `@Nakalabsbot`
- **Test accounts on Max** (never delete or downgrade — `tier_expires_at = 2125-01-01`):
  - `Phantomfcalls@gmail.com` — primary
  - `regadapol@gmail.com`
  - `nevo.paul@gmail.com`
- **How he talks:** casual ("okay", "deep deep", "picture perfect", "make it understand"). He values direct prose over buzzwords. He respects an honest "this needs another session" over fake-completeness.
- **What he expects:** top-1% MEVX/Nansen/Trojan/Maestro-grade work. Not demo-grade. Not "good enough." Real APIs, real data, real charts, picture-perfect UI on desktop AND mobile.
- **He pays attention to small things:** corrupted `.gitignore`, slipped-in `.vercel/` files, stale "deferred" copy in footers, A-F letter grades that should be 0-100. Don't ship those.

## 2. The 14 working rules — non-negotiable

These come from his original master prompt. Apply every rule, every turn.

1. **No shortcuts. No demos. No mock data. No "good enough."** Placeholder = doesn't ship.
2. **Real APIs, real data, real charts.** No iframe embeds where we can render native. No fabricated PnL/win-rate. We have CoinGecko, Alchemy, Helius, Arkham, GoPlus, 0x, Jupiter, LunarCrush, Birdeye, Etherscan, Sentry, Turnstile, Resend, WalletConnect, Anthropic — use them.
3. **Industry-standard or better.** Reference benchmarks: MEVX, Nansen, Trojan, Maestro. He explicitly wants to *exceed* these.
4. **Investigate root causes.** Fix the actual bug, not the symptom.
5. **Test locally before declaring complete.** TS clean (`npx tsc --noEmit`), build clean, no console errors, sub-second page loads, sub-2s actions.
6. **Commit per section, push per section.** One feature branch per section, named `feat/<section-name>`. PR per section.
7. **Audit what you ship.** After finishing a section, deep-audit it — empty try/catches, console.logs in prod, TODOs, hardcoded values, missing loading/error states, broken pagination, memory leaks, N+1 queries. Fix what you find before moving on. **In Session B, every section was deep-audited via parallel `Explore` subagents AFTER ship; criticals were patched same-session. Continue this pattern — see §13 below.**
8. **UI/UX picture-perfect or it doesn't ship.** Bloomberg-terminal density. Dark theme primary, light supported. WCAG AAA contrast (auth pages already match this — every other surface should match the bar).
9. **Mobile + desktop both perfect.** Test at 375px and 1440px.
10. **Accessibility-aware.** Old users with poor eyesight must read every label. Body text 15-16px minimum, weight 500-600, headings clear hierarchy. (See §6 UI tokens — `.naka-text-body/-secondary/-tertiary` already encode this.)
11. **Log every paid API call** so cost stays visible. (Sniper engine has `lib/sniper/engine/apiCost.ts` — consider extracting platform-wide.)
12. **Don't twist requirements.** "10 chains" means 10. "sub-2s execution" is the bar.
13. **Think deep before you build. Plan before you code.** Every section starts with a TodoWrite list.
14. **Speak the way he speaks.** Casual, plain prose, no buzzwords. Be honest about scope and blockers.

### Audit-before-build culture (Session B addition)

Before starting ANY new section:
1. `git checkout main` and pull latest.
2. Read this handoff again.
3. Read the spec for the section in §10 (the original master prompt, verbatim further down).
4. **Audit any prior work in that section** before extending it — Session A and Session B both shipped code that needed audit-fixes the next phase. Don't extend broken foundations.
5. Run `npx tsc --noEmit` on a clean checkout. If it fails, fix that first.

After shipping each section, deploy parallel `Explore` agents to audit (one for server, one for UI when both exist). Fix every CRITICAL and HIGH same-session. Defer MEDIUM/NIT only with explicit reasoning.

---

## 3. Non-custodial constraint — load-bearing

`lib/trading/builtinSigner.ts` is explicit: **the platform never holds private keys.** Server-side signing is forbidden by product, legal, and trust design. Built-in wallet keys are AES-256-GCM encrypted in the browser and never leave the device.

This means automated triggers (sniper auto-execute, copy-trade, limit orders, DCA, stop-loss, auto-sell) all use a **pending-trade confirmation flow**:

```
trigger fires → write pending_trades(source='X', source_id=...) → notify user via Telegram/push
              → user confirms in-app → browser signs → broadcast
```

`lib/trading/relayer.ts:executeTrade()` is the canonical entry. **Do not invent alternative paths.** If a future agent is tempted to wire server-side signing, stop and raise a product/security review first. The file says so directly.

The only nuance: the Sniper engine's `submit()` adapter (lib/sniper/engine/{solana,evm,ton}.ts) accepts a **pre-signed raw transaction from the browser** and broadcasts through MEV-protected routes (Jito, Flashbots, BloxRoute). It still doesn't sign anywhere on the server.

---

## 4. Repo + infra

- **Local path:** `C:\Users\DELL LATITUDE 5320\dev\steinzlabs`
- **Stack:** Next.js 15 App Router, TypeScript, Tailwind, Supabase (Postgres 17 + Auth + RLS), Zustand, Recharts + lightweight-charts + D3, Framer Motion, ethers v6, @solana/web3.js, alchemy-sdk, @upstash/redis, Anthropic SDK, Sentry, Cloudflare Turnstile, bs58.
- **Dev server:** `npm run dev` (port 5000).
- **Vercel project name:** `nodejs` under team `phantomfcalls-8856s-projects` (`team_Tyxg3NQHsQAmf2y2wfp4VbJT`). Production auto-deploys on push to `main`.
- **`.vercel/`** is gitignored. **DO NOT COMMIT IT.** Every Session B branch had to drop a stray `.vercel/README.txt` + `.vercel/project.json` because Vercel CLI keeps recreating them after `vercel link`. Verify `.vercel/` is in `.gitignore` (line 134) on every branch you create.
- **Env:** `.env.local` (gitignored) — 77 keys, pull with `vercel env pull .env.local`. Notable keys for upcoming sections:
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — needed for §10
  - `ZX_API_KEY` / `NEXT_PUBLIC_ZX_API_KEY` — 0x v2
  - `ALCHEMY_API_KEY` / `NEXT_PUBLIC_ALCHEMY_API_KEY` / `ALCHEMY_NOTIFY_TOKEN`
  - `ALCHEMY_WEBHOOK_SIGNING_KEYS` (multi-key, comma-separated) — legacy `ALCHEMY_WEBHOOK_SIGNING_KEY` still honored
  - `HELIUS_API_KEY_1` / `HELIUS_API_KEY_2` / `HELIUS_WEBHOOK_SECRET`
  - `ARKHAM_API_KEY`
  - `ZX_API_KEY`, `BIRDEYE_API_KEY`, `LUNARCRUSH_API_KEY`, `ETHERSCAN_API_KEY`, `COINGECKO_API_KEY`
  - `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_AUTH_TOKEN`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
  - `CRON_SECRET` (cron auth) and `ADMIN_MIGRATION_SECRET` (migrations + privileged refreshes)
- **Supabase project:** ID `phvewrldcdxupsnakddx`, region `eu-west-1`, owner `boosthubservice@gmail.com`. **Use Supabase MCP for SQL/migrations.** It will refuse to apply schema changes without explicit user confirmation — say in plain text "yes apply migration" then call again.
- **MCP tools available:** Supabase (`list_tables`, `execute_sql`, `apply_migration`, `deploy_edge_function`, `get_advisors`, `generate_typescript_types`) and Vercel (deployments, logs, projects). Vercel MCP cannot pull env vars — use the local Vercel CLI.

---

## 5. Branch + PR state at end of Session B

Nine open feature branches, all type-check clean, all on top of `main`. **Merge in this order** (later branches depend on earlier ones):

| # | Branch | Section | Commits | Status |
|---|---|---|---|---|
| 0 | `feat/auth-contrast-readability` | §1 auth contrast | (Session A) | Open |
| 0 | `feat/telegram-bot-real-data` | §5 Telegram bot | (Session A) | Open |
| 1 | `feat/sniper-rebuild` | §2 phases 1-2 | 27bad01, 07db40f, 5664da8 | Open |
| 2 | `feat/sniper-engine` | §2 phase 3 | 56bd691 | Stacked on #1 |
| 3 | `feat/sniper-mempool` | §2 phase 4 | 2b59672, c2ef4a5, 7e567a6 | Stacked on #2 |
| 4 | `feat/sniper-autosell` | §2 phase 5 | d8952dd | Stacked on #3 |
| 5 | `feat/copy-trading` | §3 phases A+B | f3abedb, 50d35a0, 562097f, ec340d4, f6f7bc1, 02ffdd5 | Open (off main) |
| 6 | `feat/whale-tracker` | §4 phases A+B | e1158a7, 83fdc7f, 6a63172, 777648a, 3d6c7cc, d45546a | Open (off main) |
| 7 | `feat/uiux-tokens` | §6 platform tokens | 8c263cf | Open (off main) |
| 8 | `feat/trust-score` | §7 Naka Trust Score | bf0efb3, 2b30f65 | Open (off main) |
| 9 | `feat/vtx-fixes-v2` | §8 VTX integration | 1fb199a | Stacked on #8 |

**Merge sequence**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. The session A branches (auth/telegram) are independent.

---

## 6. Schema gotchas — accumulated, painful

These have all bitten Session A or Session B. Don't reintroduce.

### Sniper schema
- `sniper_criteria.trigger_type` — UI persists `'new_pair'`, the cron + matcher both accept it as an alias for `'new_token_launch'`. (Treat them as equivalent. `'manual'` means user-initiated — webhook matcher SKIPS it.)
- `sniper_executions.amount_sol` is preserved for legacy rows; new rows use `amount_native + chain`.
- `sniper-auto-execute` cron previously read the wrong v2 columns: it must read `amount_per_snipe_usd / max_slippage_bps / wallet_addresses[0] / enabled+paused`, NOT `amount_usd / slippage_bps / wallet_address / active`. Fixed in `7e567a6` on `feat/sniper-mempool`. **Don't revert.**
- `sniper-detect` webhook now supports multi-key `ALCHEMY_WEBHOOK_SIGNING_KEYS` (comma-separated). Same fix applied.

### Copy-trading schema
- `user_copy_rules.mode` was added in migration `copy_trading_modes_v2`. Three values: `alerts_only` / `oneclick` / `auto_copy`. Legacy rows backfilled to `oneclick`. CHECK constraint enforces the set.
- `user_copy_rules.paused` is separate from `enabled`. Pause = mute temporarily. Disable = turn off completely. Matcher honors both.
- `user_copy_trades.status` constraint extended to allow `'alert'` (was rejecting alerts_only inserts silently). Migration `copy_trades_alert_status_and_dedup`.
- Unique idx on `user_copy_trades(user_id, source_tx_hash)` backstops the matcher's pre-load dedup so concurrent webhook retries can't double-insert.
- **Tier gates** on POST `/api/copy-trading/rules`:
  - `alerts_only` → free+
  - `oneclick` → pro+
  - `auto_copy` → max only
  Server-side enforcement in addition to UI.

### Whale schema
- `whales.label` (NOT `name`)
- `whales.trade_count_30d` (NOT `total_trades_30d`)
- `whales.pnl_7d_usd / pnl_30d_usd / pnl_90d_usd` (NOT `pnl_24h_usd`)
- `whales.archetype, whale_score, follower_count, verified, x_handle, tg_handle, portfolio_value_usd` exist
- **NEW (Session B):** `whales.logo_url, logo_source, logo_resolved_at` (migration `whale_logo_columns`)
- `whale_ai_summaries.recommended_copy_mode` added — Claude returns it; UI consumption can extend.

### Address normalization (CRITICAL)
- **EVM addresses** are case-insensitive. Lowercase them.
- **Solana base58 addresses are CASE-SENSITIVE.** Lowercasing produces a different valid-looking address that won't resolve on-chain.
- Pattern used in `app/api/trust-score/[chain]/[address]/route.ts:18-24`:
  ```ts
  const EVM_CHAINS = new Set(["ethereum","bsc","base","arbitrum","optimism","polygon","avalanche"]);
  function normalizeAddress(chain: string, address: string): string {
    return EVM_CHAINS.has(chain.toLowerCase()) ? address.toLowerCase() : address;
  }
  ```
  **Reuse this everywhere.** Don't blanket-lowercase.

### Other gotchas
- `price_alerts.price` (NOT `target_price`); `price_alerts.triggered` boolean (NOT `is_active`).
- `user_wallets_v2` is JSONB: `{ user_id, wallets: [{address, chain?, label?}], default_address }`.
- `useAuth` does NOT expose `profile` separately — `user` IS the profile shape `{tier, tier_expires_at, ...}`. Pass `effectiveTier({tier: user?.tier, tier_expires_at: user?.tier_expires_at})`. Avoid `effectiveTier(user as any)` — that hides regressions.
- `PageHeader` API: `{ title, description, actions }` — no `subtitle` / `right` / `icon`.
- Telegram parse mode is legacy "Markdown" — escape only `*_[]\``. Don't use MarkdownV2.
- Vercel project name is literally `nodejs`. Don't search for "steinz" in `vercel link`.
- Sandbox (this CLI) **blocks `git reset --hard` on main and merging to main without explicit user authorization.** Open PRs and let Phantomfcalls merge via GitHub.
- `.vercel/` MUST stay gitignored. Verify on every branch.

---

## 7. Architecture decisions made in Session B (don't undo)

### 7.1 Sniper engine — non-custodial build/submit split

`lib/sniper/engine/`:
- `types.ts` — `EngineAdapter` contract: `build(params) → BuildResult{unsignedTx, expectedOutRaw, expectedOutDecimals, ...}` and `submit(signedTx) → SubmitResult{txHash, gasUsed, executionTimeMs, routeUsed}`.
- `solana.ts` — Jupiter v6 quote + swap (build) → Jito bundle for MEV-protect, derives real tx hash from `tx.signatures[0]` via bs58 (Jito returns bundleId, not signature — DON'T pass bundleId to confirmTransaction).
- `evm.ts` — 0x v2 allowance-holder/quote (build) → Flashbots Protect (Ethereum), BloxRoute (BSC), Alchemy public RPC (Avalanche).
- `ton.ts` — Ston.fi `/v1/swap/simulate` is **GET** with query params (NOT POST). TON Center `sendBoc` for broadcast.
- `index.ts` — chain dispatcher.
- `apiCost.ts` — paid-call observability (table `api_cost_log` — table may not exist, logger swallows errors).

**Output unit contract:** `expectedOutRaw: string` in smallest unit (lamports/wei/nanotons), `expectedOutDecimals: number | null` (null when adapter can't infer — caller resolves via token metadata). **Don't return decimal numbers — old contract silently returned wrong amounts for USDC/USDT (6 decimals).**

### 7.2 Sniper webhook matcher

`lib/sniper/matcher.ts` is the low-latency counterpart to the 5-min `sniper-monitor` cron. Webhook → match → either insert `sniper_match_events.decision='sniped_pending'` (auto) or `'matched'` (alert) + Telegram. Cron remains as catch-up; 10-min dedup window keyed `(criteria_id, matched_token_address)` prevents double-fires.

`/api/sniper/match` is the admin/cron replay endpoint (CRON_SECRET or ADMIN_MIGRATION_SECRET).

### 7.3 Sniper auto-sell engine

`lib/sniper/{priceFeed,autosell}.ts` + `app/api/cron/sniper-autosell/route.ts` (every-minute cron in vercel.json). Open positions = `sniper_executions WHERE status='confirmed' AND realized_at IS NULL AND sell_pending_trade_id IS NULL AND entry_price_usd IS NOT NULL`. Decision: TP / SL / trailing-stop with peak tracking. **Trailing arms only after price moves above entry.** Sells dispatch as `pending_trades(source='sniper-autosell')`.

Migration `phase5_sniper_autosell` added: `entry_price_usd, tokens_received, peak_price_usd, sell_pending_trade_id, sell_dispatched_at` + partial index. Existing execute path doesn't yet populate `entry_price_usd / tokens_received` — auto-sell is a no-op until that's wired. **§13 audit work.**

### 7.4 Copy-trading three modes

`lib/copy/matcher.ts` — webhook fan-out to `user_copy_rules` matching `(chain, lower(whale_address))`. Per-mode branch:
- `alerts_only` → `user_copy_trades(status='alert')` + Telegram with `/dashboard/copy-trading?action=...&token=...&chain=...&tx=...` deep-link.
- `oneclick` / `auto_copy` → `lib/trading/relayer.executeTrade()` → `pending_trades`.

Auto-copy is non-custodial: the dashboard (when open) auto-confirms pending trades. Server never signs. **Browser-side auto-confirm flag is a phase-C feature** — schema doesn't have it yet.

### 7.5 §6 platform UI tokens (`.naka-*`)

In `app/globals.css` after line 1216:
- `.naka-text-body / -secondary / -tertiary` — 15/14/13px, weight 500, line-height 1.5+, letter-spacing 0.01em. Light-theme overrides `[data-theme="light"]`.
- `.naka-card` — 2px border (was 1px platform-wide), 18px padding, hover lift + blue glow.
- `.naka-button-primary` — gradient fill, hover translate + 24px glow + brightness boost.
- `.naka-slide-in` — 220ms keyframe.

**Migration is opt-in.** Drop the class on a surface to upgrade. Don't refactor everything to use them at once — patch the highest-visibility surfaces first (already done: ContextFeed View Proof button, VTX SwapCard CTA).

### 7.6 §7 Naka Trust Score

`lib/trust/calculate.ts` — composite 0-100. Five layers, weighted:

| Layer | Weight | Source |
|---|---|---|
| security | 40% | GoPlus `trustScore` (honeypot collapses to 0; cannot-sell to 5) |
| liquidity | 20% | DexScreener (total liq, liq:mcap ratio, 24h vol) |
| holders | 15% | GoPlus `holderCount` + top10 concentration |
| market | 15% | DexScreener (age, volatility, buy/sell pressure, mcap tier) |
| social | 10% | LunarCrush (defaults to neutral 50 when unwired) |

Bands: `≥80 highly_trusted` (green), `≥60 trusted` (blue), `≥40 caution` (yellow), `≥20 high_risk` (orange), `<20 dangerous` (red).

`/api/trust-score/[chain]/[address]` — public GET, 1h cache, `?refresh=1` requires CRON_SECRET or admin secret (otherwise an attacker can burn GoPlus quota).

`<TrustScoreBadge>` — module-level inflight Map dedupes parallel fetches per (chain, address). Two modes: fetch (chain+address props) or static (score+band+layers props).

**Solana case rule applies — see §6.**

### 7.7 §4 Whale logo cascade

`lib/whales/logo.ts` — `resolveWhaleLogo(address, chain)`:
1. Arkham (`arkhamAPI.getAddressIntel`) — labeled-entity logo
2. ENS via `api.ensideas.com/ens/resolve/<addr>` — EVM only, skipped for Solana
3. Dicebear identicon — never throws, always returns at minimum a Dicebear URL

URL validator `isRenderableHttpUrl` requires absolute http(s) and trims whitespace. `<img>` won't render `ipfs://`, `ar://`, `data:`, or relative paths.

`/api/whales/[address]/logo?chain=X` — chain query param **REQUIRED** (was a multi-chain clobber vector). 7-day cache on the whales row. `WhaleAvatar` component skips lazy-fetch when chain prop is missing.

Weekly cron `whale-logo-backfill` Sunday 04:00 UTC, 50/batch.

### 7.8 §4 Whale AI Analysis

`/api/whales/[address]/ai-summary` (Pro+ tier). Uses `vtxAnalyze` (Anthropic SDK helper). Prompts Claude for `{rating_30d, rating_10d, sentiment, style, summary, recommended_copy_mode}`. Cached 24h in `whale_ai_summaries`. Markdown-fence-stripping is included in `parseResponse` because Claude sometimes wraps despite instructions.

---

## 8. Migrations applied to LIVE Supabase (production!)

In chronological order (most recent first). Verify with `SELECT * FROM supabase_migrations.schema_migrations`.

| Date | Name | What |
|---|---|---|
| 2026-05-01 | `naka_trust_scores_unique_pair` | Replaces lower(token_address) expr index with plain (token_address, chain) so onConflict matches |
| 2026-04-30 | `naka_trust_scores` | New table: score + per-layer + details JSONB |
| 2026-04-30 | `whale_logo_columns` | whales.logo_url/logo_source/logo_resolved_at + whale_ai_summaries.recommended_copy_mode |
| 2026-04-30 | `copy_trades_alert_status_and_dedup` | status CHECK extended with 'alert' + unique idx (user_id, source_tx_hash) |
| 2026-04-30 | `copy_trading_modes_v2` | mode/pct_of_whale/tp_pct/sl_pct/cooldown_until/paused/wallet_address + backfill + CHECK |
| 2026-04-30 | `phase5_sniper_autosell` | sniper_executions: entry_price_usd/tokens_received/peak_price_usd/sell_pending_trade_id/sell_dispatched_at + partial idx |
| 2026-04-28 | `sniper_v2_extensions` | (Session A) v2 columns on sniper_criteria + sniper_executions |

**All Session B migrations are idempotent (`IF NOT EXISTS`/`DROP IF EXISTS`).** If you suspect drift, re-run safely.

---

## 9. What's left — DEEP detail per remaining section

### §9 — Admin Panel Fixes

Spec asks for three things:
1. **Users page columns**: Avatar / Username / Email / Tier / Created Date / Last Active / Actions. Pull from `profiles`. Search by email/username. Filters by tier/signup-date/activity.
2. **Demo data cleanup**: Audit every admin page; replace mock data with real Supabase queries (dashboard stats, revenue, user analytics, feature usage, whale management, research).
3. **Research editor bug**: red "can't send text" error blocks even valid posts. Fix the validation; allow 1-word minimum; support text + images + links; clear error messages.

**Approach:**
- Branch `feat/admin-fixes` off main. (Note `feat/admin-health-redis` exists on origin already — read it first to avoid stomping.)
- Start with research-editor bug because it's the most visible and self-contained — find the validator, run a manual POST to reproduce, fix, audit.
- Users page is a UI-heavy job — design it Bloomberg-density. Use `<WhaleAvatar>` pattern for `<UserAvatar>` (logo cascade isn't relevant; just a clean identicon fallback).
- Tier filter needs `effectiveTier()` — don't trust raw `profiles.tier` (legacy rows have stale values).

**Audit before extending:** read `app/admin/users/page.tsx` and the feed of admin endpoints under `app/api/admin/` first. There's likely existing infra to extend, not replace.

### §10 — Swap Page Wallet Connection

This is the section Session B punted on intentionally. Read carefully.

**Spec verbatim:**

> Real Phantom + MetaMask logos (SVG). Pull official:
> - MetaMask: https://docs.metamask.io/wallet/concepts/logo/
> - Phantom: https://phantom.app/brand
>
> Wallet connection (mobile + desktop):
> - Desktop: WalletConnect v2 SDK. MetaMask/Phantom browser extension. If not installed, "Install MetaMask/Phantom" button.
> - Mobile (CRITICAL):
>   - MetaMask: deep link `metamask://wc?uri={WC_URI}` OR WalletConnect QR
>   - Phantom: deep link `phantom://browse/{ENCODED_URL}` OR WC integration
>
> Use @reown/appkit (Web3Modal) — handles all this. Or @solana/wallet-adapter + WalletConnect for MetaMask.
>
> Test on real phone:
> - iOS Safari → MetaMask → app → approve → return
> - Android Chrome → Phantom → app → approve → return

**Why it's hard for an agent**: the "test on real phone" line is binding. WC v2 deep-links work in dev tooling but production failures only show up on actual iOS/Android with actual extensions. The platform already has wallet code under `lib/services/wallet*` and `app/dashboard/swap/` — this is a refactor, not a greenfield build. High blast-radius (every signed tx flows through it).

**Recommended approach:**
1. Spend the first hour reading the existing wallet stack — DO NOT rip out @solana/wallet-adapter blindly. Map the touch points: connect button, header status, swap card, sniper page, copy-trading rule wallet picker.
2. Install `@reown/appkit` and the EVM + Solana adapters. Verify it coexists with existing `@solana/wallet-adapter-*` packages or prove migration cost.
3. Replace placeholder logos with **official SVGs vendored locally** — don't hot-link from MetaMask/Phantom CDN (privacy + reliability).
4. Wire WC v2 with `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (already in env).
5. Mobile deep links: write a `wallet-deeplink.ts` helper with the iOS/Android routing logic. Detect platform via `navigator.userAgent`. If extension not detected, fall back to deep link or QR.
6. **Stop and hand off to the user for real-device testing.** Don't claim §10 done without it. Pre-write a test plan: 4 flows (iOS+MM, iOS+Phantom, Android+MM, Android+Phantom) with expected screens at each step.

**Branch:** `feat/swap-wallet`. Migration: probably none; this is client work.

### §11 — Performance and Speed

**Three sub-sections:**

1. **Real charts everywhere (no embeds).** Replace TradingView/DexScreener iframes with `lightweight-charts` (already in deps). Surfaces: coin detail pages, VTX inline charts, Bubble Map, Whale Tracker performance, Sniper pre-snipe analysis, Market page.
2. **API speed**: parallel calls (`Promise.all`), aggressive caching (5min prices, 1hr less-volatile), SSR for initial paint, streaming, WebSocket for real-time, Vercel Edge for low latency.
3. **DB optimization**: index frequently-queried columns, materialized views for expensive aggs, partition large tables (`transactions_raw`?), use Supabase realtime selectively.

**Approach:**
- Branch `feat/perf-charts` for the chart replacement (most visible, self-contained).
- Don't try to do all three sub-sections in one branch — at least split charts vs DB.
- Use the Vercel MCP to inspect slow routes via runtime logs before guessing what to optimize.
- For DB: run `mcp__supabase__get_advisors` first — Supabase will surface missing indexes / N+1 patterns automatically.

### §12 — Security Integration (platform-wide)

Spec says all of these auto-run on every relevant action:
- GoPlus rug check before any swap
- Trust Score (§7) before any trade action
- Domain Shield on external links
- Signature Insight on suspicious tx
- Contract Analyzer on new tokens
- Approval Manager monitors active approvals
- Risk Scanner continuous wallet monitoring

**No user action bypasses security checks.**

**Approach:**
- Branch `feat/security-platform`. Cross-cutting — touches relayer (already has GoPlus pre-check), VTX swap card (add Trust Score gate), sniper engine (add Trust Score precheck), wallet-intelligence dashboard (Approval Manager + Risk Scanner).
- A lot of this exists in pieces. Audit each surface: does it call security? What's the gate threshold? What's the user-facing reject UX?
- New components likely needed: `<SecurityGate>` HOC that wraps any "execute trade" button.

### §13 — Comprehensive Audit

**Deploy 10 parallel `Explore` subagents**, one per section. Each reports:
- What was built/fixed in that section
- What still has issues (CRITICAL / HIGH / MEDIUM / NIT)
- Any errors encountered
- Recommendations

The 10 areas:
1. Sniper Bot (§2)
2. Copy Trading (§3)
3. Whale Tracker (§4)
4. Telegram Bot (§5)
5. VTX Agent (§8)
6. Admin Panel (§9)
7. Swap Page (§10)
8. UI/UX (§6)
9. Trust Score (§7)
10. Performance (§11)

**Find hidden issues** beyond the spec: empty try/catches, console.log in prod, TODOs, hardcoded values that should be configurable, missing loading/error states, broken pagination, memory leaks, N+1 queries, accessibility regressions.

Fix everything found. **This is non-negotiable per rule 7.**

### §14 — End-to-end Testing

Test on the three Max accounts. Four flows:
1. **New user**: signup → verify email → onboarding → connect wallet → first trade
2. **Whale following**: browse → view profile → follow One-Click → notification on whale trade → confirm copy trade
3. **Sniping**: setup → wait for token launch → snipe executes → check tx → see in history
4. **VTX**: ask about portfolio (real wallet) → ask about token (TokenCard) → request swap (SwapCard) → confirm (executes)

All four must work flawlessly. Desktop 1440px AND mobile 375px. Check Supabase saves, real APIs in network tab, no console errors, page <1s, actions <2s.

**Agents can't run this alone — it needs Phantomfcalls.** Pre-write the test plan as a checklist; he runs through it; you fix what fails.

---

## 10. Original master prompt — verbatim source of truth

> If you implement something that contradicts a line below, you're wrong.

```
# STEINZ LABS — NEXT-GEN PLATFORM OVERHAUL
## Sniper Bot Rebuild + Copy Trading Bot + Whale Tracker Upgrade + UI/UX + Critical Fixes
## Engineering Mandate: Top 1% Full-Stack Developer Standard

---

## ROLE AND ENGINEERING MANDATE
You are operating as a top 1% full-stack developer. Build production-grade
features at the level of MEVX, Nansen, Trojan, and Maestro. No shortcuts.
No demos. No mock data. No "good enough." Everything must be:
- Industry-standard or better
- Fast (sub-second response wherever possible)
- Real data only (no embeds where we can render native, no hardcoded numbers)
- Production-ready (error handling, logging, monitoring)
- Mobile + desktop perfect
- Accessibility-aware (text legibility, color contrast)

Think deep before you build. Plan before you code. Audit everything you touch.

## CRITICAL RULES
1. Do NOT twist any requirement
2. Investigate root causes — fix the actual bug, not the symptom
3. Test locally for every fix before declaring complete
4. Commit incrementally per section
5. Real data only, real APIs only, real charts only
6. Match or exceed MEVX, Nansen, Trojan, Maestro standards
7. Log every API call so we can monitor cost
8. Audit and scan all features — fix anything broken even if not listed

## SECTION 0 — USER UPGRADES (DO THIS FIRST) ✅ DONE Session A
Upgrade regadapol@gmail.com and nevo.paul@gmail.com to Max tier.
- Full Max access; NOT admins.
- Subscription marked comp/manual; expiry 100 years out.
- Verify "Max - Legend in the Making" tier display.

## SECTION 1 — LOGIN/SIGNUP TEXT VISIBILITY ✅ DONE Session A
WCAG AAA contrast (7:1 min). 16px body min. Weight 500-600. Inter/SF Pro.
Audit form labels, placeholders, button text, helpers, errors, links.

## SECTION 2 — SNIPER BOT TOTAL REBUILD (MEVX-LEVEL) ✅ ALL 5 PHASES DONE
5 chains: ETH / SOL / BNB / TON / AVAX.
Sniper Engine, Configuration UI, Active Snipes Dashboard, Snipe History,
Security Integration, Multi-wallet, Anti-MEV, sub-2s execution. Real-time
mempool. Webhook-triggered execution. Auto-sell with TP/SL/trailing.

## SECTION 3 — COPY TRADING BOT (NEW BUILD) ✅ PHASES A+B DONE
Three modes: Alerts Only / One-Click / Auto-Copy. Tier-gated.
Database (user_copy_rules + user_copy_trades). Webhook-driven matcher.
Three-mode dashboard with pause/resume.

## SECTION 4 — WHALE TRACKER NEXT-GEN UPGRADE ✅ PHASES A+B DONE
Logo pull (Arkham → ENS → Dicebear). Real PnL data. Real activity.
AI Analysis (Claude Sonnet, 24h cache, recommended_copy_mode).
Live Feed wired to Alchemy + Helius webhooks. WhaleAvatar shared
component with module-level dedup.

## SECTION 5 — TELEGRAM BOT FULL FUNCTIONALITY ✅ DONE Session A
All commands return real data IN BOT. /price /chart /info /security /whales
/whale /alerts /setalert /portfolio /trending /gainers all wired.

## SECTION 6 — UI/UX UPGRADES PLATFORM-WIDE ✅ TOKENS SHIPPED
Naka tokens in app/globals.css: .naka-text-body / -secondary / -tertiary,
.naka-card, .naka-button-primary, .naka-slide-in. View Proof button now
lucrative. Migration is opt-in per surface.

REMAINING:
- Apply tokens to dashboard cards, whale-tracker cards, market page rows,
  VTX chat messages, portfolio cards, all settings panels.
- Slide-in animation on new context-feed events (use .naka-slide-in).

## SECTION 7 — NAKA TRUST SCORE ✅ CALC + API + BADGE SHIPPED
0-100 score. 5 layers (security 40 / liquidity 20 / holders 15 / market 15 /
social 10). 5 bands (Highly Trusted / Trusted / Caution / High Risk /
Dangerous). 1h cache. Public GET; refresh admin-gated. Module-level dedup.
Solana case-sensitivity respected via EVM_CHAINS allowlist.

REMAINING:
- Display Trust Score on: market page coin rows, swap page (before user
  confirms), wallet held tokens, whale-tracker token holdings. (Already on
  VTX TokenCard + SwapCard receiver.)
- Background refresh actively-traded tokens every 30min — needs a cron.

## SECTION 8 — VTX AGENT FIXES ✅ TRUST + CTA SHIPPED
TokenCard uses real Trust Score (was A-F letters). SwapCard receiver shows
Trust Score; Confirm Swap button uses .naka-button-primary.

REMAINING:
- Chart loading: chart appears INSTANTLY when token mentioned. Pre-fetch
  on detection. 5-min cache. No "loading" placeholder. Static (not
  draggable). Use lightweight-charts.
- Speed: <500ms first token. <3s full response. <1s tool calls.
- Sonnet for simple queries; Opus only for complex deep analysis.
- Stream responses; parallel tool use.

## SECTION 9 — ADMIN PANEL FIXES — ⏳ TODO
Users page: Avatar / Username / Email / Tier / Created / Last Active /
Actions. Pull from profiles. Search by email/username. Filters by tier /
signup / activity.
Demo data cleanup: every admin page → real Supabase queries.
Research editor bug: red "can't send text" error. Fix validation, allow
1-word minimum, support text + images + links.

## SECTION 10 — SWAP PAGE WALLET CONNECTION — ⏳ TODO (NEEDS REAL DEVICE)
Real Phantom + MetaMask SVG logos. Vendor locally.
Desktop: WalletConnect v2 SDK + MetaMask/Phantom extension. "Install"
button if missing.
Mobile (CRITICAL):
  MetaMask: deep link metamask://wc?uri={URI} or WC QR
  Phantom: deep link phantom://browse/{ENCODED_URL} or WC
Use @reown/appkit. Test on real iOS Safari + Android Chrome.

## SECTION 11 — PERFORMANCE — ⏳ TODO
Real charts everywhere (replace iframes with lightweight-charts).
Apply to: coin detail pages, VTX inline charts, Bubble Map, Whale Tracker,
Sniper pre-snipe, Market page.
API speed: parallel calls, aggressive caching (5min prices, 1hr less-volatile),
SSR initial load, streaming, WebSocket real-time, Edge functions.
DB: index frequently-queried, materialized views, partition transactions_raw,
selective Supabase realtime.

## SECTION 12 — SECURITY INTEGRATION (PLATFORM-WIDE) — ⏳ TODO
All security features auto-run:
- GoPlus rug check before any swap
- Trust Score (§7) before any trade
- Domain Shield on external links
- Signature Insight on suspicious tx
- Contract Analyzer on new tokens
- Approval Manager monitors active approvals
- Risk Scanner continuous wallet monitoring
NO user action bypasses security checks.

## SECTION 13 — COMPREHENSIVE AUDIT — ⏳ TODO
10 parallel agents (Explore subagent_type), one per area:
Sniper / Copy Trading / Whale Tracker / Telegram / VTX / Admin / Swap /
UI-UX / Trust Score / Performance.
Each reports: built/fixed, still broken, errors, recommendations.
Hidden issues: empty try/catches, console.log in prod, TODO comments,
hardcoded values, missing loading/error states, broken pagination,
memory leaks, N+1 queries.
Report and fix everything found.

## SECTION 14 — TESTING — ⏳ TODO
Test accounts: phantomfcalls@gmail.com / regadapol@gmail.com /
nevo.paul@gmail.com. Per feature: implement → test desktop (1440) → test
mobile (375) → verify Supabase saves → verify real APIs (network tab) →
verify no console errors → verify performance (page <1s, actions <2s) →
commit.
End-to-end flows:
1. New user: signup → verify email → onboarding → connect wallet → first trade
2. Whale following: browse → view profile → follow One-Click → notification
   on whale trade → confirm copy trade
3. Sniping: setup → wait for token launch → snipe executes → check tx → see
   in history
4. VTX: ask about portfolio (real wallet) → ask about token (TokenCard) →
   request swap (SwapCard) → confirm (executes)
All four flows must work flawlessly.
```

---

## 11. How to start Session C

1. **Open** `C:\Users\DELL LATITUDE 5320\dev\steinzlabs` in VS Code.
2. **Read this file end to end.** Re-read §2 (rules) and §6 (gotchas) until you've internalized them.
3. **Confirm the 9 open PRs** are still on GitHub:
   ```
   git fetch --all
   git branch -r | grep feat/
   ```
4. **Have Phantomfcalls merge them in the order in §5** — Session A's auth + telegram, then sniper 1→5, then copy-trading, whale-tracker, uiux-tokens, trust-score, vtx-fixes-v2.
   - You CANNOT merge to main yourself (sandbox blocks it). Ask him.
5. **Pull latest main** after merges. Run `npx tsc --noEmit` — must pass.
6. **Pick the next section** in this priority order, with stated reasoning:
   - **§9 Admin** — small surface, self-contained, immediate user-visible win (research editor bug is the #1 demo blocker).
   - **§7+§8 polish** — apply Trust Score badges to remaining surfaces (market, wallet, whale holdings); apply UI tokens to remaining cards. Bite-sized real wins.
   - **§10 Swap Wallet** — high blast radius, needs real-device testing. Schedule a session WITH Phantomfcalls available to test on his phones.
   - **§11 Performance / charts** — replace iframes with lightweight-charts. Self-contained per surface.
   - **§12 Security integration** — cross-cutting. Audit-then-extend pattern.
   - **§13 Comprehensive audit** — 10 parallel `Explore` agents. Fix every CRITICAL + HIGH same-session.
   - **§14 E2E testing** — sit beside Phantomfcalls, run the 4 flows.
7. **TodoWrite** a real plan for the section before any code.
8. **Audit the existing code in that section first.** Ship-extend-audit pattern, not extend-and-pray.
9. **Build → audit (parallel agents) → fix criticals → commit → push → PR.** Repeat per section.
10. After every section, end your turn with a one-line offer to schedule a follow-up agent for any natural future task (clean up a flag, re-evaluate a metric, etc.) — only if the odds it'd be useful exceed ~70%.

## 12. Phantomfcalls's working preferences (saved across sessions)

- He's casual ("okay", "deep deep", "picture perfect") — match the register, don't go corporate.
- He pushes back when work feels rushed. If he says "go deep deep" he means **deploy parallel audit agents and fix what they find**, not summarize.
- He says "audit always before begin" — make this a habit even when not asked.
- He's the source of the master prompt; treat it as the constitution.
- He gives one-letter answers ("a", "yes") to confirm; the harness sometimes blocks "yes apply migration" until you ask explicitly. Plan accordingly.
- He cares about visible polish — slightly-wrong copy ("Auto-Copy is deferred", A-F letter grades) bothers him. Match the spec exactly.
- He'll tell you when to hand off vs continue. When in doubt: hand off cleanly rather than ship half-baked work that needs another session to clean.

---

**End of handoff.**

After Phantomfcalls merges the 9 PRs, the platform is ~70% through the master spec. The remaining ~30% (§9, §10, §11, §12, §13, §14) is what this doc is for. Don't disappoint him.
