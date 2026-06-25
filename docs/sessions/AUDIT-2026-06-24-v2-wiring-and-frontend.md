# Naka Labs — Consolidated Wiring & Frontend Audit v2 (Synthesizer)

**Date:** 2026-06-24 · **Live project:** `phvewrldcdxupsnakddx` · **Auditors merged:** 27 · **Scope:** dead filters/toggles, notification wiring, frontend gaps vs. 2030 best-in-class, small bugs.

> Root causes from the prior 20-agent audit (frozen cron fleet / CRONS_PAUSED, undeployed Dune tier, broken trade-recording, schema drift, fabricated data, fractured admin auth) are treated as **known**. This v2 goes one layer deeper and is grounded in **live-DB verification** (see "Live-DB Ground Truth" below), which overturns several auditor P0 claims.

---

## Executive Summary

The platform's **data plane is dark**: live-DB row counts are `swap_logs=0`, `fee_revenue=0`, `notifications=0`, `push_subscriptions=0`, `wallet_clusters=0`. Almost every "notification doesn't fire / stat is fake / leaderboard is empty" finding traces back to this, plus four genuinely **missing tables** (`composite_alerts`, `alert_templates`, `user_notification_channels`, `proof_votes`).

The biggest *new* (non-root-cause) findings:

- **Notification delivery is structurally incomplete, not just frozen.** Even with crons running, there is **no whale-follow alert evaluator at all**, `fanOutNotification()` has **no Telegram branch**, alert crons **ignore per-event toggles and quiet hours**, and `user_notification_channels` (Discord/SMS routing) **doesn't exist** — so Discord/SMS/Telegram silently no-op for every user.
- **Slippage is dead end-to-end on Swap.** The user's slippage setting never reaches the quote (`/api/swap/price`, `/api/swap/quote`, `/api/swap/routes` all omit it); 0x applies a hardcoded 50 bps regardless of the UI. This is a **money-correctness** bug, not cosmetics.
- **Several P0 "missing migration" claims are STALE.** `sniper_criteria` already has all 10 "missing" columns; `notification_settings` already has `email_enabled/telegram_enabled/quiet_hours_*`. The real defects are **schema-detection logic** (`hasExtendedSchema`) and **unverified round-trips**, not DDL.
- **Two parallel, disconnected implementations** exist for both **alerts** (`/app/alerts` DB-backed vs `/app/dashboard/alerts` localStorage-only) and **notifications/settings** (localStorage vs Supabase, never reconciled on mount). Multi-device users silently lose state.
- **Admin panel is half-broken by schema drift + a session-key typo:** `/api/admin/settings` reads/writes non-existent `key/enabled` columns on the singleton `platform_settings` (should be `feature_flags` JSONB), and `cron-monitor`/`feature-flags` pages read `admin_bearer` while the layout stores `admin_token`.
- **Two CRITICAL trading-math bugs** silently corrupt amounts: Jupiter `outAmount` parsed without decimal scaling, and 0x `buyAmount` divided by a hardcoded `1e18` (wrong for USDC/USDT 6-decimals → off by 1e12).

### Live-DB Ground Truth (verified this run — overrides auditor assumptions)

| Claim under audit | Auditor said | Live DB (verified) | Verdict |
|---|---|---|---|
| `sniper_criteria` missing paused/slippage/TP/SL/mev/etc. | P0 "10+ missing columns" | **All present** (paused, max_slippage_bps, mev_protect, take_profit_pct, stop_loss_pct, trailing_stop_pct, wallet_addresses, auto_sell_on_target, expiry_hours, etc.) | **STALE — downgrade.** Bug is round-trip verification, not DDL |
| `notification_settings` quiet-hours/email/telegram columns | "pending — apply migration" | **All present** (email_enabled, telegram_enabled, quiet_hours_enabled/start/end/timezone) | **STALE — fix `hasExtendedSchema` detection** |
| `composite_alerts`, `alert_templates` | not deployed | `NULL` (do not exist) | **CONFIRMED P0** |
| `user_notification_channels` | does not exist | `NULL` | **CONFIRMED P1** |
| `proof_votes` | no table | `NULL` | **CONFIRMED** |
| `push_subscriptions.is_active` | missing | column absent; table has 0 rows | **CONFIRMED** |
| `platform_settings` key/enabled cols | wrong schema | singleton w/ `feature_flags` JSONB, no key/enabled | **CONFIRMED P0** |
| `price_alerts.notify_email` | missing | absent | **CONFIRMED** |
| swap_logs / fee_revenue / notifications / push_subs / wallet_clusters | empty/dark | **0 rows each** | **CONFIRMED — platform dark** |

