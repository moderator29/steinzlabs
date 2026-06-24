# Naka Labs — Master Deep-Audit Report (2026-06-23)

**Prepared for:** moderator29 / Phantomfcalls
**Method:** 15 parallel subagent audits + 1 synthesis pass (16 agents, ~1.6M tokens, 546 tool-uses, ~39 min). Every finding verified against **real code + the live Supabase project `phvewrldcdxupsnakddx`** — not migration files (which are stale).
**Verdict:** The platform looks far more finished than it is. Several flagship surfaces — swap, market terminal, View-Proof Buy, transactions, leaderboards, Dune intelligence, admin charts/settings — are **shipped but non-functional or fabricated**. The two highest-stakes failures (trades that never broadcast yet show "Confirmed", and a MEV toggle that protects nothing) are **trust / financial-safety bugs**, not cosmetics.

---

## 1. Executive Summary — the 10 truths

1. **Trades/swaps don't reliably execute, but the UI says they do.** Market terminal returns an unsigned 0x tx and shows "Bought/Sold" without broadcasting (`components/market/InlineBuySellForm.tsx:205-234`). Swap page sets `txStatus='confirmed'` the instant a hash returns, before any receipt (`app/dashboard/swap/page.tsx:1029-1032`). A reverted/dropped tx reads "Swap Confirmed!".
2. **The MEV-protection toggle is theater.** `mevProtect` is sent but never used server-side; no Flashbots/Jito/BloxRoute routing exists. UI claims "Routes via private mempool" and auto-enables for ≥$1k trades while broadcasting to the **public mempool** anyway (`swap/page.tsx:309-341,867`; `api/market/trade/execute/route.ts:39`). Most dangerous item: users size trades believing they're sandwich-protected.
3. **Every swap/trade DB write silently fails — zero financial observability.** `swap_logs` / `fee_revenue` inserts use columns that don't exist on the live tables (insert: `input_token/output_token/wallet_address/swap_type`; real: `token_in/token_out/amount_in/amount_out`). Both tables have **0 rows**. The 0.4% platform fee is collected on-chain by 0x but **never recorded**. Errors are caught and swallowed.
4. **`/api/swap/execute` does not exist**, yet `SwapCard` (View-Proof Buy + every VTX inline swap) and `useSwapExecution` both POST to it → every inline "Confirm Swap" 404s. Only the EVM 0x-via-MetaMask path on the main swap page can actually broadcast.
5. **The build is broken for a paid user surface.** `recharts` is in `package.json`/lockfile but **not installed** (`MODULE_NOT_FOUND`), crashing 6 admin chart pages **and** `app/dashboard/portfolio/page.tsx`. `node_modules` out of sync with the lockfile.
6. **Fabricated numbers leak onto production.** Solana cards invent `valueUsd = txCount*0.01*solPrice` (`api/context-feed/route.ts:436`); proof page "AI Intelligence Analysis" is hardcoded ternaries dressed as model output (`app/dashboard/proof/page.tsx:353-390`); `trustScore` relabeled "VERIFIED" on random tokens; card timestamps synthetically staggered up to ~20 min behind. All violate the CLAUDE.md no-fake-data rule.
7. **An entire intelligence tier renders null in prod.** All 7 Dune tables (`dune_*`, `funding_rate_snapshots`) + `smart_money_convergence` are absent or empty; `bookmarks` table doesn't exist; crons write to nothing. DuneFeedCards + convergence badge are dead; commit `56e65ad` added MORE queries against the missing `dune_cex_flow`.
8. **Discovery/social near-dead + fake-looking boards.** `user_reputation` has **1 row, last computed 2026-05-20** — nightly cron not running. 4/8 leaderboards empty or show one user at "100%". Follow button **reads inverted** (hover-gated Unfollow flips on optimistic click); follow state not hydrated on leaderboard/discover/search.
9. **"User not found" on users that exist.** `profiles.username` UNIQUE is case-sensitive so `Puffnutz`/`puffnutz` coexist; lookup uses `ilike(...).maybeSingle()` which errors on >1 row → mapped to 404 (`api/social/profile/[username]/route.ts:31-37`). 5 Google-OAuth users have NULL usernames, render as bare "@".
10. **"Connect Wallet" routes into the cult 404; no design system.** Portfolio/onboarding/tour/CommandPalette/email all link `/dashboard/settings` (doesn't exist) → cult-themed 404. Four uncoordinated wallet systems and **six competing card definitions** underlie the "scattered/broken" look.

---

## 2. Cross-cutting themes

**A. Real-data integrity (biggest reputational risk).** Fabrication is systemic: unsigned-tx "Bought/Sold", 'confirmed'-on-broadcast, MEV theater, Solana `valueUsd` invention + synthetic timestamps + "VERIFIED" heuristic, fake AI analysis + fake poll, one-user "100%" leaderboards, hardcoded-zero admin charts + $0 treasury, unpriced whale activity. **Principle to enforce platform-wide: a metric is either real or omitted — never a benign-looking constant.**

**B. Schema drift / silent DB failure.** The same `swap_logs`/`fee_revenue` column mismatch breaks Market, Swap, and Transactions simultaneously. `platform_settings` EAV-vs-columnar drift breaks admin settings + treasury. Caught-and-logged errors mask all of it. **Fix once with a shared TS type imported by reader + every writer; stop swallowing insert errors.**

**C. Design-system / nav-chrome fragmentation.** No shared surface primitive → the "scattered" symptom across feed cards, wallet page, profile, and the per-tab-vanishing header. Six card systems, three palettes, four wallet systems, two theme systems, two i18n systems, two admin roots. Pattern: *built N times, consolidated zero times*.

**D. Social-graph → discovery → messaging is one funnel, broken at every join.** Discovery boards don't reflect follow state; follow state isn't returned in list/search payloads; messaging has no path from the graph to a recipient. `canUserDM` already exists and is good — missing pieces: a Message affordance on every graph row + relationship data in every list payload + one precomputed leaderboard source.

**E. Wallet/swap trust spine broken at every stage.** connect (→cult 404) → quote (faked/400s) → execute (no broadcast/404) → confirm (lies) → log (silent fail). One shared client-broadcast engine + one AppKit wallet layer + one swap-log schema fixes the spine.

---

## 3. Per-area summary

- **1 Market terminal:** trade form never signs/broadcasts; fake success; quote in wrong units (~1e6 off, USDC 6dp); live tape always empty + permanent fake LIVE badge; no pre-trade quote. Bar: GMGN/Photon/Axiom/DexScreener.
- **2 Swap engine:** 'confirmed' before receipt; MEV theater; non-0x + Solana paths broken; no approval/Permit2 on standard EVM path; USD/impact/gas faked. Bar: Jupiter/1inch/Uniswap/0x.
- **3 Context feed:** Dune strip dead (tables absent); fabricated Solana USD; synthetic timestamps; `trustScore`→"VERIFIED"; `bookmarks` table missing; SSE wired-or-not unclear; container rearch needed.
- **4 View Proof:** "AI analysis" hardcoded; poll fake/not persisted; embedded bubblemap should be removed; needs real holder-risk strip + per-chain explorer links + `?id=` deep-link.
- **5 Buy→swap:** Buy just bounces to swap; `/api/swap/execute` missing; reuse VTX `SwapCard` engine inline (connect → quote → approve → execute → confirm).
- **6 Discovery lists:** Discover==Find (`/discover`); 16 profiles, 11 with username (API drops null-username rows at `route.ts:305`); reputation cron dead; gate boards on sample size; one materialized leaderboard + `/_all` batch endpoint.
- **7 Follow graph:** inverted button (`FollowButton.tsx:86-109`, hover not reset on optimistic flip); list/search payloads don't return relationship; denormalize counts via trigger; add "Follows you".
- **8 Profile identity:** case-sensitive username dup → "User not found"; OAuth NULL handles; tier badge missing in search dropdown; `mini` renders gray; iOS search zoom (text-sm + autoFocus).
- **9 Messaging:** real tables but 0 rows; libsodium crypto real but wrap-key = SHA-256(access token) → rotates ~hourly → history orphaned; no recipient picker; read receipts dead; realtime never fires (no `setAuth`).
- **10 Design system:** no shared primitive (250+ files re-derive chrome); 6 card defs, 3 palettes, no canonical radius, 81 inline hexes (light-mode bug), 28 hand-rolled toggles. Build `components/ui`: GlassPanel, IconChip, Toggle(Radix), Button.
- **11 Nav/appearance:** header inline in page (vanishes per tab); two theme systems; two i18n systems neither persisted; no Appearance settings, no `/dashboard/settings`.
- **12 WalletConnect:** four wallet systems; only Reown AppKit/WC v2 correct; cult misroute via dead `/dashboard/settings`; one `useWallet()` + one `<ConnectWalletButton/>` needed.
- **13 Wallet/Tx:** Manage-Crypto toggles show dead zeroed placeholder (real balances never merged); Transactions queries wrong columns → empty while `/api/wallet/transactions` (Etherscan v2 + Helius) sits unwired; no back button.
- **14 Admin:** static sessionStorage bearer; two admin roots; `recharts` crash; `admin_token`/`admin_bearer` key mismatch; `/api/analytics/admin` opt-in auth (public exposure); settings writes nonexistent columns; hardcoded-zero charts + $0 treasury.
- **15 Cult/landing/pricing/customise/whale:** cult/vault still linked in-app (sidebar/profile/CommandPalette/pricing); landing heroes full-viewport + heavy; $27 NIPPO still present in upstream main; Customise reorder 400s (slug enum mismatch); whale activity unpriced (53,929 rows `value_usd` NULL).

> Full per-area deep dives + industry-standard references retained in the workflow output.

---

## 4. MASTER TODO — prioritized, sequenced

### Phase 1 — quick UI / branding / dead-link (hours, high trust-per-effort)
1. **[Admin·critical]** `pnpm install` to resolve `recharts`; verify portfolio + admin pages render; add CI `--frozen-lockfile` + `next build`.
2. **[WalletConnect·critical]** redirect `/dashboard/settings → /settings` in `next.config.js`; neutralize cult-404 copy (`app/not-found.tsx:43`) — kills 5 dead links.
3. **[Cult/Whale·critical]** fix Customise: import `widgetRegistry` slugs into `api/dashboard/widgets/route.ts:19` enum; test (registry ⊆ enum).
4. **[Admin·critical]** fix `admin_token`/`admin_bearer` key mismatch via shared `useAdminToken()`.
5. **[Cult·high]** remove $27 NIPPO card; keep $48 Founder Pass. *(done on my branch; re-verify post main-merge)*
6. **[Cult·high]** decouple in-app Cult/Vault links (sidebar `SidebarMenu.tsx:95-101`, profile `:1685`, CommandPalette `:42`, pricing); keep LandingNav pill only.
7. **[Wallet/Tx·med]** add back button to Transactions page.
8. **[Profile·med]** kill iOS search zoom (text-base 16px / drop autoFocus).
9. **[Branding·low]** `nakalabs.com → nakalabs.xyz`; STEINZ → Naka in FAQ/AI/share copy; fix CommandPalette `/dashboard/whales`→`/whale-tracker`, `/clusters`→`/wallet-clusters`.
10. **[Follow·high]** fix inverted FollowButton (reset hover on optimistic flip).

### Phase 2 — design system + nav + appearance
11. Pick ONE palette; rewrite/delete `lib/brand/tokens.ts`; define surface/shape/motion tokens.
12. Build `components/ui`: GlassPanel, IconChip, Toggle(Radix), Button variants; migrate top offenders; eslint/safelist guard; delete dead CSS.
13. Fix light-mode hex-casing bug (inline hexes → `surface.*` tokens).
14. Lift header into `dashboard/layout.tsx` (every route, remove activeNav gate, bump logo, fix `z-40/95`).
15. Build `/dashboard/settings` Appearance panel + `AppearanceProvider` + pre-hydration script.
16. Collapse theme duplication; fix `userScopedStorage` key; add Notifications nav + `/dashboard/notifications`; move theme toggle to sidebar footer.
17. Pick ONE i18n path (next-intl) and persist language per-user.

### Phase 3 — social / discovery / messaging / follow
18. Fix `recompute-reputation` cron (CRON_SECRET, schedule, admin "run now", health check).
19. Gate boards on sample size; hide vs "No data yet"; one materialized view + `/_all` batch endpoint; unify `formatMetric`; fix whale-watchers semantics.
20. Username migration (dedupe Puffnutz, `lower(username)` UNIQUE, fix lookup + error check, mirror check in ProfileTab).
21. OAuth auto-handle in `handle_new_user` + backfill 5 NULL; tier badge in SearchBox; `mini` color; shared `<IdentityBadges>`.
22. Return relationship in search/leaderboard payloads; real `i_follow`; optimistic rollback; denormalize counts via trigger; add "Follows you".
23. Messaging Phase 0 key stability (passkey/wallet-signature wrap key; non-extractable IndexedDB; no silent regenerate; safety-number banner).
24. Recipient picker/compose (`/api/social/dm/recipients`; MessageButton on graph rows); read receipts + unread badge; `realtime.setAuth` + optimistic echo; batched conversation list.

### Phase 4 — trading / swap / walletconnect trust
25. Fix `swap_logs`/`fee_revenue` schema drift in ALL writers+readers via one shared TS type; stop swallowing errors; verify rows land.
26. Make quote==execution for EVM (0x `/swap` + approval/Permit2); hide multi-route UI until adapters return calldata.
27. Wire Solana end-to-end (Solana branch in `/api/swap/quote`; symbol→mint map).
28. Real MEV (Flashbots/MEV-Blocker/Jito) or remove the claim + auto-enable.
29. Real confirmation (poll receipt before 'confirmed'); honest USD/impact/gas; RPC redundancy + nonce mgmt for builtin wallet.
30. Reuse swap engine for terminal Buy/Sell (base-unit amounts, real broadcast, real tape, debounced quote).
31. Create `/api/swap/execute` OR extract shared `lib/trading/executeClientSwap.ts`; fix SwapCard quote params + amount input + `tokenAddress`; inline connect; emit `swapCard` from VTX chat.
32. Remove fake AI block / relabel; persist Endorse poll + real engagement; per-chain explorer links; replace View-Proof bubblemap with real holder-risk strip; deep-linkable via `?id=`.
33. One AppKit wallet layer + one `useWallet()` + one `<ConnectWalletButton/>`; replace all entry points; ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set + documented.

### Phase 5 — admin / transactions / wallet / data + SQL
34. Unify admin auth (httpOnly session + `admin_roles` middleware, deny-by-default, seed roles, shared fetch helper); delete legacy admin root; fix `/api/analytics/admin` auth.
35. Fix settings route against real `platform_settings` columns; consolidate to one flag system; app reads `maintenance_mode`/`registration_open`.
36. Fix broadcast targeting + real counts + dry-run; fix treasury (real wallets + price feed + USDC balance); real dashboard aggregation; verify `admin_audit_log` insert columns.
37. Rebuild Transactions page on `/api/wallet/transactions` + `transactions` table overlay; fix swap write path to populate `transactions`.
38. Merge `multiChainBalances` into holdings; optimistic custom-token rows; cloud-sync toggles; fix `.toLowerCase()` address bug (use `addressNormalize.ts`).
39. Provision-or-hide Dune tier; create `bookmarks` table; kill fabricated numbers; relabel trustScore; real timestamps; unify filtering; wire-or-delete SSE; durable archive; fix React key.
40. Whale activity pricing + classification + counterparty backfill; expand poll cron; Solana holdings indexer.

---

## 5. Consolidated Supabase SQL / schema work

> Mirror every migration into `supabase/migrations/`. Verify column existence against the live DB first.

**A. Swap/fee/transaction logging (highest leverage).** Decide ONE canonical `swap_logs` schema (live cols: `token_in,token_out,amount_in,amount_out,fee_usd,dex,status,tx_hash,created_at,user_id`). Either ALTER to add `wallet_address`,`swap_type` and fix all writers/readers, or drop those from inserts — pick one + a shared TS type. Verify `fee_revenue` real columns. Wire swap/send write path to INSERT into the rich `transactions` table (RLS `user_id = auth.uid()`).

**B. Profile identity.** Dedupe Puffnutz rows, then `CREATE UNIQUE INDEX profiles_username_lower_key ON profiles (lower(username));` drop old case-sensitive unique. Update `handle_new_user` to auto-generate a unique handle when username NULL; backfill 5 NULL rows.

**C. Follow counts.** `ALTER TABLE profiles ADD COLUMN followers_count int NOT NULL DEFAULT 0, ADD COLUMN following_count int NOT NULL DEFAULT 0;` + AFTER INSERT/DELETE/UPDATE trigger on `social_follows` counting status='accepted'.

**D. Context feed.** Create `bookmarks (user_id, event_id, created_at, PK(user_id,event_id))` + RLS own-rows. Optional durable `context_feed_events(id pk, payload jsonb, fetched_at)`. Dune tier: create the 7 missing tables + crons, or hide DuneFeedCards behind a has-data check; populate or remove `smart_money_convergence`.

**E. Appearance/settings.** `ALTER TABLE user_display_preferences ADD COLUMN theme/accent/glass_intensity/density/text_size/reduced_motion ...` + RLS `user_id=auth.uid()`. Wire `.language` to the i18n switch. Consider consolidating the 5+ `*_preferences` tables.

**F. Admin.** Seed `admin_roles` (≥1 super_admin). `platform_settings` is a columnar singleton (`maintenance_mode,registration_open,max_free_wallets,max_pro_wallets,feature_flags jsonb,naka_threshold,telegram_paused`) — rewrite settings+treasury routes to real columns. Verify `admin_audit_log` columns (two impls insert different sets → silent fail).

**G. Messaging (future-proofing).** `dm_participants(conversation_id, user_id, sealed_conversation_key, last_read_at, archived, muted, PK(conversation_id,user_id))` + indexes; `ALTER dm_conversations ADD is_group, title`; rewrite RLS to membership via EXISTS(dm_participants ...).

**H. Discovery/reputation.** Precomputed leaderboard materialized view/table keyed by `(kind, rank)` with denormalized profile fields + `metric_value` + resolved `i_follow`, refreshed by the fixed cron. Confirm `social_top_followers` RPC exists or remove dead fast-path.

**I. Whale tracker.** Backfill `whale_activity.value_usd` (priced at block time) across 53,929 rows; populate `counterparty_label`; classify `action`. PnL/win-rate backfill across `whales`. Verify `sniper_executions.executed_at` (not `created_at`).

**J. RLS verification.** Confirm RLS on `watchlist`, `user_whale_follows`/`user_copy_rules`, `swap_logs_own` (auth.uid()=user_id), and `user_preferences` columns before trusting upserts.

---

*Raw 16-agent output retained at the workflow task path; this doc is the actionable consolidation.*
