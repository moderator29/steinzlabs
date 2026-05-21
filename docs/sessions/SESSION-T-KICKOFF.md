# SESSION T — KICKOFF

> **Read this entire doc before writing any code.** Supersedes the Session S
> kickoff. The owner's locked operating rules + the P0→P3 roadmap state +
> Dune integration plan + the open verification debt all live here. Auto-
> execute top-to-bottom; do not ask permission for routine work.

---

## §0 Auto-begin (the first 5 minutes)

```bash
# 1. Sync + identity
git fetch origin --prune
git checkout main && git pull --ff-only
git config user.name      # MUST print: moderator29
git config user.email     # MUST print: 101205446+moderator29@users.noreply.github.com

# 2. Repo bearings
git log --oneline -10
git branch -r --no-merged origin/main   # open PRs to land first

# 3. MCP confirmation
#   - Supabase MCP: list projects, list tables (we have ~150 in public schema)
#   - Vercel MCP: list teams. If empty, flag it — you cannot enumerate
#     deployments and prod verification falls back to the owner.
```

If the owner's first message is a slash command or a bug report, **drop the
roadmap and serve them**. Otherwise, work the §3 P1 backlog top-down.

---

## §1 Locked rules — non-negotiable

These are the owner's rules; they apply on every action.

### 1.1 Identity + commit

- Git identity **MUST** be `moderator29 <101205446+moderator29@users.noreply.github.com>`
- **Never commit to `main`**. Always cut a branch, push, open a PR.
- **Never amend** an existing commit. Always create a new commit on top.
  Failed pre-commit hook → fix → new commit (the failed commit did not
  happen, so `--amend` would modify the *previous* commit).
- **Never use `--no-verify`** or any hook-skip flag.
- **No AI attribution anywhere.** Not in commit messages, not in PR
  descriptions, not in code comments. No `Co-Authored-By: Claude`. No
  robot footer. No "Generated with…" text. The classifier will block
  it if you try.
- **Conventional Commits**: `feat: / fix: / refactor: / chore: / docs: /
  test: / perf:`. Message body ends with the *why*, not the *what*
  (the diff already shows the what).
- **No `git add -A` blindly.** Stage by path. `.env`, credentials, large
  binaries must never land in a commit.

### 1.2 Audit before each commit

Before every `git commit`:

1. `git diff --stat` — confirm only the intended files changed
2. `npx tsc --noEmit` — must be clean (or document why a specific error
   is acceptable)
3. Diff scan: no `console.log` left in production paths, no empty
   `try/catch {}`, no TODO comments without a tracking note, no
   hardcoded secrets or test addresses, no commented-out code.
4. For UI: think about the failure modes a real user will hit
   (loading / error / empty / unauthenticated / mobile width)

### 1.3 Branch hygiene

- **`git fetch --all --prune`** *before* cutting any new branch
- One **logical scope** per branch. Bundle related sub-items into one
  branch with multiple commits — don't ship 10 micro-branches per phase
  (owner explicit: "no too much of branches"). 3–5 phase-branches max
  for a multi-section prompt.
