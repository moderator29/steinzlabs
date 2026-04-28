# Steinz Labs — Session A → B Handoff

> **Read this whole file before touching anything.** It tells you who the
> user is, how they work, what got done in Session A, and the exact state
> you're inheriting. Skipping it = repeating Session A's mistakes.

---

## 1. Who you're working for

- **User**: Phantomfcalls (`Phantomfcalls@gmail.com`).
- **Role**: Founder/CEO of **Steinz Labs** (also branded as **Naka Labs**).
  The repo is `steinzlabs`; the customer-facing brand uses both names.
- **Telegram bot**: `@Nakalabsbot`.
- **Test accounts** (all on Max tier, never delete or downgrade):
  - `Phantomfcalls@gmail.com` — primary
  - `regadapol@gmail.com` — comp Max (Session A upgraded)
  - `nevo.paul@gmail.com` — comp Max (Session A upgraded)
- **Tier**: he treats Max as the reference experience. When you build a
  new feature, MAX users see everything; lower tiers get gated friendly
  pitches, not 404s.

## 2. How he works (rules — non-negotiable)

These came directly from his original brief. Apply them every turn.

1. **No shortcuts. No demos. No mock data. No "good enough."** If a
   component would render placeholder or hardcoded values, it doesn't ship.
2. **Real APIs, real data, real charts.** No iframe embeds where we can
   render native. No fabricated PnL/win-rate. The codebase already has
   CoinGecko, Alchemy, Helius, Arkham, GoPlus, 0x, Jupiter — use them.
3. **Industry standard or better.** Reference benchmarks: MEVX, Nansen,
   Trojan, Maestro. He explicitly wants to *exceed* these, not match.
4. **Investigate root causes.** Fix the actual bug, not the symptom.
5. **Test locally before declaring complete.** TS clean, build clean,
   no console errors, sub-second page loads, sub-2s actions.
6. **Commit per section, push per section.** One feature branch per
   section, named `feat/<section-name>`. PR per section.
7. **Audit what you ship.** After finishing a section, deep-audit it —
   empty try/catches, console.logs in prod, TODOs, hardcoded values,
   missing loading/error states, broken pagination, memory leaks, N+1
   queries. Fix what you find before moving on.
8. **UI/UX is picture-perfect or it doesn't ship.** Bloomberg-terminal
   density. Dark theme primary, light theme supported. WCAG AAA contrast
   (Section 1 already shipped this for auth pages — match that bar
   everywhere).
9. **Mobile + desktop both perfect.** Test at 375px and 1440px.
10. **Accessibility-aware.** Old users with poor eyesight must be able
    to read every label. Body text 15-16px minimum, font weight 500-600,
    headings clear hierarchy.
11. **Log every paid API call** so cost stays visible.
12. **Don't twist requirements.** If the spec says "10 chains," it
    means 10. If it says "sub-2s execution," that's the bar.
13. **Think deep before you build. Plan before you code.** Every section
    starts with a TodoWrite list.
14. **Speak the way he speaks.** He's casual ("okay", "deep deep",
    "picture perfect"); reply in plain prose, no buzzwords. Be honest
    about scope and blockers — he respects "this needs another session"
    over fake completeness.

## 3. What Session A delivered

Three feature branches pushed to GitHub, all type-check clean, ready for
PR review and Vercel auto-deploy on merge:

| # | Branch | Section | What ships |
|---|---|---|---|
| 1 | `feat/auth-contrast-readability` | Section 1 | Login + signup contrast — every text color now WCAG AAA on `#07090f`. Inputs 16px/500 weight, labels bumped to 11px bold, icons from 20% → 60% opacity, scoped `<style>` for placeholder color, Forgot/Sign up links to `#7DA3FF`. |
| 2 | `feat/telegram-bot-real-data` | Section 5 | Telegram bot returns real data **in chat** instead of "click here to open the platform" links. Commands: `/price`, `/chart` (PNG via QuickChart), `/info`, `/security` (GoPlus EVM + Solana), `/whales`, `/whale`, `/alerts`, `/setalert`, `/portfolio`, `/trending`, `/gainers`. New helpers in `lib/telegram/commands/{format,resolveSymbol,chartImage,handlers}.ts`. Webhook router cleaned up with single switch dispatch + `@BotName` suffix stripping. |
| 3 | `feat/sniper-rebuild` | Section 2 phases 1-2 | Schema migration `sniper_v2_extensions` + chain configs for 5 chains (`lib/sniper/chains.ts`) + types (`lib/sniper/types.ts`) + complete UI rewrite (`app/dashboard/sniper/page.tsx` + `NewSniperModal.tsx`) — kill switch, stats strip, chain filter pills, tabs (My Snipers/Feed/History), modal with all v2 settings (TP/SL, trailing stop, MEV-protect, multi-wallet picker, daily limits). |

