# Naka Labs — Master Remaining-Work TODO (2026-06-24)

Source of truth: the 16-agent deep audit (`docs/sessions/AUDIT-2026-06-23-deep-audit.md`), expanded into
every actionable remaining task. A second **22-agent deep audit** (whale tracker, Dune, market, swap/trading,
discovery, DMs, profile/settings/filters, Naka wallet) is running and will append deeper findings on completion.

**Legend:** `[ ]` todo · `[~]` partial · `[x]` done · **P0** financial/trust · **P1** broken core · **P2** missing · **P3** polish

---

## ✅ Already shipped (do not redo)

- [x] **Phase 1** quick-wins — recharts install, `/dashboard/settings` redirect, Customise enum, admin token key,
  NIPPO removal, cult/vault decouple, Transactions back button, iOS search zoom, domain `nakalabs.com→.xyz`,
  FollowButton inversion. (merged + on branch `feat/ui-phase2-nav-appearance`)
- [x] **§11** Palette unified to W brand `#0066FF` — 1,524 occurrences migrated, `tokens.ts` is now source of truth. (`55232cd`)
- [x] **§16** One theme system — deleted dead `ThemeToggle`/`useTheme`; appearance prefs preserved across account switch. (`6aaef19`)
- [x] **§14/§15** Header lifted into `dashboard/layout`; appearance reachable via Profile + settings redirect.

---

## Phase 2 — design system + nav + appearance (REMAINING)

- [ ] **§12 · P3 — Migrate chrome offenders to UI primitives + add a guard.**
  - `components/ui` primitives exist (GlassPanel, IconChip, Toggle, Button, BackButton). Migrate the top
    re-derivers: 6 card defs, the `bg-white/[0.03] border border-white/10` card pattern, 28 hand-rolled toggles.
  - Add an eslint rule / tailwind safelist guard so new inline-hex card/toggle chrome can't reappear.
  - Delete dead CSS left behind. **Needs visual QA** (light + dark) before claiming done.
- [ ] **§13 · P1 — Light-mode surface tokens (real bug).**
  - `app/globals.css` hand-maintains `[data-theme="light"] .bg-[#XXXX]{}` overrides keyed to exact inline-hex
    strings → any new/differently-cased inline hex stays dark in light mode.
  - Define `--surface-base/elev/card`, `--border-subtle` vars that flip under `[data-theme="light"]`; migrate
    dark-hardcoded surfaces (`#0A0E1A`, `#111827`, `#0D1117`, slate-900/950) to the tokens. **Needs light-mode QA.**
- [ ] **§17 · P2 — One i18n path + persist language.**
  - Two systems coexist (`i18n.ts` + `lib/i18n/*`), neither persists per-user. Pick next-intl; wire the language
    switch to a persisted `user_display_preferences.language` (see SQL §E); drop the dead path.

---

## Phase 3 — social / discovery / messaging / follow

- [ ] **§18 · P1 — Fix `recompute-reputation` cron.** `user_reputation` has 1 row (last computed 2026-05-20) →
  nightly cron not running. Set CRON_SECRET, confirm schedule in `vercel.json`, add admin "run now" + health check.
- [ ] **§19 · P1 — Leaderboards real + gated.** 4/8 boards empty or show one user at "100%". Gate boards on sample
  size (hide vs "No data yet"); build one materialized leaderboard view + `/_all` batch endpoint; unify
  `formatMetric`; fix whale-watchers semantics.
- [ ] **§20 · P1 — Username migration.** Dedupe `Puffnutz`/`puffnutz`; `CREATE UNIQUE INDEX … (lower(username))`;
  fix lookup + the `>1 row` error mapping (api/social/profile/[username] ~31-37); mirror check in ProfileTab.
- [ ] **§21 · P2 — OAuth handles + identity badges.** Auto-generate handle in `handle_new_user`; backfill 5 NULL
  usernames; add tier badge to `SearchBox`; fix `mini` gray color; ship a shared `<IdentityBadges>`.
- [ ] **§22 · P1 — Follow graph hydration.** Return relationship (`i_follow`) in search/leaderboard payloads;
  real optimistic rollback; denormalize follower/following counts via trigger; add "Follows you".