- Name: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`,
  `refactor/<slug>`.
- Push immediately after the first audit-clean commit. Don't sit on
  local-only branches.

### 1.4 No mock data, no demos, no stubs

- **Real data everywhere.** If the upstream data isn't there yet, build
  the server pipeline in the SAME branch. Never park behind a stub.
- **Build the pipeline, don't fake it.** UI missing real data → wire the
  real upstream API (Supabase / Alchemy / Helius / CoinGecko / Dune /
  Birdeye / GoPlus / DexScreener), even if it adds 200 LOC.
- **No "Coming soon" placeholders.** If the feature doesn't ship in
  this branch, hide its entry point too.

### 1.5 Communication style with the owner

- **Todo list = full backlog in plain English, then the owner picks.**
  Do not collapse multi-section prompts down to bullet headlines. Every
  sub-item gets its own row.
- **Multi-section prompts → extract every sub-bullet into todos**, do
  not summarize at section level.
- **Autonomous mode**: when the owner says "begin / proceed / no
  stopping", make reasonable defaults and keep going. Confirm only for
  destructive or migration ops.
- **Overnight mode**: when the owner says "going to bed / wake up
  still working", never stop, never ask, never opine. Parallelize via
  sub-agents.
- **Concise updates** between tool calls, no narration of internal
  deliberation.
- **Honest reporting at end of session**: ✅ verified fixed / ⚠️ fixed
  but pending deploy / ❌ couldn't fix (with reason).

### 1.6 No false "fixed" claims (Rule 1 of the Profile/VTX prompt)

You may **not** say "fixed" until ALL of:

1. Code committed and pushed
2. Vercel deployment completed successfully (verify via Vercel MCP)
3. You (or the owner) visited the production URL and confirmed the bug
   is gone
4. Specific verification details documented

If you can't reach prod from this environment (Vercel MCP team scope
empty), say "attempted fix, pending production verification" and hand
the URL to the owner.

### 1.7 Destructive ops require confirmation

- `rm -rf`, `git reset --hard`, `git push --force-with-lease`, dropping
  Supabase tables, Vercel project deletes — all need explicit owner
  sign-off in the conversation OR a clear authorization in CLAUDE.md.
- Force-pushing to `main` is **never** allowed.
- Use `--force-with-lease` (not `--force`) when rebasing your own
  branches.

---

## §2 What just shipped — P0 status

**All 10 P0 items are pushed.** None are verified in production yet.
Merge order + spot-check checklist below.

| # | Item | Branch | Commit |
|---|---|---|---|
| 1 | Multi-aggregator (1inch/Kyber/OpenOcean) wired into swap UI | `feat/swap-routes-mev-orders-pi` | `bb9983c` |
| 2 | Wallet cluster cron persists clusters (one-line orchestrator call) | `feat/cluster-cron-and-holder-panel` | `dd54f21` |
| 3 | Whale PnL leaderboard from `whales.pnl_30d_usd` + `win_rate` | `feat/whale-tracker-grade` | `d083b87` |
| 4 | Smart-money convergence badge on Context Feed cards | `feat/whale-tracker-grade` | `374653d` |
| 5 | Whale behavioral tags (Accumulator/Distributor/Sniper/Win-rate) | `feat/whale-tracker-grade` | `d083b87` |
| 6 | Limit / DCA / Stop-loss inline on swap panel (collapsible) | `feat/swap-routes-mev-orders-pi` | `c183dd1` |
| 7 | MEV toggle in swap UI + sandwich-risk pill + auto-on >$1K | `feat/swap-routes-mev-orders-pi` | `384963f` |
| 8 | `/api/swap/price` price impact for Solana (Jupiter normalised) | `feat/swap-routes-mev-orders-pi` | `a2d0c53` |
| 9 | Holder distribution panel on token page (top-10 with bars) | `feat/cluster-cron-and-holder-panel` | `dd54f21` |
| 10 | Fix `/api/market/resolve` `chain: 'ethereum'` hardcode for tickers | `fix/market-resolve-chain-leak` | `e10d9d0` |

### Merge order (safest, no rebase pain)

1. `fix/market-resolve-chain-leak` — smallest, isolated
2. `feat/cluster-cron-and-holder-panel` — cron + SecurityPanel, no overlap
3. `feat/whale-tracker-grade` — tracker page + feed API + ContextFeed
4. `feat/swap-routes-mev-orders-pi` — biggest, swap page + SwapCard + 2 APIs

### Prod spot-check after each merge

After Vercel deploys each branch:

- **Branch 1**: search "SOL" on Market page → result clicks should route
  to `/dashboard/market/solana/solana`, NOT `/dashboard/market/ethereum/*`.
  Same for XRP → `/dashboard/market/xrp/ripple`.
- **Branch 2**: hit `/api/cron/cluster-analysis` with cron auth →
  response should include `clustersBuilt > 0` once edges process.
  Visit any token detail page → "Top 10 Holders" panel should render
  in the security section with proportional bars.
- **Branch 3**: visit `/dashboard/whale-tracker` → PnL Leaderboard
  panel next to Top Today, feed rows show behavioral pills, context
  feed cards show "N smart wallets bought $X (24h)" badge.
- **Branch 4**: visit `/dashboard/swap` → RouteComparison block,
  MEV pill, Advanced Orders block. Solana swap should now show a
  price impact value.

---

## §3 P1 backlog — 10 items, 4 focused branches

Each item ships behind an audit + commit. Branch suggestions below
follow the "3–5 phase-branches max" rule.

### Phase P1-A: Copy-trade latency overhaul

**Branch**: `feat/copy-trade-latency-overhaul`

The single biggest latency bottleneck per the audit: every copy-trade
execution waits ~8s for `getAllRoutes()` to fan out three aggregator
quotes serially via `fetchWithRetry(timeoutMs=8000)`. Three sub-fixes:

1. **Quote pre-warming cache (Redis)** — pre-warm best route on whale
   detection (the alchemy-whale + helius-whale webhooks). Key:
   `quote:${chain}:${tokenIn}:${tokenOut}:${amountTier}`. TTL 15–30s.
   Drops execution latency 8s → ~500ms.
   - Acceptance: copy-trade flow shows `cache_hit: true` in
     `pending_trades.route_data` for >80% of executions.
2. **Async matcher queue** — the alchemy-whale webhook currently
   `await`s `matchCopyEvent` inline; one user's slow GoPlus call
   blocks every other user's match. Move to a queue (Bull on Redis,
   or Vercel Queues). Webhook returns 202 immediately.
   - Acceptance: webhook P50 latency < 100ms (currently ~700ms).
3. **Tighter poll fallbacks** — `app/api/cron/copy-trade-monitor`
   5min → 30s, `whale-activity-poll` 10min → 1min. Update
   `vercel.json` cron schedule.
   - Acceptance: webhook-drop catch-up window ≤ 1min.

### Phase P1-B: Real-time alerts + UI velocity

**Branch**: `feat/realtime-alerts-and-velocity`

1. **WebSocket / Supabase Realtime for notifications** —
   `NotificationBell` currently polls `/api/notifications` every 2min,
   and alert-monitor cron fires every 5min, so the floor is ~5–7min
   stale. Switch the bell to a Supabase `notifications` table
   `realtime` subscription. Cron keeps firing; subscription delivers.
   - Acceptance: a new whale alert reaches the bell in <2s.
2. **LunarCrush velocity** — `/api/social` returns 24h totals only.
   Extend with 6h-window deltas (data already in LunarCrush
   response). New endpoint `/api/social/velocity?token=X` returns
   `{ tweets_6h, tweets_24h, velocity_pct, sentiment_shift }`.
   Surface on token detail page + VTX context injection.
   - Acceptance: token page shows a "🔥 +420% Twitter (6h)" pill
     when velocity is significant.

### Phase P1-C: Cross-chain + free social signals

**Branch**: `feat/lifi-bridge-and-social-discovery`

`LIFI_API_KEY` is already in env per the owner.

1. **LiFi bridge integration** — single aggregator covers Stargate +
   Across + Hop + deBridge + Wormhole. Three pieces:
   - `lib/services/lifi.ts` — thin client (quote, routes, execute,
     status)
   - API routes: `/api/bridge/quote`, `/api/bridge/execute`,
     `/api/bridge/status/[txHash]`
   - UI: Bridge tab in wallet Send view + auto-bridge step in swap
     when input chain ≠ output chain
   - Acceptance: user can send 0.1 ETH from ETH → Base in the
     wallet UI; status polls until confirmed.
2. **Pump.fun chat + 4chan /biz/ scrapers** — highest-signal Solana
   memecoin early-discovery sources, both free. Two crons:
   - `app/api/cron/pumpfun-velocity-poll` — WebSocket subscription;
     track bonding-curve acceleration spikes per token
   - `app/api/cron/biz-mention-scrape` — public HTML parse, store
     `(token_symbol, mention_count, thread_count, ts)` in a new
     `social_discovery` Supabase table (RLS service-role only)
   - Acceptance: ContextFeed surfaces "Trending on /biz/" cards
     and "Pump curve accelerating" cards alongside whale events.

### Phase P1-D: Portfolio depth + security hardening

**Branch**: `feat/portfolio-depth-and-security-hardening`

1. **Cost basis chart entry markers** — `/lib/pnl/calculator.ts`
   already does FIFO cost basis per `(chain, symbol)`. Render entry
   prices as markers on the per-token chart in portfolio.
2. **PnL by chain** — slice realized + unrealized by `chain` in
   `/api/portfolio/performance`. UI adds a "By chain" segmented row
   with Ethereum / Solana / Base / Arbitrum / BSC totals.
3. **Permit2 batch approvals** — for EVM swaps, use 0x's permit2
   route so users don't need a separate approval tx. Update
   `lib/services/zerox.ts` quote-and-execute flow to request the
   permit2 endpoint when the from-token has no pre-existing allowance.
   - Acceptance: first-time swap of a new token does 1 tx instead of 2.
4. **OFAC blacklist + bytecode similarity** — extend security
   pipeline. New endpoint `/api/security/ofac-check?address=X`
   returns sanctions match. Bytecode similarity hash against a
   curated list of known rug contracts (store in
   `rug_contract_signatures` table).

### Phase P1-E: Multi-aggregator execution wiring (carry-over from P0 B1)

**Branch**: `feat/swap-honor-selected-provider`

P0 #1 wired the multi-aggregator UI but the execute call still
goes through 0x. Plumb `selectedProvider` from `SwapPage` into
`/api/market/trade/execute` (and the gasless variant). Use the
provider's `quoteData` blob.

- Acceptance: selecting "KyberSwap" in RouteComparison and clicking
  Swap actually settles through KyberSwap, not 0x. Verify via
  `swap_logs.provider`.

---

## §4 P2 backlog — polish + differentiation

Verbatim from the owner's roadmap. Every line is an explicit deliverable.
Group into 7 branches (P2-A → P2-G) when work begins.

### P2-A: Charting depth

- Multi-pane chart (RSI / MACD on separate panes below price)
- Drawing-tool persistence per user (new `user_chart_drawings` rows
  already exist; UI never saves)
- Comparison overlay (BTC vs ETH on same chart)
- Replay mode (date scrubber + playback)
- Volume profile by price
- Save-to-image with watermark

### P2-B: VTX tool depth

Per the agent audit there are **21 missing VTX tools**. Add these in
this priority order:

- `whale_tracker_specific(address)` — recent moves + sentiment for one whale
- `realized_pnl_30d(address)` — wallet PnL over exactly 30 days
- `holder_concentration(token)` — top 10 % + gini + Nakamoto
- `cross_token_comparison([symbols])` — side-by-side
- `smart_money_flow(token, hours)` — net flow from smart-money set
- `portfolio_performance(user)` — total / allocation / PnL / win rate
- `portfolio_rebalance_suggestion(user)` — allocation advice
- `alert_subscribe(condition)` — set alerts from chat
- `copy_trade_create(whale, max_per_trade, daily_cap)` — set rule from chat
- `explain_transaction(tx_hash)` — human-readable breakdown
- `transaction_simulator(calldata)` — predict success/fail
- `approval_audit(wallet)` — flag risky token approvals

### P2-C: Network graph + cluster polish

- Edge weighting by USD value (data exists in `wallet_edges.total_value_usd`)
- Node sizing by holding % (needs balance integration)
- Color-coding by entity type (exchange / MM / smart money / new)
- Path-finding between two addresses (BFS on edges graph)
- OFAC / Tornado.Cash adjacency flags
- Time-range scrub (animate graph over time)
- Export PNG / share-link

### P2-D: Trading + signing UX

- **Session-key signing for `auto_copy` mode** — true async copy
  execution (no browser prompt). Issue ephemeral session keys for
  copy-trade scope; `auto_copy` users pre-sign with session-key
  scope, no per-trade confirm needed. Drops 5s wallet signing delay
  to 0 on every copied trade.
- **Bubblemap in-page on token detail** — embed
  `/api/intelligence/bubblemaps/[token]` visualization directly on
  the token detail page (holder cluster graph, linked by transfer
  amounts, sized by holding %). Currently only available via the
  separate bubble-map page; needs to be a panel on every token.
- Cancel / replace EVM tx (0-eth tx with same nonce)
- **Account abstraction (ERC-4337)** for EVM swaps — smart-wallet
  support, sponsored gas, batched approvals
- Hardware wallet support (Ledger, Trezor) via WalletConnect
- NFT send flow
- Approval audit panel (extend the `approval_audit` VTX tool)

### P2-E: Reputation feedback loop

Today the security system has no learning loop — when a user buys a
token via the platform and it later rugs, the deployer score doesn't
update. Build:

- `rug_event_reports` table (user_id, token_address, deployer_address,
  buy_tx_hash, buy_price, current_price, reported_at, confidence)
- Cron `/api/cron/reputation-feedback` that:
  - Polls user_copy_trades + swap_logs for executed buys
  - Compares current price to buy price for tokens last seen >7d ago
  - Auto-files a `rug_event_report` when current_price < 5% of buy_price
- Updates `deployer_history_cache.band` when ≥2 rug reports against
  a deployer accumulate (band drops by one tier per pair of reports)
- Surfaces in VTX context: "this deployer has 3 rugged tokens
  reported by your platform" alongside the existing Etherscan band

### P2-F: Notifications depth

- **Conditional alerts (X AND Y)** — composite predicates, not just
  single thresholds. Example: "ETH < $2500 AND BTC > $80K"
- **Tier-gated alert limits** — Free: 5 alerts, Pro: 50, Max: unlimited
- **Cool-down windows** — don't spam same alert within 60s
- **Alert digests** (daily summary) — `notification-digest` cron
  exists; extend to include daily roll-up
- **User-defined queries** — "alert when ANY whale I follow buys a
  microcap" via a DSL or query-builder UI
- **Discord webhook channels** per user
- **Twilio SMS** for tier ≥ Pro
- **Alert templates** — pre-built ("Smart-money X bought a microcap
  in last 5 min", "Whale Y just dumped >$100K of $Z")

### P2-G: Tax + portfolio depth

- **Tax-loss harvesting suggestions** (US users) — identify positions
  with realized losses available for harvest
- **CSV export** (transactions + holdings + PnL summary) per chain
- **Wash-trade detection** — same symbol within 30d window flag

---

## §5 Dune Analytics integration plan

The owner's #1 priority "new API to unleash". `LIFI_API_KEY` is done;
Dune comes next. **Do NOT ship Dune on the Free tier** — Free is
2,500 credits/mo, can't use Query CRUD or webhooks, and 200 users
hitting Dune directly = 120× over budget.

### 5.1 Plan

- Owner stays on **Free tier for dev + learning**
- The day Dune-powered features go to prod, owner upgrades to
  **Analyst ($399/mo, 25k credits, Plus features unlocked)**

### 5.2 Architecture (only viable path)

```
Frontend (200 users)
  ↓ /api/dune/[key]  (Supabase RLS-gated cache reader)
  ↓
Supabase: dune_cache(query_id, params_hash, result_jsonb, expires_at)
  ↑ writes only via cron worker + VTX agent
  ↑
Cron worker (Vercel cron / Supabase Edge Function)
  ↓ POST /api/v1/query/{id}/execute  ←  ONE writer
  ↓
Dune API (Analyst plan, 25k credits/mo)
```

**Rules**: frontend NEVER hits Dune directly. All reads go through
`/api/dune/[key]` which reads `dune_cache`. The cron worker is the
sole writer of materialized queries. VTX agent gets a 100-credit
interactive reserve, hard-capped at 3 calls/user/day, 50/day total.

### 5.3 Required Supabase tables

```sql
-- Primary cache (all reads served from here)
CREATE TABLE dune_cache (
  query_id text NOT NULL,
  params_hash text NOT NULL,
  result_jsonb jsonb NOT NULL,
  executed_at timestamptz DEFAULT now(),
  ttl_seconds int NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (query_id, params_hash)
);
CREATE INDEX ON dune_cache(expires_at);

-- Usage + budget tracking
CREATE TABLE dune_budget (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz DEFAULT now(),
  query_id text NOT NULL,
  execution_id text,
  credits_used int NOT NULL,
  caller text CHECK (caller IN ('cron','vtx','manual')),
  user_id uuid,
  cache_hit boolean DEFAULT false,
  fallback_used text,
  error text
);
CREATE INDEX ON dune_budget(occurred_at DESC);
CREATE INDEX ON dune_budget(user_id, occurred_at DESC);

-- Materialized snapshots — one table per long-lived query
CREATE TABLE dune_holder_concentration (
  chain text, token_address text, token_symbol text,
  top10_pct numeric, top100_pct numeric, gini numeric,
  nakamoto_coefficient int, updated_at timestamptz,
  PRIMARY KEY (chain, token_address)
);

CREATE TABLE dune_smart_money_score (
  wallet text PRIMARY KEY,
  score int, tier text,                -- S / A / B
  pnl_90d numeric, win_rate numeric,
  total_trades int, updated_at timestamptz
);

CREATE TABLE dune_cluster_aggregates (
  cluster_id uuid PRIMARY KEY,
  member_count int, total_aum_usd numeric,
  dominant_label text, dominant_token_pct numeric,
  updated_at timestamptz
);

CREATE TABLE dune_bridge_flows (
  source_chain text, dest_chain text,
  window_hours int,
  net_usd numeric, top_token text,
  updated_at timestamptz,
  PRIMARY KEY (source_chain, dest_chain, window_hours)
);

CREATE TABLE dune_wash_trade_score (
  chain text, token_address text,
  wash_pct_24h numeric, updated_at timestamptz,
  PRIMARY KEY (chain, token_address)
);

CREATE TABLE dune_deployer_history (
  chain text, deployer_address text,
  tokens_deployed int, rugs_detected int,
  abandoned int, active int,
  trust_score int, band text,
  updated_at timestamptz,
  PRIMARY KEY (chain, deployer_address)
);

-- Extend existing wallet_edges with Dune-sourced edge types
ALTER TABLE wallet_edges
  ADD COLUMN IF NOT EXISTS source text,  -- 'whale_activity' | 'dune_funding' | 'dune_cex_codeposit' | 'dune_tc_probable' | 'dune_behavioral'
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS dune_query_id text;

-- VTX alert subscriptions backed by Dune queries
CREATE TABLE dune_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  condition_json jsonb NOT NULL,        -- { query_id, params, threshold }
  channel text CHECK (channel IN ('push','telegram','email','discord')),
  last_fired_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON dune_alerts(user_id);
```

### 5.4 First 7 materialized queries (Analyst plan, ~2,400 cr/mo)

| Query topic | Refresh | Credits/day | Use in UI |
|---|---|---|---|
| Holder concentration (top tokens) | 24h | ~10 | Trading terminal panel |
| Token-age buyer cohorts | 24h | ~10 | Trading terminal "first buyers" |
| Whale 90d trading stats | 24h | ~10 | Whale tracker leaderboard |
| Cluster aggregate holdings | 24h | ~10 | Network graph side panel |
| Deployer history backfill | 7d | ~1 | Security panel deployer band |
| Smart-money inflow (top 200 tokens) | 6h | ~40 | Context feed cards + VTX |
| Bridge flows (last 24h, per chain pair) | 12h | ~20 | Context feed bridge cards |

### 5.5 VTX agent — all 17 Dune-powered tools

**Ship in priority order.** Top 5 first (single-month sprint), the rest
P2 to P3 as Analyst plan credits allow.

**Tier 1 (must-have, ship first):**

1. `dune_smart_money_inflow(token, hours)` → "27 smart-money wallets
   bought $X in 24h, net +$340K, top wallet 0xabc ($48K)" —
   single highest-leverage tool
2. `dune_holder_concentration(token)` → top-10 / top-100 %, Gini,
   Nakamoto coefficient
3. `dune_whale_pnl(address, 30d)` → FIFO realized + unrealized,
   win rate, total trades, best/worst
4. `dune_token_age_buyers(token)` → first 100 buyers still holding %,
   diamond-hand identification
5. `dune_sandwich_risk(token, size)` → pre-trade warning using
   historical sandwich rate on this pool

**Tier 2 (ship as Analyst budget allows):**

6. `dune_compare_tokens([...])` → multi-token side-by-side (volume,
   holders, smart-money flow, performance, concentration)
7. `dune_bridge_flows(chain, 24h)` → cross-chain capital movement
   (net inflow / outflow, top origin chains, top tokens bridged)
8. `dune_cex_flow(token, 24h)` → net CEX inflow / outflow per
   exchange (Binance / Coinbase / OKX)
9. `dune_label_address(addr)` → Dune label propagation
   (Wintermute, Jump, etc., with confidence + related addresses)
10. `dune_find_wallets_like(ref)` → behavioral similarity score
    (cluster-mates, copy-traders, sybils)
11. `dune_cluster_of(addr)` → reads our `wallet_edges` + Dune labels
    to return cluster_id, member_count, total_aum, dominant_label
12. `dune_top_traders(token, by=pnl|volume, lookback=30d)` →
    token-specific leaderboard
13. `dune_new_token_scanner(min_smart_buys=3, max_age_hours=24)` →
    discovery feed of new tokens with smart-money buys
14. `dune_mev_loss_report(addr, 30d)` → "you lost $X to sandwiches"
    per-user retrospective
15. `dune_stablecoin_pulse(USDT|USDC|all, hours)` → mint/burn velocity
16. `dune_insider_check(token)` → deployer + first-funded wallets
    pattern check
17. `dune_alert_subscribe(condition)` → VTX-initiated alerts on Dune
    thresholds (cron-scheduled recurring check)

### 5.6 Dune use surfaces — every feature, every enhancement

**Verbatim from the audit. Every bullet ships its own panel / card /
widget.**

#### On Whale Tracker (6 enhancements)

- Accumulator vs Distributor classification (30d net flow from
  `dex.trades` + `erc20.transfers`)
- Whale PnL leaderboards with cohort tiers (S / A / B)
- Cross-chain whale identity (bridge sender → receiver matching
  via `bridges.transfers`)
- First-mover detection (first 100 buyers of any token, ordered by
  `block_time` ASC)
- Whale → whale funding graph (direct sends between tracked whales)
- Position-size-of-portfolio % (conviction: what % of wallet's
  deployed capital sits in this single position)

#### On Trading Terminal (7 enhancements)

- Holder concentration panel (Dune-computed top-10/top-100, gini,
  Nakamoto — replaces GoPlus snapshot which is point-in-time only)
- Smart-money net flow per token (15-min refresh, mini-chart overlay
  on price chart as green/red histogram)
- Holder cohort bands (diamond-hand %: <1d, 1-7d, 7-30d, 30d+, 1y+)
- Wash trading score (% of 24h volume flagged as wash via circular
  A→B→A patterns + same-wallet self-trades + MEV-adjacent)
- LP provider health (LP add/remove flow last 7d, IL exposure)
- First-buyer performance ("72/100 first buyers still hold,
  avg +840%")
- Whales-holding-this-token list (mini-list of platform-tracked
  whales with positions)

#### On Context Feed (8 card types)

- Bridge flow alerts (ETH → Base / Arbitrum surges)
- Smart-money rotation cards (tokens ≥10 smart wallets bought in
  last 4h that they didn't own in prior 7d)
- Stablecoin mint/burn pulse (largest hourly mint bursts)
- CEX reserve drains (net token outflow from CEX clusters)
- New-launch + smart-money-buy intersection (tokens <24h old where
  ≥3 smart-money wallets bought >$5K)
- MEV / sandwich alerts (top-sandwiched tokens by victim count)
- Insider wallet activity (project treasury / team wallet moves)
- Funding-rate divergence (perp OI vs spot volume >3σ apart)

#### On Network Graph / Wallet Cluster (7 enhancements)

- Funding-graph edges (currently empty `wallet_clusters` — fix
  the cron persistence in P0 #2, then enrich via Dune backfill)
- Common-deposit heuristic (CEX co-clustering: wallets depositing
  to the same CEX address share an owner)
- Multi-sig / Safe linkage (Safe owners → their EOAs)
- Behavioral clustering (k-means on activity vectors: hour-of-day
  distribution, gas tip pattern, slippage tolerance, DEX preference)
- Tornado Cash demixing adjacency (same-amount, time-windowed
  pairs flagged with probability)
- Sybil detection for airdrop farmers (wallets with >0.85
  behavioral similarity within 7-day windows)
- Cross-cluster Sankey flows (cluster-to-cluster USD aggregated
  over 7d)

#### On Swap UI (8 enhancements)

- Pre-trade sandwich risk score (live, scored 0-100 with action
  recommendation)
- Honeypot pre-check (sell-success ratio on this pool from
  `dex.trades` — block if < 2%)
- Optimal route comparison vs historical `dex_aggregator.trades`
  ("1inch beat Jupiter on this pair 73% of last 1000 trades")
- Smart-money last-hour direction (pre-confirm banner: "Smart
  money net SELLING this hour (-$420K). Reconsider?")
- Slippage recommendation from pool history (P50/P90 historical
  slippage for this pool size at this hour)
- Liquidity cliff warning (top LP holds X% of pool — rug risk
  if they exit)
- Observed buy/sell tax from on-chain trades (vs metadata claims
  — catches deceptive contracts)
- Post-trade "you bought alongside X smart-money wallets" via
  Sim API (live, ±5 block window)

### 5.7 Caching strategy (the only viable path on Analyst plan)

| Refresh cadence | Use for | Daily credit cost |
|---|---|---|
| Daily 1× (materialized) | Holder concentration, token-age buyers, whale stats, cluster aggregates, deployer history, protocol revenue, wash-trade score, wallet age | ~80 cr/day × 30d = **2,400 / mo** |
| Hourly | Smart-money inflow, CEX flows, bridge flows, liquidity depth, sandwich risk, stablecoin pulse | ~240 cr/day × 30d = **7,200 / mo** |
| On-demand (VTX user calls) | Per-wallet PnL, transaction history, ad-hoc queries | Budget **4,000 cr/mo**, hard-cap 3/user/day |
| Sim API (separate budget) | Live wallet feeds, balances, recent activity, watchlist webhooks | Separate key + pricing, ~10K compute units/day estimate |

**Analyst budget total**: ~13,600 / 25,000 = **54% utilization**.
Headroom 46% for development + spikes. Hard upgrade trigger to
Plus ($799/mo, 250k credits): sustained >20k credits/mo or DAU
>500.

### 5.8 Failure handling

Tier ladder:

1. **Stale cache** — serve last `dune_cache` row even if `expires_at`
   passed. Response header `X-Data-Freshness: stale-{age_minutes}m`
   + UI badge "Last updated Xh ago"
2. **Switch upstream** — DEX/price → CoinGecko or Birdeye; holders →
   Alchemy `getTokenBalances` / Helius; smart-money → Birdeye
   `wallet/trade_history`; bridge flows → deBridge / LI.FI API
3. **Hide widget** — conditionally render `<DataUnavailable
   reason="rate-limited" eta="resets in Nd Nh" />` — never zero
   numbers, never mock data
4. **Alert ops** — Slack/Discord webhook + write `system_alerts`
   row when degradation tier ≥ 2

### 5.6 Failure handling

Stale cache → Birdeye / CoinGecko / Alchemy fallback → hide widget →
alert ops. **Never return mock data** (owner rule). Add a
`X-Data-Freshness: stale-{age_minutes}m` response header when
serving expired cache.

### 5.9 The single biggest latency bottleneck (per copy-trade audit)

`getAllRoutes()` in `lib/services/swap-aggregator.ts:87-112` fires three
aggregator HTTP calls with `fetchWithRetry(timeoutMs=8000, retries=2)`.

- **One slow aggregator** = 16s timeout × 3 = **~24s worst case**
- **Happy path** = ~6-8s
- This is on the critical path of **EVERY copy-trade execution**

**Fix sequence (this IS the P1-A branch above, restated explicitly):**

1. **Pre-warm quotes on whale-tx detection** → Redis cache with 15-30s
   TTL keyed by `(token, chain, usd_amount)`. Cache populated from the
   `alchemy-whale` / `helius-whale` webhooks the moment whale activity
   is detected, before any user looks at the copy.
2. **Reduce per-aggregator timeout**: 8s → **3s**
3. **Fire all 3 in parallel, return first successful** (not
   `allSettled + sort`). Fallback: cached / indicative quote from
   static pool TVL estimate when all three time out.
4. **Quote re-validation at user-confirm time, not execution path**
   — relayer inserts `pending_trades` with cached quote immediately;
   browser refetches a fresh quote in the ~2-5s the user spends
   reading the confirm screen.

**Result**: worst case **~24s → ~3s**, average **~8s → ~500ms**.

### 5.10 Sim by Dune (separate product, separate API key)

`api.sim.dune.com` — realtime wallet APIs (balances, txs, activity,
positions) across 60+ chains, ~200ms post-block latency. Use for:

- Live wallet pages
- Watchlist webhook subscriptions for whale alerts
- Portfolio view ETH↔SOL aggregation
- Post-trade "you bought alongside…" notifications

Separate billing (compute units, not credits). Get a key when
wallet pages need sub-block freshness.

---

## §6 MCPs required + how to use

### 6.1 Supabase MCP

`mcp__claude_ai_Supabase__*` — full access to the `phvewrldcdxupsnakddx`
project. Use for:

- `list_tables` before any schema change
- `get_advisors` + `get_logs` before debugging Supabase issues
- `list_migrations` to confirm what's deployed
- `execute_sql` for read queries (verify data) and writes for
  one-off backfills (owner-authorized only)
- `apply_migration` for schema changes — careful: writes directly to
  the remote project

**RLS gotchas** (from memory):
- `whales.label` not `whale_address` for label-by-address
- `price_alerts.price` not `target_price`
- `user_wallets_v2` is JSONB
- `profiles` SELECT policy is `profiles_select_own` — no public
  read. `/u/[username]` for OTHER users requires service-role API
  routes, not direct client queries.

### 6.2 Vercel MCP

`mcp__vercel__*` — deployment / log access. Use for:

- `list_teams` first — if empty, you cannot do prod verification
  from this environment and must hand spot-checks to the owner
- `get_runtime_logs` when debugging prod-only issues
- `get_deployment` after a merge to confirm build success

**Known limitation**: team scope was empty for the entire P0
session. Owner can rotate the MCP token to fix it.

### 6.3 GitHub (no MCP needed — git + `gh` CLI)

`gh` CLI is **not installed** in the dev shell. Use `git push` and
let the response output give you the "Create PR" URL; the owner
opens the PR via that link. Do not attempt to open PRs via API
unless explicitly asked.

---

## §7 Honest verification debt

### 7.1 Open from P0 (this session)

All 4 P0 branches pushed but **none are production-verified**.

| Branch | Verification needed |
|---|---|
| `fix/market-resolve-chain-leak` | Search "SOL" / "XRP" from Market page, check URL |
| `feat/cluster-cron-and-holder-panel` | Cron run + populated cluster tables + holder panel on token page |
| `feat/whale-tracker-grade` | PnL leaderboard renders, badges show, convergence badge fires |
| `feat/swap-routes-mev-orders-pi` | RouteComparison shows, MEV pill, Advanced Orders, Solana priceImpact |

Per Rule 1.6: next session must NOT mark these "verified" without
either the owner confirming or Vercel MCP coming back online and
the URLs being checked.

### 7.2 Older verification debt (from Session S handoff and earlier)

- Naka-safe sweep (em-dash strip across remaining surfaces)
- Tablet 768px audit
- `prefers-reduced-motion` audit
- Trust Score cleanup
- Whale PnL server-side backfill cron health-check

---

## §8 Schema gotchas reminder

From memory (this carries forward across sessions):

- `whales.label` — display name, NOT entity_type
- `whales.entity_type` — one of cex / mm / smart_money / bot / insider / bridge / mev / whale
- `whales.pnl_30d_usd`, `whales.win_rate`, `whales.avg_hold_hours`
  populated by the nightly `whale-backfill-pnl` cron
- `price_alerts.price` — target price column (not `target_price`)
- `user_wallets_v2` — JSONB, not relational
- `profiles` SELECT RLS = own-only
- `social_follows` keyed on `(follower_id, following_id)` with
  `status` IN ('pending','accepted')
- `wallet_edges` populated; `wallet_clusters` was 0 rows until
  P0 #2 ships
- `smart_money_convergence` populated; UI didn't read it until
  P0 #4 ships
- `whale_activity` ~54K rows (live, ingested by
  `whale-activity-poll` cron)
- `feature_usage` ~ small but growing (used for the activity_score
  component of `user_reputation`)

---

## §9 NAKA env vars (from earlier sessions)

These should already be set in Vercel. Confirm via project settings:

```
NEXT_PUBLIC_NAKA_TOKEN_ADDRESS=0x6967b9a8c0b14849CFE8f9E5732B401433fD2898
NAKA_CULT_THRESHOLD=1227000
TURNSTILE_SITE_KEY=…             # Cloudflare site key
TURNSTILE_SECRET_KEY=…           # Cloudflare secret
NEXT_PUBLIC_TURNSTILE_BYPASS=0   # set to 1 only during a Cloudflare outage
LIFI_API_KEY=…                   # set this session
ALCHEMY_API_KEY=…
HELIUS_API_KEY=…
COINGECKO_API_KEY=…
GOPLUS_API_KEY=…
FLASHBOTS_PROTECT_RPC=https://rpc.flashbots.net
BLOXROUTE_BSC_URL=https://api.blxrbdn.com
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
# Dune (when ready):
DUNE_API_KEY=…
DUNE_PLAN=analyst  # or 'free' / 'plus' / 'premium'
SIM_API_KEY=…       # only when Sim is wired
```

---

## §10 Founder context (from auto-memory)

- Founder: Phantomfcalls / Seyifunmi (Omojuni Oluwaseyifunmi),
  email `Phantomfcalls@gmail.com`
- Brand: Naka Labs, NakaCult tier-gated inner ring
- Tone: casual, picture-perfect bar, MEVX / Nansen-grade
- WCAG AAA contrast minimums
- Industry-standard everywhere; "10/10 quality"
- Picture-perfect UX before functionality where they conflict at
  user-visible surfaces
- Founder repeatedly burned by surface-level patches that didn't
  fix root causes — every fix needs evidence (file:line + agent
  report) and prod verification

---

## §11 What "done" means at the end of a session

End-of-session report MUST include:

1. **Each item with status**:
   - ✅ "Fixed and verified in production" — only if Rule 1.6 fully met
   - ⚠️ "Fixed but pending production verification"
   - ❌ "Could not fix — [specific reason + what's needed]"
2. **Branches pushed** with their commit hashes
3. **Discovered during work** — bugs / opportunities found mid-task
4. **Next steps for owner** — what they need to do (merge, env var,
   spot-check, etc)

Never claim a fix without evidence. Hand back honesty over hopium.

---

## §12 Quick-reference: what NOT to do

- ❌ Don't write `Co-Authored-By: Claude`
- ❌ Don't add `🤖 Generated with Claude Code`
- ❌ Don't commit to `main`
- ❌ Don't `--amend` an existing commit
- ❌ Don't ship mock data, demo data, hardcoded test values
- ❌ Don't summarize multi-section prompts; extract every sub-bullet
- ❌ Don't open 10 micro-branches; bundle into 3–5 phase-branches
- ❌ Don't claim "fixed" without prod verification
- ❌ Don't use `--no-verify` or skip hooks
- ❌ Don't run destructive operations without confirmation
- ❌ Don't write documentation files (`*.md`) unless the owner asks
- ❌ Don't use emojis in code unless the owner asks
- ❌ Don't trust subagent claims blindly — verify the file:line they cite

---

End of kickoff. Begin Phase P1-A unless the owner directs otherwise.