---

## 1. Dead Filters / Toggles / Pills (per surface, with state)

| Surface | Control | Current behavior | Fix |
|---|---|---|---|
| Whale Tracker — Directory | **"Top Losers" (pnl_30d_asc)** | API never consults `SORT_ASCENDING`; always sorts DESC → returns top gainers | Honor ascending flag in `.order()` (whales/directory:44-45) |
| Whale Tracker — Directory | **Timeframe 24h/7d/30d/all** | Param sent, never used; metrics hardcoded to 30d | Add timeframe windowing or hide non-30d pills |
| Whale Tracker — Directory | **Entity facet counts** | Counts are global, ignore chain/search/score filters → dishonest | Apply same filters to facet query |
| Whale Tracker — Feed | **Label pills (Smart Money/CEX/Bot/MM/Insider/Bridge)** | Filter applied *after* fetch; total count wrong | Push `.eq('entity_type')` into SQL; return filtered+total counts |
| Whale Tracker — Feed | **"New rows available"** | Counts ALL activity, not just followed whales; SIZE_MIN duplicated → drift | Filter by watchlist; extract `SIZE_MIN` to shared const |
| Sniper | **Pause toggle** | Was claimed dead (missing column) — **column exists**; verify optimistic state persists across refresh | Confirm round-trip; add rollback on error |
| Sniper | **Execution stat card** | Ignores `chainFilter` → shows all chains | Apply chainFilter to stat cards |
| Copy Trading | **min_liquidity_usd, cooldown_until, require_confirmation, wallet_address, chains_allowed, tokens_blacklist** | Stored/PATCHable but never read in execution; not in UI modal | Implement checks OR remove from schema/API; add Advanced section to modal |
| Wallet | **"By Change" sort** | Identical to "By Value" | Sort by 24h price-change % (data already in `prices`) |
| Wallet | **"recent" sort option** | No-ops (only value/alpha/change handled) | Implement or remove |
| Wallet | **Hide Small Balances tooltip** | Backwards ("Showing all" when hiding) | Swap tooltip text |
| Wallet | **chainFilter / assetSearch / hideBalance** | Not persisted to localStorage (unlike tokenSort) | Persist + restore |
| Wallet | **Chain pills (7) vs LIVE_CHAINS (5)** | Filtering to Fantom/Cronos fetches nothing | Sync pills to LIVE_CHAINS |
| Wallet | **Buy button** | `() => {}` no-op, no flag/roadmap | Route to fiat-buy waitlist or remove |
| Market | **Sortable table headers** | Static; sort only via FiltersModal | Make headers clickable w/ arrows |
| Market | **Watchlist star** | Race on rapid toggle; no debounce/loading; optimistic not rolled back | Debounce + loading + rollback |
| Market | **"Majors" pill** | Live-computed but 5s cache lag breaks "live" guarantee | Reduce cache TTL or add "refreshed Xs ago" |
| Market | **FiltersModal Reset** | No confirmation/auto-close | Toast + checkmark |
| Context Feed | **"News" / "New Coins" pills** | `FILTER_TYPE_MAP` maps to types fetchers never emit → empty feed | Audit emitted types; fix map |
| Context Feed | **"info" pill** | Client-side post-fetch filter on 200 rows (wasteful) | Server-side filter or remove |
| Context Feed | **Engagement (views/shares/likes)** | Mock zeros, never persisted | Wire to engagement table or remove |
| Clusters | **sort=members / risk_score** | Both delegate to `whale_score` (no post-query sort) | Implement real sort |
| Wallet Intel | **Contract chain selector** | All scans default to Ethereum | Route by chain or hide non-ETH pills |
| Clusters | **min_score filter** | Persists across "All" archetype, no indicator | Reset on "All" + show active-filter chips |
| Smart Money | **Alert filter tabs (whale/price/launch/wallet_activity)** | Hardcoded UI, no backend source | Wire to /api/alerts or remove |
| Alerts | **GET /api/alerts** | Filters `active=true` → can't view/manage paused alerts | Remove filter; return status for client tabs |
| Alerts | **active/paused toggle (/app/alerts)** | Local state only; no PATCH endpoint → lost on reload | Add PATCH; persist |
| Admin | **Sniper job pause/resume** | Local state only, no API call | Add POST action endpoint |
| Admin | **Settings category filters** | Client-only; backend doesn't support category | Align UX or document client-only |
| Portfolio | **Hide spam toggle** | Lost on refresh (component state) | Persist to localStorage |
| Portfolio | **Timeframe filter** | Client-only, never re-fetches backend | Add to useEffect deps + query param |
| Landing | **/docs/onboarding, /docs/social links** | 404 | Create routes or repoint |
| Telegram settings | **Disconnect/unlink** | Shows `alert()`, never unlinks | Add DELETE /api/telegram/unlink |

