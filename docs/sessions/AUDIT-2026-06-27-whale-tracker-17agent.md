I have all the findings I need. This is a synthesis task — the auditors already did the code-reading and DB verification. Let me produce the consolidated executive report.

# Whale / Copy-Trade / Smart-Money Subsystem — Lead Auditor Executive Report

**Scope:** 16 specialist audits + 1 free-API research pass across whale ingestion, pricing, alerts, copy-trade, feed APIs, schema, and tier-gating. DB ground truth verified live against project `phvewrldcdxupsnakddx`.

**One-line verdict:** The entire whale/copy-trade product is dark in production. Not degraded — dark. Every user-facing surface (feed, top-today, copy-trades, follow alerts) returns empty because the single upstream pipeline died 45 days ago, and a recent "dispatcher" refactor now paints that outage **green**. Nothing downstream can work until ingestion + pricing are restored.

---

## Executive Summary — The 5 Most Urgent P0s

### P0-1 — Platform-wide cron death on 2026-05-13; the outage is now masked as "success"
*(Ingestion audit #1, #2; Price audit #1)*

Every non-dispatcher cron's last log row is **2026-05-13 ~19:30–19:34 UTC**, simultaneously, across unrelated cron groups (`whale-activity-poll`, `price-cache-refresh`, `security-monitor`, `whale-backfill-pnl`, `sniper-enrich-security`). A simultaneous stop across unrelated groups is not a feature bug — it is the **Vercel scheduler going dark** (CRON_SECRET removed → `_shared.ts:24-37` returns a silent 500 before any logging, OR a Pro→Hobby plan downgrade capping crons at 2, OR crons disabled in dashboard).

**Worse:** since the dispatcher refactor (commit `c07a395`, 2026-06-26), `dispatch-half-hourly` logs `status=success, items_processed=11` every 30 min while **zero downstream handlers actually execute**. The dispatcher self-fetches `${proto}://${host}/api/cron/${name}` (`dispatch/[group]/route.ts:83`) with only `Bearer CRON_SECRET` and **no** `x-vercel-protection-bypass` header, so the call hits a Vercel Deployment-Protection challenge page that returns 200 — counted as success (`line 105`). `whale-activity-poll` calls `logCronExecution` on **both** its skip and success paths, yet has **zero** log rows — proof the real handler never ran. The original silent outage is now actively re-greened, which is more dangerous than the outage itself.

**Fix:**
1. In Vercel: confirm plan allows the cron count, `CRON_SECRET` is present in Production and matches the dispatcher, and Settings→Crons shows the 5 `vercel.json` entries Enabled with recent timestamps.
2. Fix the self-fetch: either disable Deployment Protection on the prod domain, OR send `x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}` + `x-vercel-set-bypass-cookie: true` on `dispatch/[group]/route.ts:83`.
3. **Harden against re-greening:** treat a *missing downstream `cron_execution_log` row within the tick* as a failure. A 2xx HTTP status from a redirected/SSO route must never count as work done. Have each handler return a JSON marker the dispatcher asserts on.

### P0-2 — `value_usd` is NULL on 100% of 53,929 rows → every feed renders empty
*(Price audit #1, #2; Feed audit #1; Ingestion #3)*

The pricer (`whale-activity-price`) has **never executed once** — `cron_execution_log` has 0 rows for it, ever (it logs on every code path, so absence = never ran). Ingest writes null/0 by design (`whale-activity-poll/route.ts:100` `value_usd:null`; webhooks insert `0`). The feed hard-filters `.gte("value_usd", minUsd)` (`feed/route.ts:91`), and in Postgres `NULL >= 100000` evaluates to NULL → **every row excluded, at every threshold including the 10k floor.** Count returns 0; pagination is 0. This single filter is why the whole feature looks broken.

Even when revived, the pricer is **demand-gated** to the 4 followed whales (`whale-activity-price/route.ts:33-45`), so the 53.9k backlog is permanently stranded.

**Fix:**
1. **Stop hard-gating on a 100%-NULL column.** Short-term: `.or('value_usd.gte.'+minUsd+',value_usd.is.null')` so historical rows render, plus a stale-data banner.
2. **Price at ingest:** call `priceActivityUsd()` inside the poll loop and webhooks *before* upsert (amount is already human-readable — 160 ETH, not wei — so `amount*price` is correct with no decimals work). Dedupe via the existing 60s `priceCache`.
3. **One-time backlog backfill** (un-gated, paged by id): pricing is per *distinct token* — 1,270 token_addresses + ~12 natives, **not** 53,929 rows. Birdeye `getMultiTokenPrices` (100/call) clears it in <50 calls. Bulk `UPDATE ... FROM (VALUES ...)` keyed on token+chain. Skip `amount<=0` rows (never fabricate).

### P0-3 — No whale-follow alert dispatcher exists at all; the push helper is broken against live schema
*(Alert audit #1, #2)*

There is **no** code that reads new `whale_activity` rows → joins `user_whale_follows`/`whale_watchlist` → fans out. `sendWhaleAlert` (`resend.ts:157`) has **zero callers** — dead code. The watchlist API faithfully persists `alert_enabled`/`alert_threshold_usd`/`alert_channels` and the DB even has a `last_alerted_at` debounce column — the consumer side was simply never built. 4 follows, all `alert_enabled=true`, **0 alerts ever dispatched.**

Compounding it: `sendPushToUser` (`webpush.ts:116-142`) queries columns that **don't exist** on live `push_subscriptions` (`subscription`, `is_active`) and logs to `push_delivery_log` with wrong columns — every call throws. Confirmed: 0 push subs, 0 delivery logs, has never run successfully.

**Fix:** Build `app/api/cron/whale-alert-monitor/route.ts` (2-min cadence): SELECT `whale_activity` past a watermark row (not `created_at` — that's block time), join follows via `addressNormalize`, filter `alert_enabled AND value_usd >= threshold AND last_alerted_at < now()-15min`, fan out, stamp `last_alerted_at`. Rewrite `sendPushToUser` against the real schema (`endpoint,p256dh,auth` → `{endpoint,keys:{p256dh,auth}}`; log to `subscription_id/title/status/status_code/error_msg`). **Gate the threshold to treat NULL value_usd as "unknown, send anyway"** or it drops everything until P0-2 lands.

### P0-4 — Copy-trade engine has no live data source; fires zero trades
*(Copy-trade audit #1, #2)*

The monitor queries `whale_activity WHERE action IN ('buy','sell','swap')` (`copy-trade-monitor/route.ts:90`). Live data is **100% `action='transfer_out'`** — not a single buy/sell/swap row exists, ever. So the query returns 0 on every tick. The architecture is complete and well-built (rules, tiering, relayer, idempotency) but `user_copy_trades` has 0 rows because nothing upstream ever produces an actionable event. Additionally `pct_of_whale` sizing computes `value_usd * pct = 0` (value_usd NULL) → hits the `sizeUsd<=0` guard → blocks every buy even once flow resumes.

**Fix:** This is **downstream of P0-1/P0-2** — cannot work until `whale_activity` receives fresh, priced buy/sell/swap rows. Then verify `classifyAction` emits buy/sell, and in `matcher.ts:185` fall back to `max_per_trade_usd` when `value_usd` is null instead of producing 0.

### P0-5 — Ingestion can never discover a new whale, and multi-chain/multi-action was never live
*(Free-API research #1; Ingestion #4)*

The poll cron only SELECTs from the existing 449-row `whales` table (`whale-activity-poll/route.ts:224-231`), polls each via `alchemy_getAssetTransfers(fromAddress=address)`, and writes only what that whale **sent** → by construction, the only possible output is `ethereum` + `transfer_out`. It **cannot find a new whale** — the seed list went cold and nothing replenishes it. The Alchemy/Helius webhooks (which would produce buy/sell/transfer_in across base/bsc/arbitrum/solana) were **never registered with the providers** — only doc-comment instructions exist, and zero non-ethereum rows confirm no webhook has ever delivered.

**Fix:** Two-stage architecture. **Stage A (new): a discovery cron** that pulls "who is trading big now" from a firehose (Bitquery / Birdeye top-traders / DexScreener) and UPSERTs into `whales`. **Stage B (exists): per-whale activity** — register the webhooks (Alchemy ADDRESS_ACTIVITY per EVM network + signing keys; Helius enhancedTransaction + secret) and switch EVM whales from stalest-first polling to push webhooks. See the API plan below.

---

## Findings by Area (deduped)

### A. Whale-Activity Ingestion Pipeline
- **P0** — Cron death + dispatcher false-success → *see P0-1.*
- **P0** — value_usd NULL + dead/demand-gated pricer → *see P0-2.*
- **P1** — **Single narrow writer:** poll cron queries `whales WHERE chain='ethereum'` with `fromAddress` only → ethereum+transfer_out by construction. Webhooks never registered. *(→ P0-5.)*
- **P1** — **Demand-gated to 4 follows:** even fully healthy, only ~3 active ethereum whales get polled (one follow is `is_active=false`), capped at `limit(25)`. The 449-whale directory will show almost nothing. **Decide product intent** and either broaden via webhooks or make the near-empty state explicit in UI.
- **P2** — `.toLowerCase()` on addresses in poll cron (`:91,102`) and alchemy webhook (`:104-156`) — violates CLAUDE.md. Route through `normalizeAddress(addr, chain)`. Helius path correctly uses case-sensitive Sets.

### B. Pricing (`whale-activity-price` + `priceActivity.ts`)
- **P0** — Never executed / no ingest-time pricing → *see P0-2.*
- **P1** — **Followed-only gate strands the backlog:** 2 of the 4 followed addresses have zero activity; realistically ~564 eligible rows, capped 200/pass, ordered desc → old rows never reached. Cap by *distinct token* (1,270), not follower count.
- **P1** — **CoinGecko fallback covers only ~12 native symbols.** 18,419 rows have NULL `token_address`; any whose symbol isn't in `NATIVE_CG` stays unpriced. Public CoinGecko endpoint, no key, no 429 backoff → backfill bursts silently return null. **Fix:** derive native asset from *chain* not symbol; move to keyed `pro-api` with `COINGECKO_API_KEY`; batch via Birdeye `getMultiTokenPrices`. (Research seconds this — GeckoTerminal `/networks/{net}/tokens/{addr}` is free, no key, as primary pricer.)
- **P2** — Two chained `.or()` blocks are correctly AND-combined by supabase-js but fragile; add a comment. Don't reuse the tick handler for backlog — run a dedicated id-ascending backfill (concrete plan in Price audit #6).

### C. Alert Dispatcher
- **P0** — No evaluator exists; `sendPushToUser` broken vs live schema → *see P0-3.*
- **P1** — **Two incompatible fan-out stacks:** `fanOutNotification` (in-app/Discord/SMS/email, **no telegram, no push**) vs `POST /api/notifications` (in-app/telegram/email, **no push/Discord/SMS**). They read *different* preference tables (`user_notification_channels` 0 rows vs `notification_settings` 13 rows). Pick **one** `dispatchNotification()` honoring `notification_settings` as the single source of truth.
- **P1** — `sendWhaleAlert` renders `$${amountUsd/1e6}M` → with NULL value_usd produces `$NaNM`/`$0.00M` emails (fabricated-data violation). Guard or delete; don't ship USD whale emails until pricing is fixed.
- **P1** — Immediate telegram path (`/api/notifications`) **bypasses quiet hours** and reads a different prefs table than the digest → 3am pushes. Consolidate gating into `sendTelegramNotification`.
- **P2** — alchemy webhook lowercases addresses with no Solana guard; dispatcher join must use `addressNormalize`.

### D. Copy-Trade Full Stack
- **P0** — No live data source (transfer_out only) → *see P0-4.*
- **P0** — `value_usd=0/NULL` breaks `pct_of_whale` sizing → *see P0-4.*
- **P1** — **One-click execute API has zero frontend callers.** `/api/copy-trading/execute` is fully built (tier gate, idempotency, GoPlus, relayer) but no `.tsx` POSTs to it. The "one-click copy" button does not exist. Add a Copy action on whale feed/[address] rows.
- **P1** — **alerts_only Telegram deep-link is dead:** `matcher.ts:233` builds `/dashboard/copy-trading?action=&token=&tx=` but `page.tsx` never reads the params (only the tab). Combined with the missing execute button, an alerts_only user literally cannot act. Add `useSearchParams` → confirm modal → POST execute.
- **P1** — **Monitor and matcher are drifted duplicates** of the same fan-out: monitor reads `user_whale_follows` then joins rules (so a rule without a follow never fires via cron); matcher reads `user_copy_rules` directly. Monitor lacks cooldown, pct_of_whale, min_liquidity, and address normalization. Refactor cron to call `matcher.matchCopyEvent()` — single source of truth.
- **P1** — **Daily-cap is racy across 3 paths** (cron/matcher/execute) — each reads `sum(amount_usd)` in app code with no lock. Real overspend vector. Enforce atomically via a Postgres function/trigger or `SELECT ... FOR UPDATE` on a budget row.
- **P1** — `.toLowerCase()` on addresses in execute (`:139`) and monitor (`:85-180`) — Solana-unsafe. `matcher.ts` already does it right via `normalizeAddress`. (Logged in `TECHNICAL_DEBT.md:105`.)
- **P2** — `copy_trades` is an orphan (0 rows, 0 refs; legacy schema). Drop it.
- **P2** — Manual execute ignores `rule.mode`/`rule.paused` — a paused/alerts_only rule can still execute if `enabled=true`. Add `if (rule.paused) return 403` and make intent explicit.
- **P2** — Amount-precision regression: cron (`:239`) and matcher (`:278`) still `String(sizeUsd)`, re-introducing the bug `execute` already fixed with `.toFixed(6)`.

### E. Feed / Top-Today / Watchlist / SSE
- **P0** — Size filter excludes 100% of rows → *see P0-2.*
- **P0** — **top-today permanently empty:** 24h window (0 rows in 24h) + NULL volume summed as 0. Don't present a $0-volume ranking as real — rank by `move_count` or show explicit stale state.
- **P1** — `.toLowerCase()` in feed (`:146,158`) and top-today (`:39,73,79`) breaks the whales-metadata join for Solana whales. Use `normalizeAddress`.
- **P1** — **Label filter breaks pagination:** JS-filtered *after* `.range()`, `total` set to post-filter page count → wrong page math, early-stopping infinite scroll. Paginate in-memory over the full filtered set, or precompute `whale_label` as a real column.
- **P1** — **SSE polls a 15s-cached endpoint every 5s** (2/3 ticks waste), re-runs the full tier gate + Supabase hit per tick, unbounded `seen` Set. Align `TICK_MS≥15s` or query Supabase directly; cap `seen`; long-term use the realtime publication (`whale_activity` is already in it).
- **P2** — Buy/Sell/multi-chain pills return empty by data shape (100% transfer_out/ethereum). Hide pills or show "no data yet" until ingestion classifies real swaps.
- **P2** — `FeedRow` type omits the pnl/win_rate/avg_hold fields it actually returns; add them.
- **P2** — watchlist write doesn't normalize address → `0xAbC` vs `0xabc` create duplicate `onConflict` rows; `copy_mode` hardcoded to `'alerts'` on every upsert.
- **P2** — Silent 403 (tier) vs 200-empty (working) vs 200-error are indistinguishable client-side; branch on status + SSE error event.

### F. Schema Duplication (graveyard cleanup)
- **P0** — `whale_activity`: 41 MB, 53,929 rows, dead pipeline → *root cause is P0-1/P0-2. Do NOT drop (prod reads it).*
- **P1** — **11 pure orphans** (0 rows AND 0 code refs): `copy_trades, whale_wallets, whale_transactions, whale_tracking, smart_money_follows, smart_money_rankings, entity_cache, dune_smart_money_score, dune_smart_money_token_flow` (+ verify `whale_addresses`, `smart_money_wallets`). Drop in one migration mirrored to `supabase/migrations/`.
- **P1** — **4 parallel follow tables:** standardize on `user_whale_follows` (4 rows, live). Migrate the 2 moneyRadar paths off `followed_entities`; drop it + `smart_money_follows`. Keep `social_follows` (different domain).
- **P1** — **3 parallel smart-money sources:** repoint `cluster-detection.ts:124` and `wallet-clusters/route.ts:130` at `whales` (currently seed from an *empty* `smart_money_wallets` → latent functional bug), then drop `smart_money_wallets` + `smart_money_rankings`.
- **P2** — `whale_watchlist` (`supabase.ts`) is a 2nd watchlist overlapping `user_whale_follows` — migrate + drop. Fold `whale_addresses` labels into `whales.label`.
- **Keep set:** `whales, whale_activity, user_whale_follows, user_copy_trades, user_copy_rules, whale_submissions, social_follows, wallet_identities, smart_money_convergence`. Add a regression note in `docs/cleanup-2026-05/audit-findings.md` so future audits stop re-flagging dropped tables.

### G. Tier-Gating
- **P1** — **Dead-controls UX / sold-but-blocked:** pricing sells "Whale tracker (view only)" as **Mini ($5)** and every data API is gated `'mini'`, but `whale-tracker/layout.tsx` hard-gates the **entire page at `'pro'`**. A paying Mini user gets a blurred upgrade wall for the feature they bought. **Fix:** drop the page-level `pro` gate to `mini` (matching the APIs and the pricing promise), and gate only the Pro-only sub-features (watchlist/copy) individually.

---

## Recommended Fix Order (critical path)

1. **P0-1** Restore Vercel crons + fix dispatcher false-success (nothing works until this lands).
2. **P0-2** Price at ingest + un-gated backlog backfill + remove the NULL-excluding feed filter.
3. **P0-5** Stand up Stage-A discovery + register Stage-B webhooks (gives buy/sell/multi-chain rows).
4. **P0-3** Build `whale-alert-monitor` + fix `sendPushToUser`.
5. **P0-4** Copy-trade revives automatically once 2–3 land; then fix `pct_of_whale` fallback, one-click button, deep-link, daily-cap race.
6. P1/P2 schema cleanup + address-normalization sweep + tier-gate fix in parallel.

---

## Ranked Free Whale-Data API Adoption Plan

Two-stage model matching the existing webhook+cron split. **All free-tier figures verified June 2026.** Add keys to `.env.example` + Vercel; remove the dead `ARKHAM_API_KEY`.

| # | API | Stage / Job | Free tier | Key status | Verdict |
|---|-----|-------------|-----------|-----------|---------|
| 1 | **Bitquery** (GraphQL + gRPC streams) | **A — cross-chain discovery** (firehose DEXTrades > $USD threshold → UPSERT `whales`); also activity | 10k points/mo, 10 rows/req, 10 req/min, 2 test streams | add `BITQUERY_API_KEY` | **Top pick.** One vendor for discovery across eth/sol/base/arb/bsc. Watch the points cap — page narrowly; upgrade for production firehose. |
| 2 | **Alchemy Address Activity Webhooks** | **B — EVM activity (push)** | 30M CU/mo, webhooks included; PAYG $0.45/M | **already have** key + signing keys + receiver | **Highest leverage, zero new vendor.** Replace stalest-first polling; on new EVM whale, call update-webhook-addresses (50k/webhook). |
| 3 | **Helius** Enhanced Tx Webhooks | **B — Solana activity (push)** | 1M credits/mo, 1 webhook | **already have** key + secret | Keep as-is. Consolidate all Solana whales into the single free webhook. |
| 4 | **DexScreener** | A — free token discovery seed | No key; 60–300 req/min | wired (`dexscreener.ts`) | Pull trending/boosted tokens → resolve top buyers via Bitquery/Birdeye. No wallet-level data alone. |
| 5 | **GeckoTerminal / CoinGecko onchain** | **Pricing — fixes value_usd** | No key, 30/min (public) | `COINGECKO_API_KEY` present | **Required regardless of discovery choice.** Primary pricer in `priceActivity.ts` keyed on token_address+chain behind Upstash cache. |
| 6 | **Birdeye** top-traders | A — Solana discovery complement | Thin free/Standard tier | `BIRDEYE_API_KEY` present, `birdeye.ts` exists | Best Solana discovery; run hourly + cached. Also `getMultiTokenPrices` for backlog batching. |
| 7 | **Moralis** | Enrichment — backfill `pnl_30d_usd`/`win_rate` (200+ whales missing) | 40k CU/day | add `MORALIS_API_KEY` | Nightly enrichment pass feeding whale-score-populator/backfill-pnl. |
| 8 | **GoldRush (Covalent)** | One-shot multichain history backfill on newly-discovered whales | 100k credits/mo; x402 pay-per-req | add `GOLDRUSH_API_KEY` | Cache hard, not for realtime. |
| 9–14 | Cielo (curated, paid), Etherscan v2 (EVM fallback), Mobula, Zerion (holdings/PnL), Whale Alert (>$10M flows), Solscan (Solana fallback) | Situational | varies | — | Adopt only if a specific gap remains. **DeBank: no free tier, skip.** |

**Net recommendation:** Bitquery (discovery) + already-owned Alchemy/Helius webhooks (activity) + GeckoTerminal (pricing) closes all three structural gaps — new-whale discovery, multi-chain/multi-action coverage, and value_usd — at near-zero incremental cost. Everything else is enrichment.