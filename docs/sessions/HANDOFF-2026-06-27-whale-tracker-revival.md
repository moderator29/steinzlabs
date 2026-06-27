# Session Handoff — Whale Tracker revival (glass UI + dead-pipeline fixes)

**Branch:** `feat/whale-tracker-glass-upgrade` (NOT merged — `nakalabs.xyz` runs `main`, so nothing here is live until the owner merges).

## What shipped (all build-tested + pushed)

### Frontend — glass + blue-stride pass
- Directory/Submit/Live-Feed nav unified as compact `nl-btn-neon` stride pills; **"Submit"** (not "Submit whale"), sized to the PRO chip.
- Smart Money/CEX/Bot **label filter moved out of the title header** into the feed column as small rectangular (non-glass) chips.
- Side panels (My Whales, Top Today, PnL Leaderboard), Add-whale modal, directory whale cards + stat tiles → `nl-glass`.
- **Directory footer fixed**: followers / Follow / View each in its own fixed-height contained chip — Follow no longer overlaps View.
- Fixed `FollowWhaleModal` rendering **see-through** (panel had no background) → `nl-glass`. Off-brand blue→purple gradients replaced with brand neon-blue across the drawer, follow modal, submit form.

### Backend — the feed was functionally dead; root causes fixed
- **Cron dispatcher unblocked** (P0 root cause): the self-fetch was intercepted by Vercel Deployment Protection (200 OK SSO page) so every handler logged 2xx success while NONE ran — masking a 45-day platform-wide cron outage as green. Now sends `x-vercel-protection-bypass` (`VERCEL_AUTOMATION_BYPASS_SECRET`) and treats 2xx-non-JSON as a failure. **REQUIRES the env var to be set in Vercel Production** (see Ops below).
- **Ingestion restored**: removed the followed-only demand gate (only 4 follows existed), poll rotates stalest active whales across eth/base/arbitrum/optimism/polygon, **both directions**, **prices at ingest**.
- **DEX swaps classified into buy/sell/swap at ingest** (pairs same-tx opposite legs) — the keystone that feeds copy-trade and the Buy/Sell feed filter (data was 100% `transfer_out`).
- **Pricing**: GeckoTerminal (free, keyless, all chains) added as primary `value_usd` source ahead of CU-limited Birdeye; price cron gate removed so the whole backlog/all whales get priced.
- **Whale alert dispatcher built** (`whale-alert-monitor`, 2-min `frequent` group): follows → fresh priced activity → real-time bell + push + Telegram + email (wired `sendWhaleAlert`, previously dead code). Per-follow `last_alerted_at` dedupe.
- **Copy-trade unblocked**: engine (cron monitor + webhook matcher + relayer + pending-trades confirm + copy-trading page) was data-starved, not unbuilt. Fixed P0: the Follow modal never wrote `user_copy_rules.mode`, so the live cron skipped every rule as "off" — now mapped to `oneclick`/`auto_copy`.
- **PnL backfill ungated**: was limited to 4 followed whales → ~440 whales stuck at "—" for PnL/win-rate. Now walks all active whales in batches.
- **`sendPushToUser` rebuilt** against the live `push_subscriptions`/`push_delivery_log` schema (it threw on every call — wrong columns).

### Security
- **IDOR fixed**: `GET /api/notifications` trusted a client `?userId` and read it back with the service role (any user could read any user's notifications). Now derives the user from the session; per-user responses are `private, no-store`.
- Solana case-sensitivity: whale feed label join now uses `normalizeAddress` (was `.toLowerCase()`).

### Tier-gating
- Whale Tracker **view is now Mini** (matches pricing + the mini-gated APIs); the layout previously walled the whole page at Pro so paying Mini users hit an upgrade screen. Follow/alert/copy writes stay Pro+ at their APIs.

### Cleanup
- Deleted orphaned `components/whales/WhaleCard.tsx` + `LiveActivityFeed.tsx` (zero importers).

## OPS — required for any of the backend to actually run live
1. **Set `VERCEL_AUTOMATION_BYPASS_SECRET`** in Vercel Production env (Project → Settings → Deployment Protection → Protection Bypass for Automation) — without it the dispatcher still can't reach handlers. Alternatively disable Deployment Protection on the production domain.
2. Confirm `CRON_SECRET` is present in Production and the 5 `vercel.json` cron entries show recent runs.
3. For **instant** copy/alerts (vs the 2-min cron), register the **Alchemy + Helius address-activity webhooks** for the watched whale set (receivers already exist at `app/api/webhooks/{alchemy,helius}-whale`).
4. After deploy, hit `/api/cron/dispatch/half-hourly` with the bearer secret and confirm `whale-activity-poll` + `whale-activity-price` rows appear in `cron_execution_log`.

## Audit
- Full 17-agent report: `docs/sessions/AUDIT-2026-06-27-whale-tracker-17agent.md` (97 findings, 18 P0). Free whale-data API recommendations included (top picks: **Bitquery** cross-chain discovery, **Alchemy/Helius webhooks** for activity, **GeckoTerminal** for pricing, **Moralis/Mobula** for PnL enrichment).

## Still remaining (P1/P2 from the audit, not yet done)
- Schema consolidation: 11 orphaned zero-row tables (`copy_trades`, `whale_wallets`, etc.) + 4 parallel "follow" tables — pick one, drop the rest.
- `whale-score-populator` still depends on the (now-reviving) `whale_activity`; consider recomputing score from backfilled metrics instead.
- Mini-tier write controls still render then 403 silently — convert to locked/upsell chips.
- Directory "—" for CEX/exchange entities: PnL/win-rate is meaningless for custodial wallets; hide those tiles for `exchange`/`bridge` entity types instead of showing "—".
- SSE `whale-activity/stream` polls a 15s-cached endpoint every 5s with an unbounded `seen` set.