- [ ] **§23 · P0 — DM key stability.** Wrap-key = SHA-256(access token) rotates ~hourly → history orphaned. Move
  to passkey / wallet-signature-derived wrap key; non-extractable IndexedDB; no silent regenerate; safety-number banner.
- [ ] **§24 · P1 — DM flow.** Recipient picker/compose (`/api/social/dm/recipients`; MessageButton on every graph
  row); read receipts + unread badge; `realtime.setAuth` + optimistic echo; batched conversation list.

---

## Phase 4 — trading / swap / walletconnect trust spine (HIGHEST STAKES)

- [ ] **§25 · P0 — Fix swap/fee schema drift.** `swap_logs`/`fee_revenue` inserts use nonexistent columns → both
  tables 0 rows, 0.4% fee never recorded, errors swallowed. One shared TS type imported by reader + every writer;
  stop swallowing insert errors; verify rows land. (SQL §A)
- [ ] **§26 · P0 — Quote == execution (EVM).** Use 0x `/swap` + approval/Permit2; hide multi-route UI until
  adapters return real calldata.
- [ ] **§27 · P1 — Wire Solana end-to-end.** Solana branch in `/api/swap/quote`; symbol→mint map.
- [ ] **§28 · P0 — Real MEV or remove the claim.** `mevProtect` is theater (broadcasts to public mempool while
  claiming private). Integrate Flashbots/MEV-Blocker/Jito, OR remove the claim + the ≥$1k auto-enable.
- [ ] **§29 · P0 — Honest confirmation.** Poll receipt before `confirmed` (swap sets confirmed on hash return).
  Honest USD/impact/gas; RPC redundancy + nonce mgmt for the builtin wallet.
- [ ] **§30 · P1 — Terminal Buy/Sell on the real engine.** `InlineBuySellForm` returns unsigned tx + fake
  "Bought/Sold". Reuse the swap engine (base-unit amounts, real broadcast, real tape, debounced quote).
- [ ] **§31 · P1 — Create `/api/swap/execute` (or shared `lib/trading/executeClientSwap.ts`).** Every inline
  "Confirm Swap" (SwapCard, useSwapExecution) 404s today. Fix SwapCard quote params + amount input + `tokenAddress`;
  inline connect; emit `swapCard` from VTX chat.
- [ ] **§32 · P1/P0 — View-Proof real.** Remove fake "AI Intelligence Analysis" (hardcoded ternaries); persist
  Endorse poll + real engagement; per-chain explorer links; replace embedded bubblemap with a real holder-risk
  strip; deep-link via `?id=`.
- [ ] **§33 · P1 — One wallet layer.** Collapse 4 wallet systems to one AppKit layer + one `useWallet()` + one
  `<ConnectWalletButton/>`; replace all entry points; ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set + documented.

---

## Phase 5 — admin / transactions / wallet / data + SQL

- [ ] **§34 · P0 — Unify admin auth.** httpOnly session + `admin_roles` middleware, deny-by-default, seed roles,
  shared fetch helper; delete legacy admin root; fix `/api/analytics/admin` opt-in (public-exposure) auth.
- [ ] **§35 · P1 — Settings route on real columns.** Rewrite against real `platform_settings` columns; consolidate
  to one flag system; app reads `maintenance_mode`/`registration_open`. (SQL §F)
- [ ] **§36 · P1 — Admin broadcast + treasury + dashboard.** Real broadcast targeting/counts/dry-run; real treasury
  (wallets + price feed + USDC balance, currently `balance_usd` null); real dashboard aggregation; verify
  `admin_audit_log` insert columns.
- [ ] **§37 · P1 — Rebuild Transactions page.** On `/api/wallet/transactions` (Etherscan v2 + Helius) + `transactions`
  table overlay; fix the swap write path to populate `transactions`.
- [ ] **§38 · P1 — Wallet holdings real.** Merge `multiChainBalances` into holdings; optimistic custom-token rows;
  cloud-sync toggles; fix `.toLowerCase()` address bug (use `addressNormalize.ts` — Solana case-sensitive).