**PR links** (open these in GitHub UI to review/merge):
- https://github.com/moderator29/steinzlabs/pull/new/feat/auth-contrast-readability
- https://github.com/moderator29/steinzlabs/pull/new/feat/telegram-bot-real-data
- https://github.com/moderator29/steinzlabs/pull/new/feat/sniper-rebuild

Session A also (admin tasks via Supabase MCP, no commit needed):
- Section 0: upgraded `regadapol@gmail.com` and `nevo.paul@gmail.com`
  to Max tier, tier_expires_at = `2125-01-01`, tier_auto_renew = false,
  role unchanged at `user` (no admin perms).
- Linked the local repo to Vercel project `nodejs` and pulled
  `.env.local` (77 keys: Alchemy, Helius, GoPlus, Arkham, Anthropic,
  Supabase, Resend, WalletConnect, Sentry, Turnstile, 0x, Birdeye,
  LunarCrush, Etherscan, CoinGecko all present).

## 4. What's still pending — DETAILED PHASE BREAKDOWN

These are the real estimates, not aspirational. Each one is a session
unto itself if done to his standard.

### Section 2 (Sniper) — phases 3-5 remaining

- **Phase 3: Per-chain execution adapters** (`lib/sniper/engine/`)
  - `solana.ts` — Jupiter v6 quote + swap, Jito bundle submission for
    MEV-protect, retry on slot expiry. Helius RPC.
  - `evm.ts` — 0x Protocol Swap API (already in env: `NEXT_PUBLIC_ZX_API_KEY`),
    Flashbots Protect RPC for `mev_protect=true` on Ethereum, BloxRoute
    for BSC. Use ethers v6 (already installed).
  - `ton.ts` — TON Center API for swap routing (Ston.fi or DeDust).
    No mempool, no MEV concerns.
  - All adapters return `{ txHash, gasUsed, executionTimeMs, error? }`.
