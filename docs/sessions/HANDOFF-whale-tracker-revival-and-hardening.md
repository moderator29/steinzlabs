# Session Handoff — Whale Tracker revival + feed/DM hardening

**Branch:** `feat/whale-tracker-revival-and-feed-hardening` (cut from current `main`-merged HEAD; NOT merged — `nakalabs.xyz` runs `main`, so none of this is live until the owner merges). The harness assigned a `claude/...` branch name, which CLAUDE.md forbids, so a compliant `feat/...` branch was used instead.

All changes are `npx tsc --noEmit` + `npm run build` clean.

---

## TASK 1 — Whale Tracker (production outage) — FIXED

Root cause confirmed against the live DB (`phvewrldcdxupsnakddx`): commit `69fa655 "chore: demand-gate the whale crons"` scoped the poll + price crons to *followed* whales only. With ~4 follows, the poll polled almost nothing, so `whale_activity` ingestion stopped on **2026-05-13** (~45 days). Live DB at audit time: 53,929 rows, **0 with non-null `value_usd`**, **100% `transfer_out` on ethereum**, table absent from the realtime publication, `sendWhaleAlert` never called.

Fixes (fix order from the brief):

1. **Ingestion restored + price-at-ingest** (`app/api/cron/whale-activity-poll/route.ts`)
   - Dropped the follow gate; rotates through ALL active ethereum whales (least-recently-polled first, `WHALE_POLL_BATCH`, default 30/tick → full set ~every 7h at the 30-min cadence).
   - Polls **both** directions (`fromAddress` + `toAddress`) → real `transfer_in`/`transfer_out`, not 100% out.
   - Prices `value_usd` at ingest via `priceActivityUsdBatch` (dedupes per token). Only NEW `(tx_hash, whale, chain)` rows are priced (existence check) to bound API spend.
   - Uses `addressNormalize` (`addressesEqual`/`normalizeAddress`), not raw `.toLowerCase()`.
2. **Price backfill ungated + recency-bounded** (`app/api/cron/whale-activity-price/route.ts`)
   - Removed the follow gate. Bounded to the feed's visible window (8d). The multi-year backlog stays NULL on purpose — pricing it at *today's* prices would fabricate historical USD the feed never shows.
3. **Realtime publication** (migration `2026_whale_activity_realtime_and_alert_watermark.sql`, applied to live DB + mirrored)
   - `alter publication supabase_realtime add table whale_activity` → the page's `postgres_changes` INSERT subscription now fires.
   - Added `user_whale_follows.last_alerted_at` watermark + `idx_whale_activity_addr_chain_ts`.
4. **Alert dispatcher** (`app/api/cron/whale-alert-dispatcher/route.ts`, registered in the `frequent` dispatch group)
   - Joins each alert-enabled follow → priced activity past its watermark over its USD threshold → durable in-app notification + `sendWhaleAlert` email (when the `email` channel is selected). Forward-only watermark + cold-start lookback + per-follow fan-out cap.
5. **Wiring/tier/dead-code** (`app/dashboard/whale-tracker/page.tsx`, `app/api/whale-tracker/feed/route.ts`)
   - Tier-aware page (paywall below `mini`; Pro upsell + pricing redirect for `mini` instead of silent 403s on watch/add/bell).
   - Feed surfaces Received/Sent via a new `direction` field; fixed the realtime indicator comparing raw vs canonical action.
   - Removed orphans: `components/whales/WhaleCard.tsx`, `components/whales/LiveActivityFeed.tsx` + `useWhaleActivityStream` hook, `useWhaleTracker` hook.
   - Webhook price-at-ingest (`priceAndPersistWhaleRows` in `lib/whales/priceActivity.ts`).

**Data will populate once merged** — the crons only run on the deployed `main`. Nothing backfills the dead 45-day gap (correctly — we don't fabricate). Expect the feed to fill within the first poll cycles after merge.

---

## TASK 2 — Audit & harden last session's feed/DM features — DONE (high/critical items)

Two parallel audits ran; fixes shipped:

- **`lib/auth/apiAuth.ts` (P0, security)** — verified the `steinz_session` token via Supabase instead of trusting its unsigned payload (was a forged-token impersonation hole on every route).
- **AI Market Pulse (P0, cost)** — atomic DB claim-lock kills the Anthropic thundering herd; serve-stale on race/failure; empty feed never calls Anthropic.
- **Smart-money labels (P1)** — chain-correct normalization (Solana labeling was silently dead).
- **feed-alert-monitor (P1)** — anti-spam interval, trusted internal URL (not Host header), per-row error isolation, outage surfacing, chain-aware addresses, metric-aware thresholds.
- **security/route LP burn check (P1)** — guarded to 0x addresses (no Solana base58 folding).
- **DMs (P1)** — declined-request reads hidden; send failures surfaced.
- **Feed alerts** — added `PATCH` (the `active` toggle had no endpoint).

### Deliberately deferred (note for a follow-up)
- **DM E2E is effectively plaintext** — new conversations always store the `'plain'` sentinel because the client never seals keys. This is the intended "plaintext-first, X-style" product decision per the prior handoff; the encryption path only runs for pre-existing encrypted threads. Either restore key-sealing on conversation create or trim the E2E claims in the header/docs.
- **DM rate limiter** (`lib/social/rateLimit.ts`) is in-memory → not enforced across serverless instances. Move to Redis (`INCR`+TTL) for a real send cap.
- **feed alert count cap** (POST) is a check-then-insert race; enforce in the DB if it matters.
- **context-feed** has two scoring functions (`eventScore` vs `scoreEvent`) where the route's sort is overwritten — cleanup, not a bug. The `<5s` response cache still re-runs personalization — perf polish.
- **`/api/whale-activity/stream`** SSE route is now orphaned (the page uses `postgres_changes`); left in place as a working endpoint, safe to delete later.

---

## Reminder
**Merge `feat/whale-tracker-revival-and-feed-hardening` to `main`** to take any of this live (whale ingestion/realtime/alerts + the security/cost fixes). The owner opens the PR + merges; Vercel auto-deploys from `main`.