- [ ] **§39 · P1 — Provision-or-hide Dune; kill fabricated numbers.** Create the 7 Dune tables + crons OR hide
  DuneFeedCards behind a has-data check; create `bookmarks` table; remove fabricated Solana `valueUsd`, synthetic
  timestamps, `trustScore`→"VERIFIED" relabel; wire-or-delete SSE; durable archive; fix React key.
- [ ] **§40 · P1 — Whale activity data.** Backfill `whale_activity.value_usd` (priced at block time) across ~53,929
  rows; populate `counterparty_label`; classify `action`; PnL/win-rate backfill; Solana holdings indexer.

---

## Consolidated Supabase SQL / schema worklist

> Mirror every migration into `supabase/migrations/`. Verify column existence against the LIVE DB first
> (`mcp__supabase__list_tables` / `execute_sql`) — migration files are stale.

- [ ] **§A — Swap/fee/tx logging (highest leverage).** One canonical `swap_logs` schema
  (`token_in,token_out,amount_in,amount_out,fee_usd,dex,status,tx_hash,created_at,user_id`); fix all writers/readers
  + shared TS type; verify `fee_revenue` columns; INSERT into rich `transactions` (RLS `user_id = auth.uid()`).
- [ ] **§B — Profile identity.** Dedupe Puffnutz; `CREATE UNIQUE INDEX profiles_username_lower_key ON profiles (lower(username))`;
  drop old case-sensitive unique; `handle_new_user` auto-handle when NULL; backfill 5 NULL rows.
- [ ] **§C — Follow counts.** `ALTER profiles ADD followers_count int DEFAULT 0, following_count int DEFAULT 0`
  + AFTER INSERT/DELETE/UPDATE trigger on `social_follows` counting `status='accepted'`.
- [ ] **§D — Context feed.** `bookmarks(user_id,event_id,created_at, PK(user_id,event_id))` + own-rows RLS; optional
  durable `context_feed_events`; create the 7 missing Dune tables + crons OR hide; populate/remove `smart_money_convergence`.
- [ ] **§E — Appearance/settings.** `ALTER user_display_preferences ADD theme/accent/glass_intensity/density/text_size/reduced_motion/language`
  + RLS `user_id=auth.uid()`; wire `.language` to i18n; consider consolidating the 5+ `*_preferences` tables.
- [ ] **§F — Admin.** Seed `admin_roles` (≥1 super_admin); rewrite settings + treasury routes against the real
  columnar `platform_settings` singleton; verify `admin_audit_log` columns (two impls insert different sets → silent fail).
- [ ] **§G — Messaging.** `dm_participants(conversation_id,user_id,sealed_conversation_key,last_read_at,archived,muted, PK(...))`
  + indexes; `ALTER dm_conversations ADD is_group,title`; rewrite RLS to membership via `EXISTS(dm_participants …)`.
- [ ] **§H — Discovery/reputation.** Precomputed leaderboard materialized view keyed by `(kind,rank)` with
  denormalized profile fields + `metric_value` + resolved `i_follow`, refreshed by the fixed cron; confirm/remove
  `social_top_followers` RPC.
- [ ] **§I — Whale tracker.** Backfill `whale_activity.value_usd` across ~53,929 rows; populate `counterparty_label`;
  classify `action`; PnL/win-rate backfill on `whales`; verify `sniper_executions.executed_at`.
- [ ] **§J — RLS verification.** Confirm RLS on `watchlist`, `user_whale_follows`/`user_copy_rules`, `swap_logs`
  (`auth.uid()=user_id`), `user_*_preferences` before trusting upserts.

---

## Also tracked (from session-G handoff, still open)

- [ ] **9 stub crons** burning Vercel credits (alert-monitor, fear-greed-index, smart-money-ranking, cluster-analysis,
  network-metrics, trends-aggregator, narrative-detection, context-feed-poll, whale-ranking-refresh) — implement or remove.
- [ ] **Sniper `security_score: null`** gap — criteria with `min_security_score>0` never match; add GoPlus enrich pass.
- [ ] **28 Dependabot vulns** on default branch (7 high) — triage.
- [ ] **Phase F (Chosen exclusives)** — Oracle next-day-seal write, Sanctum playlist curation, dashboard Chosen badge.
