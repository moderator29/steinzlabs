# Cron Cost Audit + Demand-Gating (2026-06-25)

Goal: make the cron fleet **cheap-when-idle and demand-scaled** so the upcoming
~3-week / ~100-user test runs responsively without spiking Vercel invocations or
paid-API (Alchemy / Helius / CoinGecko / 0x / GoPlus / Arkham / Dune) usage.
Every claim verified against live Supabase `phvewrldcdxupsnakddx`.

## Headline finding
Almost every cron is **already cheap-when-idle** — the user-feature monitors
(copy-trade, sniper x3, limit-order, stop-loss, dca, alerts) short-circuit on
zero active rows, and the cult/intelligence/reputation crons are DB-only or
env-gated. With the platform near-empty they make **~0 paid external calls**.

The entire bill risk is **3 whale crons** that ran on the *seeded* whale set
(209 active ETH whales) regardless of demand, while only a handful are actually
followed:

| cron | before (idle, unpaused) | root cause |
|---|---|---|
| whale-activity-price | **~57,600 CoinGecko/Dex calls/day** | priced a 53,929-row unpriced backlog for whales nobody follows |
| whale-activity-poll | **~21,600 Alchemy calls/day** | polled 15 of 209 seeded whales every minute |
| whale-backfill-pnl | **~384 Arkham calls/day** | backfilled PnL for all active seeded whales |

## Fixes applied (this branch)
**Demand gates — cost now scales with real follows, not the seed.** Added a
shared `getFollowedWhaleAddresses()` + `ilikeAnyFilter()` to
`app/api/cron/_shared.ts`. The 3 whale crons now:
- skip entirely when **no whale is followed** (zero cost), and
- otherwise scope their work to **followed whales only** (case-insensitive
  match, since `whales.address` is checksum-cased).
So at 100 users following N whales, cost is proportional to N (not 209), and the
53k unpriced backlog of un-followed whales is never touched.

`security-monitor` now short-circuits via `cronHasWork("watchlist")` (no GoPlus
calls when the watchlist is empty).

**Cadence right-sizing (`vercel.json`)** — only the *unconditional* feeds were
trimmed; money/trader crons stay responsive:
| cron | before | after | why |
|---|---|---|---|
| whale-activity-poll | `* * * * *` | `*/2 * * * *` | scoped to followed + capped 25/tick |
| sniper-enrich-security | `*/2` | `*/3` | aligns near sniper-monitor (5m) |
| pumpfun-velocity-poll | `*/2` | `*/10` | discovery feed, no per-user demand |
| biz-mention-scrape | `*/15` | `*/30` | 4chan scrape, no per-user demand |
| funding-rates-snapshot | `0 * * * *` | `0 */2 * * *` | slow-moving |
| publish-scheduled-research | `*/5` | `*/10` | DB flip only |

**Kept responsive for the test** (guarded → 0 cost when idle, low-latency when
active): copy-trade-monitor `*/1`, sniper-auto-execute `*/1`, sniper-autosell
`*/1`, alert-monitor `*/5`, limit/stop-loss `*/5`, whale-activity-price `*/5`
(now scoped), price-cache-refresh `*/30`, health-watch `*/15`.

## Estimated cost after fixes (100-user test, ~50 whales followed)
- whale-activity-poll: `*/2` × min(50,25)/tick ≈ **18k Alchemy/day max**, only for followed whales (was 21.6k for random seeded whales).
- whale-activity-price: `*/5`, scoped to followed-whale activity only — a few hundred/day instead of 57.6k (the backlog is no longer scanned).
- whale-backfill-pnl: scoped + `*/30` — tens/day instead of 384.
- All feature monitors: scale with real usage (0 when unused).

## Safe to unpause
With these fixes, flipping `CRONS_PAUSED=false` is safe: idle features cost ~0,
and the whale baseline is bounded by **actual follows**, not the seed. The
demand gates auto-scale as the 100 testers use the platform.

> Owner action: set `CRONS_PAUSED=false` (or delete the var) in Vercel →
> steinzlabs → Settings → Env Vars → Redeploy. Then watch the first few hours of
> `cron_execution_log` + Vercel usage; if any single cron is hotter than
> expected, trim its cadence one notch.

## Follow-ups (not blocking unpause)
- One-time: prune or archive the 53,929-row `whale_activity` unpriced backlog so
  it never accumulates again (now harmless — it isn't scanned — but tidy).
- The unconditional data feeds (market-stats, watchlist-refresh, price-cache)
  have no per-user demand row; if cost is still a concern, gate them behind a
  lightweight "feature has active viewers" signal.
