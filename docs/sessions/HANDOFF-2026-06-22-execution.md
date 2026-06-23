# HANDOFF — Execution Session (2026-06-22) → Next Session

> Single source of truth for the next session. Read top-to-bottom before starting.
> This session executed the audit-phase-b plan: 12 branches shipped, 4 DB
> migrations applied. The big remaining item is the SWAP SUBSYSTEM (§6) — left
> for a focused session because it's untestable wallet-signing on a live trading
> platform and must not be rushed.

---

## 0. START-OF-SESSION CHECKLIST

1. **Supabase MCP is AUTHORIZED.** A valid personal access token (`sbp_…`) is
   already set in `~/.claude.json` (`mcpServers.supabase.env.SUPABASE_ACCESS_TOKEN`).
   Project ref `phvewrldcdxupsnakddx` (ACTIVE_HEALTHY, Postgres 17). If a tool
   call returns "Unauthorized", run `/mcp` → reconnect supabase (the running
   server caches the token at launch). The token is NOT stored in this repo by
   design (owner rule: never commit secrets) — it lives only in `~/.claude.json`.
   Rotate it anytime at supabase.com/dashboard/account/tokens.
2. **Verify schema against the LIVE DB before any "fix"** — `mcp__supabase__list_tables`
   / `execute_sql`. Migration files can be stale; this session already cleared
   several false positives that way (§4).
3. **Swap/Price card reference images:** the owner sent 3 (2 swap, 1 price). The
   full visual spec is captured in §6/§7 — re-sending is optional, but for a
   pixel-perfect swap-card build, having them in-thread at the start of the swap
   session helps nail spacing/typography.