- **Phase 4: Mempool listeners** (webhooks, not polling)
  - `app/api/sniper/match/route.ts` — single endpoint receives Alchemy
    Notify + Helius webhook events. Validates via signing key from
    `ALCHEMY_WEBHOOK_SIGNING_KEYS` / Helius secret. For each event:
    1. Find matching `sniper_criteria` (chain in chains_allowed,
       enabled=true, paused=false, today's snipes < daily_max_snipes)
    2. Run filters: liquidity, taxes, holders, security_score (call
       /api/sniper POST for GoPlus check)
    3. If `auto_execute=true`, dispatch to per-chain engine; else
       insert `sniper_match_events` with `decision='alert'` and push
       Telegram notification via existing `lib/telegram/notify.ts`.
  - `webhook-setup/` already has scaffolding — extend it.
- **Phase 5: Auto-sell engine** (cron, not webhooks — needs price polling)
  - Existing `vercel.json` cron `/api/cron/sniper-monitor` runs every
    5min. Re-implement to:
    1. Pull all `sniper_executions` where `status='confirmed'` and
       `realized_at IS NULL`
    2. For each, fetch current price (Jupiter quote for SOL,
       0x quote for EVM), compute % from entry
    3. If `>= take_profit_pct` or `<= -stop_loss_pct` or trailing
       stop hit, dispatch sell via engine, set `realized_at` and
       `pnl_usd`.
  - Trailing stop state needs an extra column (`peak_price_native`)
    — add migration when implementing.

### Section 3 — Copy Trading Bot

Three modes, full schema and execution wiring. The schema tables
(`user_copy_rules`, `user_copy_trades`) **already exist** with RLS — Session A
verified via `list_tables`. Verify columns match what the section 3
spec asks for and migrate any missing fields. Existing cron
`/api/cron/copy-trade-monitor` is the execution loop entry point.

### Section 4 — Whale Tracker

Existing `whales` table has 449 rows and `whale_activity` has 28,354
rows — real data, just needs surfacing properly. The spec explicitly
calls out "gibberish logos" — pull from Arkham first
(`ARKHAM_API_KEY` is in env), then ENS via Alchemy, then a curated
manual list, then Dicebear for fallback. Cache logos 24h.

PnL backfill: Session A already saw `whales.pnl_30d_usd`,
`pnl_7d_usd`, `pnl_90d_usd`, `win_rate`, `trade_count_30d`,
`whale_score`, `archetype` columns exist. Cron
`/api/cron/whale-backfill-pnl` runs every 30min to populate them —
verify it actually does, fix if not.

AI Analysis: send whale stats to Claude (Anthropic SDK already in
deps), cache result 24h in `whale_ai_summaries` (table exists).

### Sections 6, 7, 8, 9, 10, 11, 12 — see original spec verbatim below

### Section 13 — Audit
After all sections built. Use `Agent` tool with `subagent_type: Explore`
in parallel for each area. Report findings, fix.

### Section 14 — E2E testing
Test on the 3 Max accounts. 4 user flows. 0 console/TS/build errors.

## 5. Repo & infra context

- **Local path**: `C:\Users\DELL LATITUDE 5320\dev\steinzlabs`
- **Stack**: Next.js 15 App Router, TypeScript, Tailwind, Supabase
  (PostgreSQL + Auth), Zustand, Recharts + lightweight-charts + D3,
  Framer Motion, ethers v6, @solana/web3.js, alchemy-sdk, @upstash/redis,
  Anthropic SDK, Sentry, Cloudflare Turnstile.
- **Dev server**: `npm run dev` (port 5000).
- **Vercel project**: `nodejs` under team `phantomfcalls-8856s-projects`
  (`team_Tyxg3NQHsQAmf2y2wfp4VbJT`). `.vercel/` is gitignored.
  Production deploys auto on push to `main`.
- **Env**: `.env.local` (gitignored) was pulled via `vercel env pull`.
  77 keys present. To re-pull or update: `vercel env pull .env.local`.
- **Supabase project**: ID `phvewrldcdxupsnakddx`, region `eu-west-1`,
  Postgres 17. Owner: `boosthubservice@gmail.com`.

## 6. MCPs available

Both connected via Claude.ai integrations (not local config):

- **Supabase MCP** — full read/write SQL, migrations, edge functions,
  type generation, advisors. Tools: `list_tables`, `execute_sql`,
  `apply_migration`, `deploy_edge_function`, `get_advisors`,
  `generate_typescript_types`, etc.
- **Vercel MCP** — projects, deployments, build logs, runtime logs,
  domains. Does NOT include env-var pull — use the local Vercel CLI
  (`vercel env pull`) for that.

Use `ToolSearch` with `select:<tool_name>` to load deferred MCP tools.

## 7. Schema additions from Session A (Supabase)

Migration `sniper_v2_extensions` already applied:

```sql
ALTER TABLE public.sniper_criteria
  ADD COLUMN take_profit_pct numeric,
  ADD COLUMN stop_loss_pct numeric,
  ADD COLUMN trailing_stop_pct numeric,
  ADD COLUMN max_slippage_bps integer DEFAULT 500,
  ADD COLUMN priority_fee_native numeric,
  ADD COLUMN mev_protect boolean DEFAULT true,
  ADD COLUMN expiry_hours integer,
  ADD COLUMN paused boolean DEFAULT false,
  ADD COLUMN wallet_addresses text[] DEFAULT '{}',
  ADD COLUMN auto_sell_on_target boolean DEFAULT false,
  ADD COLUMN auto_sell_on_liquidity_drop_pct numeric,
  ADD COLUMN notes text;

ALTER TABLE public.sniper_executions
  ADD COLUMN chain text,
  ADD COLUMN amount_native numeric,
  ADD COLUMN gas_used numeric,
  ADD COLUMN gas_price_native numeric,
  ADD COLUMN pnl_usd numeric,
  ADD COLUMN realized_at timestamptz,
  ADD COLUMN criteria_id uuid REFERENCES sniper_criteria(id),
  ADD COLUMN wallet_address text,
  ADD COLUMN execution_time_ms integer;

CREATE INDEX idx_sniper_executions_user_status
  ON sniper_executions(user_id, status, executed_at DESC);
CREATE INDEX idx_sniper_executions_criteria
  ON sniper_executions(criteria_id);
CREATE INDEX idx_sniper_criteria_user_enabled
  ON sniper_criteria(user_id, enabled) WHERE NOT paused;
```

**Backwards-compat note**: `sniper_executions.amount_sol` is preserved
for legacy rows. New rows should use `amount_native + chain` instead.

## 8. Gotchas Session A hit (don't repeat them)

- **`useAuth` does NOT expose `profile` separately** — `user` IS the
  profile. Pass `effectiveTier(user)`, not `effectiveTier(profile)`.
- **`whales` table column names**:
  - `label` (not `name`)
  - `trade_count_30d` (not `total_trades_30d`)
  - has `pnl_7d_usd`, `pnl_30d_usd`, `pnl_90d_usd` (NOT `pnl_24h_usd`)
  - has `archetype`, `whale_score`, `follower_count`, `verified`,
    `x_handle`, `tg_handle`, `portfolio_value_usd`
- **`price_alerts` table**:
  - `price` (not `target_price`)
  - `triggered` boolean (not `is_active`)
- **`user_wallets_v2` is JSONB**, not flat columns. Schema:
  `{ user_id, wallets: [{address, chain?, label?}], default_address }`
- **`PageHeader` component API**: `{ title, description, actions, ... }`
  — NOT `subtitle` or `right` or `icon`. Don't pass an icon component.
- **Telegram Markdown gotcha**: legacy "Markdown" parse mode (which
  the bot uses) needs only `*_[]\`` escaped. Don't use MarkdownV2 unless
  you're prepared to escape `\.!|{}()=` etc. on every value.
- **Vercel project name**: it's literally `nodejs` even though the repo
  is `steinzlabs`. Don't search for "steinz" in `vercel link`.
- **Vercel CLI on Windows**: works fine via Git Bash, no quirks. The
  user's terminal is `bash` per env config.
- **Sandbox blocks `git reset --hard` on main and merging to main
  without explicit user authorization.** Don't try. Open PRs and let
  the user merge via GitHub.
- **Sniper page on `feat/sniper-rebuild`** — when you switch branches,
  expect the working tree's sniper page to look "old" on every other
  branch. That's correct git behavior.

## 9. How to start Session B

1. **Open** `C:\Users\DELL LATITUDE 5320\dev\steinzlabs` in VS Code.
2. **Confirm the 3 Session A PRs** are open / merged on GitHub:
   - feat/auth-contrast-readability
   - feat/telegram-bot-real-data
   - feat/sniper-rebuild
3. **Pull latest main** (`git checkout main && git pull`).
4. **Branch** for whatever section is next:
   - If the user says "continue sniper": `git checkout -b feat/sniper-engine`
   - If the user says "start copy trading": `git checkout -b feat/copy-trading`
   - Etc.
5. **Read the original spec** in `docs/sessions/HANDOFF-session-A.md`
   §10 — every line, no skipping.
6. **TodoWrite** a real plan for the section before any code.
7. **Build → audit → commit → push → PR.** Repeat.

## 10. The original spec (verbatim)

> The user pasted this in Session A. It's the source of truth. Every
> requirement here is binding. If you implement something that
> contradicts a line here, you're wrong.

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

## SECTION 0 — USER UPGRADES (DO THIS FIRST) ✅ DONE in Session A
Upgrade regadapol@gmail.com and nevo.paul@gmail.com to Max tier.
- Full Max access; NOT admins.
- Subscription marked comp/manual; expiry 100 years out.
- Verify "Max - Legend in the Making" tier display.

## SECTION 1 — LOGIN/SIGNUP TEXT VISIBILITY ✅ DONE in Session A
WCAG AAA contrast (7:1 min). 16px body min. Weight 500-600. Inter/SF Pro.
Audit form labels, placeholders, button text, helpers, errors, links.

## SECTION 2 — SNIPER BOT TOTAL REBUILD (MEVX-LEVEL) — phases 1-2 done

5 chains: ETH / SOL / BNB / TON / AVAX.

Sniper Engine:
- Real-time mempool monitoring per chain
- Webhook-triggered execution (zero cost when no active snipes)
- Sub-second execution speed
- Anti-MEV protection / MEV-resistant routing
- Failed transaction recovery (auto-retry with adjusted gas)

Configuration UI:
- Chain selector
- Token search (paste contract OR search by name)
- Buy amount (in native token)
- Slippage 1-25%
- Priority fee/tip slider
- Max gas limit
- Stop-loss / Take-profit %
- Auto-sell trigger conditions:
  - Price target (e.g., +200%)
  - Time-based (e.g., sell after 1 hour)
  - Liquidity drop alert
  - Trailing stop-loss
- Multi-wallet selection

Active Snipes Dashboard:
- Live feed
- Status indicator (waiting/executed/failed)
- Real-time PnL
- Kill switch (server-side, MUST work)
- Filter by chain/status/time

Snipe History:
- Complete log
- Outcome / execution time / gas / tx hash
- Performance analytics

Security Integration:
- Auto-run GoPlus rug check before sniping
- Honeypot detection / liquidity lock / contract verification
- Display "Naka Trust Score" before snipe

Data Sources:
- Solana: Alchemy + Helius webhooks
- ETH/BNB/AVAX: Alchemy webhooks
- TON: TON API + ton.org docs
- DEX data: DexScreener
- Pump.fun for Solana memecoins
- Security: GoPlus

UI/UX: Bloomberg Terminal density. Dark theme primary, light supported.
Real-time data flowing. Charts integrated. One-click actions. Mobile
responsive (375px tested). Keyboard shortcuts (Cmd+S = snipe).

Speed: <2s execution. <100ms UI updates. Continuous mempool. <1s page load.

## SECTION 3 — COPY TRADING BOT (NEW BUILD)

Three modes, tier-gated:

Mode 1: Alerts Only (Free / Mini / Pro / Max)
- User selects whale to follow
- When whale trades → notification (Telegram + email + push)
- "Copy Now" button

Mode 2: One-Click Copy (Pro / Max)
- Pre-filled swap card on whale trade
- User clicks "Confirm" to execute
- Slippage and gas auto-configured

Mode 3: Auto-Copy (Max only)
- Auto-executes per rules
- Amount per trade (fixed or % of whale's amount)
- Max daily spending
- Token blacklist / category whitelist
- Max slippage
- Cooldown (e.g., 7-day pause after losses)
- Auto-sell rules (TP/SL)
- Pause anytime

Execution flow:
1. Whale executes → Alchemy/Helius webhook fires
2. System detects in user_copy_rules
3. For each follower: check rules, execute via 0x (EVM) / Jupiter (SOL),
   log to user_copy_trades, notify

Database (already created):
- user_copy_rules, user_copy_trades — verify columns match spec.

UI: Real-time dashboard, performance analytics, one-click pause, mobile
responsive, beautiful PnL, Steinz dark neon blue branding.

## SECTION 4 — WHALE TRACKER NEXT-GEN UPGRADE (NANSEN-LEVEL)

Current problems: gibberish logos, no real PnL, no real trades, no real
follower counts, broken filters, demo feel.

Whale Logo Pull (CRITICAL):
1. Arkham API (https://api.arkhamintelligence.com/intelligence/address/{address})
2. Alchemy ENS lookup → ENS avatar NFT
3. Curated database of top 100 (Wynn, Machibrothers, etc.)
4. Dicebear fallback (https://api.dicebear.com/7.x/identicon/svg?seed={address})

Real data per whale:
- Real name (Arkham label / ENS / AI personality)
- Logo + verification status (Arkham blue check)
- Wallet age, chain(s)
- 30d/7d/24h/all-time PnL (USD + %)
- Win rate, avg trade size, total trades, total volume
- Best/worst trade
- Top 10 holdings, diversification
- Last active (real)
- Social: Twitter handle, follower count on Steinz

UI: Nansen-clean. Avatar with verification. Sparkline PnL. Follow modes.
Profile page: Overview / Holdings / Activity / Performance / Followers.
Real-time updates.

All filters MUST work:
- Chain (All / ETH / SOL / BNB / Polygon / Base / TON / AVAX)
- Performance (Top gainers 7d/30d/All)
- Win rate (>50% / >70% / >90%)
- Volume (>$10K / >$100K / >$1M / >$10M)
- Activity (today/week/month)
- Archetype (DeFi/Memecoin/NFT/Whale/Trader)
- Verification (Arkham only / All)
- Sort (Recent/Most followed/Top performer/Most active)

AI Whale Analysis (NEW):
- Click → Claude Sonnet → returns Rating /10 (30d), /10 (10d), Sentiment,
  2-3 sentence summary, recommended copy mode.
- Cache 24h per whale.

Live Feed (currently empty):
- Wire to Alchemy + Helius webhooks
- Real-time SSE/WebSocket
- whale avatar / name / BUY|SELL / token / amount USD / timestamp
- Click → whale profile

My Whales tab (NOT "My Watchlist"):
- Tabs side-by-side: [Live Feed] [My Whales]

## SECTION 5 — TELEGRAM BOT FULL FUNCTIONALITY ✅ DONE Session A

All data fetched and displayed IN THE BOT. No links to external pages.

/price btc → full price card with rank, mcap, vol, 24h hi/lo
/chart {symbol} → server-rendered chart image
/info {symbol} → full token info
/security {address} → GoPlus check
/holders {address} → top holders breakdown
/whales → top 10 by 24h volume
/whale {address} → specific whale profile
/follow /unfollow /myfollows
/portfolio /balance /holdings /pnl
/alerts /setalert /removealert
/buy /sell /snipe
/connect /disconnect /settings /upgrade
/start /help /menu

Implementation: real-time APIs (CoinGecko / Alchemy / Helius / GoPlus).
Charts rendered server-side (node-canvas / similar). Inline buttons for
actions. Tier gating on advanced commands.

## SECTION 6 — UI/UX UPGRADES PLATFORM-WIDE

Context Feed Containers:
- Bigger height/padding
- Bolder borders (2px not 1px)
- Better visual separation
- Subtle hover effects
- Slide-in animation on new events

"View Proof" Button:
- More lucrative and clean
- Bigger, better styling, hover glow, clear iconography

Text Readability (Twitter-style):
- Body 15-16px min
- Heading hierarchy: 24/20/18/16
- Weight 500 body, 600 emphasis (NOT 700+ everywhere)
- Line-height 1.5-1.6, letter-spacing 0.01em

Color strategy:
- Dark mode: white #FFFFFF / #E5E5E5 / #A3A3A3
- Light mode: black #000000 / #333333 / #666666
- Auto-switch on theme toggle

Container styles applied platform-wide:
- Dashboard cards
- Whale Tracker cards
- Market page coin rows
- VTX chat messages
- Portfolio cards
- All settings panels

## SECTION 7 — NAKA TRUST SCORE (NEW)

0-100 score. Combine signals:
- Security (40%): GoPlus, contract verified, liquidity locked, ownership
  renounced, mint disabled
- Liquidity (20%): total liq USD, liq:mcap ratio, depth on top DEX, 24h vol
- Holder (15%): total holders, top 10 concentration, whale concentration,
  holder growth
- Market (15%): days since launch, mcap stability, price volatility (lower
  = better), buy/sell pressure
- Social (10%): LunarCrush, Twitter sentiment, trending mentions, community

Display:
- 80-100: Green "Highly Trusted"
- 60-79: Blue "Trusted"
- 40-59: Yellow "Caution"
- 20-39: Orange "High Risk"
- 0-19: Red "Dangerous - Avoid"

Show on: VTX TokenCard, swap page (before confirm), sniper bot, market
page, wallet (held tokens), whale tracker (whale holdings).

On click: detailed breakdown showing each layer score, educational tooltips.

Implementation: calc on demand, cache 1h, background refresh actively-traded
tokens every 30min.

## SECTION 8 — VTX AGENT FIXES

Chart loading: chart appears INSTANTLY when token mentioned. Pre-fetch on
detection. 5-min cache. No "loading" placeholder. Static (not draggable).

Speed: <500ms first token. <3s full response. <1s tool calls.

Accuracy: real-time data only. Always check CoinGecko/Alchemy first.
Never make up data.

Implementation: Sonnet for simple, Opus for complex. Stream responses.
Parallel tool use.

Swap Card Cleanup:
- Clear sender token (logo, symbol, amount)
- Clear receiver token
- Exchange rate, slippage, network fee, total cost
- Confirm Swap (large, dark neon blue) / Cancel
- No clutter.

## SECTION 9 — ADMIN PANEL FIXES

Users page: show columns (Avatar, Username, Email, Tier, Created, Last
Active, Actions). Pull from profiles. Search by email/username. Filters
by tier/signup/activity.

Demo data cleanup: audit every admin page — replace mock data with real
Supabase queries. Dashboard stats, revenue, user analytics, feature
usage, whale management, research.

Research Editor bug: red "can't send text" error. Fix validation, allow
1-word minimum, support text + images + links, clear error messages.

## SECTION 10 — SWAP PAGE FIXES

Real Phantom + MetaMask logos (SVG). Pull official:
- MetaMask: https://docs.metamask.io/wallet/concepts/logo/
- Phantom: https://phantom.app/brand

Wallet connection (mobile + desktop):
- Desktop: WalletConnect v2 SDK. MetaMask/Phantom browser extension.
  If not installed, "Install MetaMask/Phantom" button.
- Mobile (CRITICAL):
  - MetaMask: deep link `metamask://wc?uri={WC_URI}` OR WalletConnect QR
  - Phantom: deep link `phantom://browse/{ENCODED_URL}` OR WC integration

Use @reown/appkit (Web3Modal) — handles all this. Or @solana/wallet-adapter
+ WalletConnect for MetaMask.

Test on real phone:
- iOS Safari → MetaMask → app → approve → return
- Android Chrome → Phantom → app → approve → return

## SECTION 11 — PERFORMANCE AND SPEED

Real charts everywhere (no embeds): replace TradingView/Dexscreener iframes
with lightweight-charts (already in deps).

Apply to: coin detail pages, VTX inline charts, Bubble Map, Whale Tracker,
Sniper pre-snipe, Market page.

API speed:
- Parallel calls (Promise.all)
- Aggressive caching (5min prices, 1hr less-volatile)
- SSR for initial page load
- Streaming responses
- WebSocket for real-time
- Edge functions for low latency (Vercel Edge)

DB optimizations:
- Index frequently-queried columns
- Materialized views for expensive aggregations
- Partition large tables (transactions_raw)
- Use Supabase realtime selectively

## SECTION 12 — SECURITY INTEGRATION (PLATFORM-WIDE)

All security features auto-run:
- GoPlus rug check before any swap
- Trust Score before any trade action
- Domain Shield on external links
- Signature Insight on suspicious tx
- Contract Analyzer on new tokens
- Approval Manager monitors active approvals
- Risk Scanner continuous wallet monitoring

NO user action bypasses security checks.

## SECTION 13 — COMPREHENSIVE AUDIT

10 parallel agents:
1. Sniper Bot (verify Section 2)
2. Copy Trading (Section 3)
3. Whale Tracker (Section 4)
4. Telegram Bot (Section 5)
5. VTX Agent (Section 8)
6. Admin Panel (Section 9)
7. Swap Page (Section 10)
8. UI/UX (Section 6)
9. Trust Score (Section 7)
10. Performance (Section 11)

Each reports: built/fixed, still broken, errors, recommendations.

Hidden issues:
- Empty try/catch blocks
- Console.log in prod
- TODO comments
- Hardcoded values that should be configurable
- Missing loading states
- Missing error states
- Broken pagination
- Memory leaks
- Inefficient queries (N+1)

Report and fix everything.

## SECTION 14 — TESTING

Test accounts: phantomfcalls@gmail.com / regadapol@gmail.com / nevo.paul@gmail.com.

Per feature: implement → test desktop (1440) → test mobile (375) → verify
Supabase saves → verify real APIs (network tab) → verify no console errors
→ verify performance (page <1s, actions <2s) → commit.

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

**End of handoff.** Open the 3 PRs, merge them, then start Session B with
"continue Section 2 phase 3" or whichever section is next.