---

## 2. Notification / Alert Wiring Gaps

**Structural truth:** Even after CRONS_PAUSED is lifted, delivery is incomplete. Priority order:

- **P0 — Deploy missing notification tables.** `composite_alerts`, `alert_templates`, `user_notification_channels` do not exist in live DB. `/api/alerts/composite`, `alert-monitor` composite branch, and `fanOutNotification`'s Discord/SMS routing all silently degrade. (Migration `2026_05_21_notifications_depth.sql` exists but unapplied.)
- **P0 — Whale-follow alerts have NO evaluator.** `user_whale_follows` stores `alert_enabled/alert_threshold_usd/alert_channels` but no cron reads them. Build `/api/cron/whale-alert-monitor` (2-min cadence): scan new `whale_activity` since last tick → filter by threshold → `fanOutNotification` across `alert_channels`.
- **P1 — `fanOutNotification` has no Telegram branch.** Handles in-app/Discord/SMS/email only. Telegram must be added (gated on `notification_settings.telegram_enabled`, queued to `pending_telegram_messages` for durable retry).
- **P1 — Alert crons ignore toggles & quiet hours.** `alert-monitor` fires `price_alerts`/`composite_alerts` without checking `notification_settings` per-event flags (`whale_alerts/price_alerts/security_alerts`) or `quiet_hours_*`. Only `notification-digest` respects quiet hours. Centralize an `inQuietHours()` + channel-gate check before any non-in-app dispatch. **Note: quiet-hours columns already exist live** — no migration needed.
- **P1 — Price-alert email checkbox is cosmetic.** `notify_email` accepted by AlertModal/route but `price_alerts` has no such column; `fanOutNotification` keys email off `email_alerts_enabled` only. Remove per-alert `notify_email` and rely on settings, OR add the column.
- **P1 — Web push silently fails.** `push_subscriptions.is_active` queried/written but column absent (and table has 0 rows). `push_delivery_log` never written. Subscribe upsert uses non-existent `onConflict` composite → dup endpoints. Fix schema (add unique `(user_id, endpoint)`; choose flat vs JSONB storage), wrap delivery log in try/catch + Sentry.
- **P1 — Settings ↔ DB round-trip broken.** `app/settings/page.tsx` and `ProfileTab` load toggles from **localStorage only** and never read Supabase on mount → cross-device loss. `NotificationSettingsPanel` (the correct DB-backed component) is imported but **never rendered** in ProfileTab. Render it; remove duplicate localStorage toggles.
- **P1 — `hasExtendedSchema` falsely reports "pending".** Quiet-hours/email/telegram columns exist live, but unreliable 42703 detection makes the UI show "apply migration". Replace with a direct `information_schema.columns` check or probe one specific column.
- **P1 — Notification bell click is dead.** Cron sets `url` metadata but `NotificationBell` never navigates (`n.href` never set). Wire `onClick → router.push(n.url)`.
- **P1 — Swap completion never reaches Supabase/multi-channel.** `notifySwapCompleted` → localStorage only; no `fanOutNotification`. Add a server endpoint that fans out.
- **P1 — DM notify is fire-and-forget** (`.catch(()=>{})`), no delivery log/retry; depends on CRONS_PAUSED=false.
- **P2** — Social notification prefs (new_follower/dm/follow_request/mentioned) have an API but **no settings UI**. Retry cron and `notification-digest` don't re-check channel enablement before delivering. Quiet-hours timezone is free-text (no IANA validation). NULL quiet-hours minutes make `start <= end` silently always-false. Composite predicates other than `price` (whale_buy/velocity/market_cap/deployer_band) never evaluate → cold.
- **P2** — Dune cards / SSE polling / convergence badge / archive tab all lack loading/error/degraded-mode indicators; SSE silently falls back to 20s polling while UI still shows "Live".

---

## 3. Frontend Build Worklist (vs. Nansen / Arkham / GMGN / Photon / Phantom / DexScreener / Dune / Zerion)

See `frontendBuildTodos` for the prioritized, per-surface list. Highlights:

- **Wallet — missing core screens:** Receive (QR + copy-address) and Send (recipient/gas/security/confirmation) modals have state hooks but **no rendered component**; Activity/history tab unrendered; NFT gallery lacks floor price/value; no cross-chain NFT view. Watch-only/Solana-missing wallets can crash Send.
- **Notification surfaces — zero filter/sort:** Bell dropdown and full page have no type/read/unread filter or sort — below Nansen/Phantom/Zerion parity.
- **Copy Trading:** no PnL column (data exists), no rule edit page (delete+recreate only), table not responsive on mobile, no error/empty/loading states, blocked-reason strings shown raw.
- **DMs:** no read-receipt UI, no unread badges/counts, no recipient picker / "New message" entry, no peer avatar/name in thread header, no typing/presence, no media support, contrast failures on received bubbles.
- **Sniper:** no skeleton loaders, no "Snipe Now" from feed, no decision-status filter pills, no preset templates, no clone/bulk-edit, modal not mobile-responsive, no form-state recovery.
- **Portfolio:** export buttons missing (3 APIs exist), multi-wallet selector missing (hook supports it), allocation chart not responsive, no empty state for zero closed trades, Actions column not touch-friendly, Alpha Intelligence tab is a placeholder.
- **Global:** inconsistent loading states (spinner text vs skeleton); multiple WCAG-AA contrast failures (`text-gray-600`/`text-slate-500` on dark, `#2a3a60` on hero, blue chart labels); mobile horizontal-scroll affordances missing on category/chain pills and tables.
- **Landing:** hero card shows hardcoded dummy data; StatsSection has no skeleton; missing CSS vars (`--nl-text-secondary/tertiary`); SecurityShowcase/SocialSection CTAs missing/unverified; "10-card tour" claimed but unverified.

---

## 4. Bug List

See `bugs` array for the full flat list with file:line. The two **P0 money-correctness** bugs:

- **Jupiter `outAmount` not decimal-scaled** (`lib/services/swap.ts:105`) — `parseInt(quote.outAmount)` treats lamports as normalized; truncates all precision.
- **0x `buyAmount` hardcoded `/1e18`** (`lib/services/swap.ts:142`) — wrong for USDC/USDT (6 decimals) → off by 1e12; must use destination token decimals.

Other notable: Today's-PnL off-by-1000x time unit (`* 86_400` vs `* 86_400_000`, portfolio:242); `pnl_usd.toFixed()` on null → NaN (sniper-bot:875); FIFO realized-PnL off-by-one (`> 1e-12` guard, performance:157-171); leaderboard/discover `Link` rendered before null-username filter; recommendations 2nd-hop unbounded `.limit(500)` OOM risk; sniper-autosell passes number to NUMERIC (`String()` missing, :217) + hardcoded `'USDC'` literal (:215) + sell-side re-entry race; gas estimate wrong units (`execution.ts:58`); pending-trades confirm trusts client amounts unbounded; platform-fee constant inconsistent (20 vs 40 bps across 5 files); copy-trade daily-cap counts `alert` (intent) rows.

---

## Human-Gated Items (require product/business decision or destructive DDL)

These need a human before action (deploy DDL to live, money-flow consent, or schema-naming decisions):

- Apply `2026_05_21_notifications_depth.sql` (composite_alerts, alert_templates, user_notification_channels) to live DB.
- Unpause CRONS_PAUSED / force one tick to populate wallet_clusters, swap_logs, fee_revenue, notifications (root cause; ops).
- Add `push_subscriptions.is_active` (or refactor) + unique `(user_id, endpoint)`.
- Auto-copy / require_confirmation auto-confirmation (real-money consent UX).
- `featured_tokens` / `announcements` / `platform_settings` duplicate-column reconciliation (data migration).
- On-chain receipt verification before writing swap_logs/fee_revenue (anti-spoof).
- Email delivery path validation (`profiles.email` existence + end-to-end test).
- Backfill NULL quiet-hours minutes + add NOT NULL constraints.
- Wallet-intelligence multi-chain token-scanner expansion (Ethereum-only today).

---

## De-dup / Correction Notes

- "Sniper P0 schema migration" (sniper-wiring auditor) and "sniper paused toggle dead" — **DOWNGRADED**: columns exist live. Real work = verify round-trip + optimistic rollback.
- All "apply quiet-hours migration" / "schema pending" items (notifications-platform, settings, wallet auditors) — **MERGED & CORRECTED** to a single `hasExtendedSchema`-detection fix; no DDL.
- "swap_logs/fee_revenue use nonexistent columns → 0 rows" (docs-round2, fe-naka-wallet) merged with trade-recording root cause; tables exist, columns must be verified against insert path.
- The duplicate `user_notification_channels` / "notification settings UI missing" findings appear across 5 auditors — merged into §2.
- `fe-global-design` "test/x/y" finding is a placeholder stub — **discarded**.
- Slippage-dead-end appears 6× across swap-vtx auditor — merged into one P0 branch item.