# Whale Tracker — Ingestion & USD Enrichment Status

_Verified against the live DB (project `phvewrldcdxupsnakddx`) and the actual
cron source, not stale migrations. Corrects several false positives from the
40-agent audit (`AUDIT-2026-06-24-22agent.md`)._

## Ground truth (live DB)

| Metric | Value |
| --- | --- |
| `whale_activity` rows | 53,929 |
| rows with `value_usd` populated | 0 |
| latest `timestamp` / `created_at` | 2026-05-13 19:30 UTC |

Ingestion **and** pricing have produced nothing since 2026-05-13.

## Root cause — the real blocker (operational, needs owner action)

The Vercel cron **scheduler itself is dead** since 2026-05-13 — every cron, not
just the whale ones, stopped at the same timestamp. No code change can restart
it. Check, in order:

1. **`CRONS_PAUSED`** env var — if `true`, every cron exits at the auth gate
   (`app/api/cron/_shared.ts`). Set to `false` (or unset).
2. **`CRON_SECRET`** — must be set and identical in Vercel + local. Missing →
   every dispatch 500s.
3. **Vercel plan cron ceiling** — `vercel.json` registers 5 dispatcher routes
   (`/api/cron/dispatch/{frequent,half-hourly,hourly,six-hourly,daily}`), which
   is well under the Pro limit, so this is unlikely but worth confirming the
   project is on a plan with cron enabled and the deployment is the production
   one.

**Verify the fix:** after redeploy, the newest `cron_execution_log` row should
be within ~30 min of now (not 2026-05-13).

## Demand gating (by design, not a bug)

`whale-activity-poll` and `whale-activity-price` only process whales that appear
in `user_whale_follows`. With zero follows they intentionally no-op to avoid
spending Alchemy / Birdeye / CoinGecko budget on whales nobody tracks. So even
once the scheduler is alive, ingestion is driven by real follows.

## Code fix shipped this session

`whale-activity-poll` now prices `value_usd` **at insert time** via
`priceActivityUsd()` (Birdeye by contract → CoinGecko by native symbol) instead
of inserting `null` and waiting on the backfill cron. `priceActivityUsd` caches
per token for 60s, so a poll run makes ~one network call per distinct token, not
per transfer — safe inside the 60s `maxDuration`. Unpriceable tokens stay
`null` and are retried by `whale-activity-price`. **No value is ever
fabricated** — null when a real price can't be sourced.

## Audit claims that are FALSE POSITIVES (verified)

- **"whale-backfill-pnl writes a non-existent `pnl_5d_usd` column."** It does
  not. The update payload writes only `pnl_30d_usd`, `pnl_7d_usd`, `win_rate`,
  `trade_count_30d`, `last_active_at`, `avg_hold_hours`, `archetype`,
  `portfolio_value_usd`, `updated_at` — all of which exist in `whales`. No edit
  needed.
- **"backfill swallows errors and logs success anyway."** It already reports
  `failed` when every UPDATE errors (`errors.length > 0 && applied === 0`).

## Not done on purpose

- **No `transfer_in → buy` / `transfer_out → sell` remap.** A bare transfer is
  not a buy/sell (could be self-custody moves or exchange deposits). Relabelling
  would fabricate trade semantics. If the feed's size/action filters need to
  match transfers, fix the feed to handle `transfer_in/out`, do not fake the
  action.
- **No bulk backfill of the 53,929 historic NULL rows.** That would price data
  for unfollowed whales, defeating the demand gate. They get priced on demand
  once someone follows the whale and the scheduler is live.

## Remaining (owner / future)

1. Restart the cron scheduler (env + redeploy) — **the unblock**.
2. Optional: add Solana ingestion (Helius `getAssetTransfers`) to
   `whale-activity-poll`, which is currently Ethereum-only.
3. Audit the leaderboard `pnl_*` seed values separately if any seeded rows still
   carry formulaic placeholders; the backfill cron will overwrite them with real
   FIFO numbers once it runs.