4. **Read `CLAUDE.md`** + the rules digest in §1. Follow exactly.
5. Repo at `Desktop/steinzlabs`. **Sparse checkout is ON** (~71% of files) —
   `docs/` is NOT on disk; read docs via `git show HEAD:docs/...`. `node_modules`
   installed; `npx tsc --noEmit` works (note: pre-existing `recharts` errors are
   environment noise — recharts is in package.json but not installed locally;
   they vanish on Vercel's build. ~11 such errors are the clean baseline).

---

## 1. OWNER RULES (must follow — digest of CLAUDE.md)

- **Git identity:** `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- **NEVER** add AI attribution anywhere (commits, code, comments, PRs): no
  "Co-Authored-By: Claude", "Generated with Claude", "AI-assisted", etc.
- **Never commit to `main`.** Always a feature branch off main; push and STOP —
  the owner opens/merges PRs (Vercel auto-deploys main). Branch prefixes:
  `feat/ fix/ refactor/ chore/ docs/ security/ perf/`. NEVER `claude/` / `ai/`.
- **Conventional Commits;** body explains the *why*.
- **Audit before every commit:** `git diff --stat`, `npx tsc --noEmit` clean,
  scan for `console.log` / empty `catch{}` / `TODO` / `any`.
- **No mock/fake/demo data.** Wire real APIs; empty state on no data.
- **No `any` types** (document if unavoidable). No commented-out code.
- **Addresses** go through `lib/utils/addressNormalize.ts` — never `.toLowerCase()`
  a raw wallet/token address (Solana is case-sensitive).
- **Supabase:** prefer `apply_migration` via MCP + mirror SQL into
  `supabase/migrations/`. Verify columns against LIVE DB. Never bypass RLS via
  service_role from a client-callable endpoint without explicit user-id binding.
- **WCAG AAA**, picture-perfect, mobile-safe (375px). Match existing style.
- **Never commit secrets.** Reporting: direct, no-bullshit; don't claim "tested"
  for code only typechecked (true proof is the Vercel deploy).
- Schema gotchas: `whales.label` (not name); `price_alerts.price`;
  `user_wallets_v2.wallets` JSONB; `notifications` has `body` (NOT NULL) — see §4.

---

## 2. WHAT THIS SESSION SHIPPED — 12 branches (all tsc-clean, PUSHED, owner merges)

Merge order (P0 first):

1. **`fix/login-redirect-invalid-url`** 🔴 — email login looped on `ERR_INVALID_URL`.
   `app/login/page.tsx` did `window.location.assign(searchParams.get('from'))`
   unvalidated; a stale/malformed `from` in history was re-fed to the browser →
   invalid-URL → bounce to the same poisoned URL (only clearing history escaped).
   Google dodged it (hardcoded /dashboard). Fix: only navigate to a safe
   same-origin RELATIVE path (`/`, not `//` or `/\`), else `/dashboard`. Same
   guard applied to `/auth/clear` `window.location.replace`. Closes an open-redirect.
2. **`fix/notifications-columns`** 🔴 — live `notifications` has only `body`
   (NOT NULL), no `message`/`metadata`. The bell route (select/insert),
   `lib/notifications/channels.ts`, and `lib/social/notify.ts` all used
   message/metadata → bell SELECT errored, in-app inserts failed. Standardized on
   `body`; added `metadata jsonb` column (migration). Bell route still returns
   `message` (aliased from body) so the client is unchanged.
3. **`fix/vtx-advisor-and-streaming`** 🔴 — advisor `claude-opus-4-6` under
   executor `claude-sonnet-4-6` is an INVALID pairing → 400 on every VTX call
   (valid advisors for a sonnet-4-6 executor: opus-4-8/4-7). Set advisor →
   `claude-opus-4-8`. Streaming path had no tool loop (empty replies) → added
   `vtxStreamRaw` + a real stream→tool→re-stream loop in the route.
4. **`fix/dm-key-clobber`** 🔴 — conversations POST upserted with
   `ignoreDuplicates:false`, overwriting the DM key on every thread open → prior
   messages undecryptable. Switched to ignoreDuplicates:true + read stored keys back.
5. **`fix/bubblemap-addr-and-reasoning`** — Solana addr `.toLowerCase()` before
   persist (corruption) → normalizeAddress; center-node filter `'token'`→`'center'`;
   top-5/top-10 mislabel to the model; Solana share-of-supply (marketCap/price
   denominator); + `UNIQUE(user_id,token_address,chain)` migration (the upsert's
   onConflict had no matching constraint → persist silently failed).
6. **`security/dm-rls-with-check`** — `dm_messages` UPDATE had USING (participant)
   but no WITH CHECK + table-wide UPDATE grant → a participant could rewrite
   another member's ciphertext / spoof sender_id via PostgREST. Added WITH CHECK
   + REVOKE UPDATE / GRANT UPDATE(read_at, deleted_at) only.
7. **`feat/price-card-rebuild`** — new `components/market/PriceCard.tsx` (editorial
   dark, serif numerals, logo/symbol/chain/addr+copy/Trusted badge, real 24h area
   chart w/ hour ticks, stats grid Vol/Holders/MCap/Liq/Supply/FDV+%unlocked,
   See-on-Orb) on shared `lib/market/formatters` + `TokenLogo`. Upgraded
   `/api/vtx/token-card` to real Birdeye OHLC (primary on-chain) → CoinGecko
   fallback → synthetic last; added fdv + derived supply. Wired into the VTX page;
   deleted the old inline card + sparkline. NOTE: accent is teal/green per the
   reference image; platform brand-primary is `#0A1EFF` blue (pricing-page Pro
   accent) — confirm with owner whether to swap the card accent to brand blue.
   Dead `components/vtx/TokenCard.tsx` still exists (delete in cleanup).
8. **`feat/social-notifications`** — fire `notifySocialEvent` (new_follower/
   follow_request) on follow; enforce `social_mutes` on leaderboards/
   recommendations/follows-list (were block-only); TIER_RANK now free/mini/pro/max
   (naka_cult removed — cult is NOT a tier).
9. **`fix/tier-gating-per-docs`** — route gates realigned to the pricing page:
   Sniper `/api/sniper/*` pro→**max**; Copy-trading `/api/copy-trading/*`
   mini→**pro**; DNA `/api/dna-analy*` pro→**mini**; Whale VIEW (whale-tracker/feed,
   top-today, whales list/directory/[address]/holdings) pro→**mini**. Whale
   follow/watchlist (write) + AI summary stay pro (Mini is "view only").
10. **`fix/whale-tracker-pricing`** — `lib/whales/priceActivity.ts` (Birdeye by
    contract → CoinGecko native fallback) + `/api/cron/whale-activity-price` (every
    5m, backfills value_usd; the feed filters value_usd≥minUsd so it was empty) +
    `populate_whale_score` now UPDATEs `whales` (was wallet_profiles, which no read
    uses). Migration applied.
11. **`feat/bubblemap-deeplinks`** — page now reads `?share=<jwt>` (via
    /api/bubble-map/share) and `?address=` (VTX CTA); was landing on empty state.
    Wrapped in Suspense; auto-fires the map once the address is set.
12. **`fix/vtx-daily-limit-copy`** — client said "15 messages" but server
    FREE_TIER_LIMIT=25 (and pricing page says 25). Default to 25; drive the
    limit-reached copy from `dailyUsage.limit`.

---

## 3. MIGRATIONS APPLIED TO LIVE DB (mirrored to supabase/migrations/)
- `2026_06_22_notifications_metadata_column.sql` — add `notifications.metadata jsonb`.
- `2026_06_22_harden_dm_messages_update_rls.sql` — WITH CHECK + column grants.
- `2026_06_22_bubblemap_conversations_unique_key.sql` — UNIQUE(user_id,token_address,chain).
- `2026_06_22_populate_whale_score_target_whales.sql` — function targets `whales`.

---

## 4. LIVE-DB FINDINGS (corrects earlier audits)
- `notifications`: `id,user_id,title,body(NOT NULL),type,read,url,created_at` —
  NO message/metadata originally (metadata added this session). The bell was broken.
- `profiles` RLS: only `profiles_select_own` + `profiles_update_own` +
  `service_role`. The "encrypted_private_key exposed to anon" claim = **FALSE
  POSITIVE** (the public-profile policy migration was never applied). DROPPED.
- `whales` HAS `whale_score`(int), `logo_url/source/resolved_at`, `label`;
  `user_whale_follows` HAS `alert_enabled/threshold_usd/channels`; `whale_activity`
  HAS `value_usd`(nullable), `token_address`, `token_symbol`, `amount`.
- `dm_messages` HAS `read_at`, `deleted_at`. `bubblemap_conversations.user_id` nullable.
- `profiles.tier` live values: only `free`, `max` today (ladder slugs
  free/mini/pro/max). **NakaCult is NOT a platform tier** — access is via the
  NIPPO NFT and grants cult features only; a cult member keeps their own tier.
- **Tier gating mechanism is correct** (`lib/subscriptions/tierCheck.ts`,
  4-tier ordinal `checkTier`, used by `serverTierCheck` + `apiTierGate` across 25
  routes + client `useTier`). The legacy `lib/subscriptions/tiers.ts`
  (FREE/PRO/PREMIUM, $19/$99) is **dead** — imported only by
  `app/api/subscription/route.ts`, which has ZERO consumers. Retire in cleanup.

---

## 5. REMAINING WORK — quick wins (do these before/around the swap subsystem)

### B5 — `feat/context-feed-expansion`
Owner wants more events. Cheapest, data already collected:
- Wire `whale_activity` (written every minute, read by nothing) into the live
  feed as labeled whale events (use addressNormalize; map action→whale_accumulation/
  whale_sell to light up dormant TYPE_WEIGHTs in `lib/contextFeed/filter.ts`).
- Surface `social_discovery` (pump.fun + /biz/ crons write it; a migration comment
  even claims the feed reads it — it doesn't).
- Fix `cex_drain` to also emit inflows (`lib/dune/useSurfaces.ts:307`
  `.lt(net_inflow_usd,0)` drops half).
- Fix the server/client type-filter mismatch (silent event loss): server
  `applyTypeFilter` matches a hyphenated/`coingecko`-prefixed taxonomy no fetcher
  emits; client matches different strings. Define ONE shared matcher map in
  `lib/contextFeed/filter.ts`, import both sides.
- New cheap fetchers (plumbing exists): GoPlus `rug_alert` (filter weights it 90
  already), DexScreener "new pool" (`pairCreatedAt` parsed), LunarCrush velocity.
- Persist the in-memory `eventStore` (per-lambda → non-deterministic archive) to a
  table; then flip `useContextFeed` from polling to the existing (unused) SSE.
- Bug: sentiment scoring is a no-op — producers emit UPPERCASE sentiment, weights
  are lowercase keys (`filter.ts`).

### C4 — cleanups
- VTX `[WEB_SEARCH]` flag is parsed (`route.ts` ~1073) but never used → add a
  gated `web_search_20260209` server tool when `webSearchEnabled`.
- VTX error handling string-matches `err.message` (`route.ts` ~1454) → typed
  `instanceof Anthropic.RateLimitError` etc., most-specific-first.
- `ModelPicker` (Fast/Balanced/Deepest) is orphaned/unwired → wire to
  `output_config.effort` or delete `components/vtx/ModelPicker.tsx`.
- Stream path increments usage on empty reply (now mostly moot after A1) — verify.
- Delete dead market stack: `components/market/{TradeTerminal,OrderForm}.tsx` +
  `lib/hooks/useSwapExecution.ts` + `app/api/trade/{execute,quote}` (verify no
  callers). `TradeTerminal` fabricates random-wallet trades (no-mock violation).
- Retire dead `lib/subscriptions/tiers.ts` + `app/api/subscription/route.ts`
  (or align to the 4-tier ladder; both have wrong FREE/PRO/PREMIUM names + $19/$99).
- A1 follow-up: delete the VtxAiTab `TOOL_USE_KEYWORDS` streaming heuristic — but
  ONLY after the route's streaming `done` event emits chart + suggestions parity
  with the non-streaming path, or charts/suggestions regress for tool queries.

### C3 remainder — bubblemap timeline scrubber
The `datetime-local` scrubber sends `&at=` but the intel pipeline is live-only
(the route just echoes the timestamp). Disable/relabel it ("Live") or wire a real
`holder_snapshots` source. Misleading on a trading platform.

### Market P0/P1 (NOT yet addressed beyond gating)
- `components/market/InlineBuySellForm.tsx:205-234` fakes success (no sign/
  broadcast). FIXED AS PART OF THE SWAP SUBSYSTEM (§6).
- `app/api/trade/execute/route.ts` is a no-op stub. `OrderForm` hardcodes
  inputDecimals:6. (Dead stack — delete in C4.)

---

## 6. SWAP SUBSYSTEM — THE BIG REMAINING ITEM (A2 + B2 + B3)

**Why deferred:** wallet-signing on a live trading platform, untestable from the
dev box. Do it as ONE cohesive, focused session. Three P0 components currently
FAKE success (show "Bought!" / "Swap executed" while nothing hits chain):
`components/market/InlineBuySellForm.tsx`, `components/vtx/SwapCard.tsx` (POSTs the
nonexistent `/api/swap/execute`), and the OrderForm/useSwapExecution path (dead).

**The ONE working signer** lives at `app/dashboard/swap/page.tsx` `handleSwap`
(~840-1040): firm 0x/Jupiter quote with **base-unit decimals**
(`getTokenInfo(fromToken).decimals`, `rawAmount = amount * 10**decimals`), then
gasless EIP-712 (`/api/gasless/{quote,submit,status}`) / EVM `eth_sendTransaction`
/ Solana `signAndSendTransaction` / built-in ethers+AES-GCM (with an unlock-modal
flow). This is the reference to reuse — do NOT rewrite it.

**Plan:**
1. **Extract `lib/hooks/useSwapBroadcast.ts`** from `handleSwap` (copy, don't
   move — leave the working page intact until B3 rebuilds it). Input: the
   `transaction`/`swapTransaction` blob a quote returns. Returns `{ broadcast(quote) → txHash }`.
2. **Fix `/api/swap/price`** — it reads `sellToken/buyToken/sellAmount` but
   `SwapCard` sends `chain/from/to/amount` → 400 every time (swallowed → "~"
   placeholder). Standardize params AND convert human amount → base units before
   0x/Jupiter (currently passed raw → wrong numbers even on success). Return
   minReceived, slippageBps, priceImpactPct, quoteData (with token ADDRESSES so
   the Trust badge + route preview light up).
3. **Wire the real signer** into `InlineBuySellForm` (after `/api/market/trade/
   execute` returns `transaction`, call `useSwapBroadcast().broadcast()`, set
   success only from the real txHash) and into `SwapCard`. Delete the
   `/api/swap/execute` calls (or create the route).
4. **Build the multi-leg `SwapBatchCard`** per the reference images (§7).
5. **Rebuild `/dashboard/swap`** page to the same batch flow + visual language,
   reusing the shared signer + components.

---

## 7. CARD DESIGN SPEC (from the owner's 3 reference images)

**SWAP CARD (multi-leg batch):** header "⇅ Swap N of M"; 3-segment step rail with
per-leg labels (e.g. SOL→hSOL / SOL→BONK / SOL→2Z) filling as legs complete;
completed legs collapse to green "✓ 0.0323 SOL → hSOL  View" rows; "You pay"
(token logo + amount), ⇅ glyph, "You receive" (~estimated); stats list "Minimum
received", "Slippage tolerance" (0.5%), "Price impact" (green); refresh-quote (↻);
big teal "⇅ Sign & Swap" per leg → "◌ Confirm in your wallet…"; note above card:
"Confirm each swap separately — a fresh quote is fetched at sign time…". Model:
`SwapBatch { legs: SwapLeg[] }`, each leg `{fromToken,toToken,+addresses,chain,amount}`.
Quote fetched FRESH at sign time per leg; each leg signed separately. The
`/dashboard/swap` PAGE rebuilds to this same flow.

**PRICE CARD (built this session — `components/market/PriceCard.tsx`):** logo /
symbol(bold) / chain(muted) / truncated addr `So11…1112` + copy / green "Ⓐ
Trusted" badge; big serif price + 24h% (↗ green / ↘ red); "24h" pill; real 24h
area chart with hour-tick x-axis; stats grid (24h Volume +Δ, Holders, Market Cap,
Liquidity, Supply, FDV + % unlocked); "See on Orb ↗". Dark near-black (#070A12),
subtle grid texture, editorial serif numerals (Georgia), teal accent. Optional
fields hidden when absent (no fabrication). **Open question for owner:** card
accent is teal/green (matching the image); platform brand-primary is `#0A1EFF`
blue — swap if desired (one-line).

---

## 8. OPEN MERGE QUEUE (owner action — merge order in §2)
All 12 branches from §2 are pushed and waiting. Merge `fix/login-redirect-invalid-url`
FIRST and confirm email login on the Vercel deploy. The 4 DB migrations are
already applied to the live DB, so those branches are safe to merge in any order
relative to the schema (the code matches live).
