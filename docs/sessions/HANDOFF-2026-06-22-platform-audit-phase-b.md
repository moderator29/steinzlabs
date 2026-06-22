# HANDOFF — Platform Audit Phase B + Fixes (2026-06-22)

> Single source of truth for the next session. Nothing here should be lost.
> Read this top-to-bottom before starting. The previous session's context ran
> low, so the deep work was captured here instead of being finished inline.

---

## 0. START-OF-SESSION CHECKLIST (do these first)

1. **Authorize the Supabase MCP.** It was UNAUTHORIZED the entire previous
   session ("Unauthorized. Please provide a valid access token"). Set
   `SUPABASE_ACCESS_TOKEN` so `mcp__supabase__*` (list_tables, execute_sql,
   apply_migration, get_advisors, get_logs) work. The whole audit needs live
   schema access. Project ref: `phvewrldcdxupsnakddx`.
2. **Get the reference images from the owner.** The PRICE CARD and SWAP CARD
   rebuild (§6) needs the owner's sample-flow screenshots — ask for them at the
   start. (Owner asked: "should I send the swap card and price card images next
   session?" → YES, request them.)
3. **APIs are all configured in Vercel env** (owner confirmed): 0x, Jupiter,
   Alchemy, Helius, CoinGecko, Birdeye, GoPlus, Dune, Sim, LunarCrush,
   DefiLlama, Arkham, Anthropic. So features that "don't work" are code/flow
   bugs, NOT missing keys.
4. **Read `CLAUDE.md`** + the rules digest in §1 below. Follow them exactly.
5. The repo is cloned at `Desktop/steinzlabs` (NOT `steinzlabs2` — that's a
   broken empty clone). `node_modules` installed; `npx tsc --noEmit` works.
   Network is flaky for `git clone`/`push` — retry pushes; HTTP/1.1 is already
   forced in git config.

---

## 1. OWNER RULES (must follow — digest of CLAUDE.md)

- **Git identity:** `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- **NEVER** add AI attribution anywhere (commits, code, comments, PRs): no
  "Co-Authored-By: Claude", no "Generated with Claude", no "AI-assisted", etc.
- **Never commit to `main`.** Always a feature branch off main; push and stop —
  the owner opens/merges PRs (Vercel auto-deploys main). Branch names:
  `feat/`, `fix/`, `refactor/`, `chore/`, `security/`, `perf/`, `docs/`.
  NEVER `claude/`, `ai/`.
- **Conventional Commits.** Body explains the *why*.
- **Audit BEFORE every commit:** `git diff --stat`, `npx tsc --noEmit` clean,
  scan for `console.log` / empty `catch{}` / `TODO` / `any`, think failure modes.
- **No mock/fake/demo data.** Wire real APIs; empty state on no data, never
  fabricated numbers.
- **No `any` types** (document if unavoidable). No commented-out code.
- **Address comparisons** go through `lib/utils/addressNormalize.ts` — Solana is
  case-sensitive; never `.toLowerCase()` a raw wallet/token address.
- **Supabase:** prefer `apply_migration` via MCP + mirror SQL into
  `supabase/migrations/`. **Migration files LIE** — verify columns against the
  LIVE DB via `mcp__supabase__list_tables`/`execute_sql` (multiple past audits
  produced false-positive "missing column" claims). Never bypass RLS via
  service_role from a client-callable endpoint without explicit user-id binding.
- **WCAG AAA**, picture-perfect bar, mobile-safe (375px). Match existing style.
- Reporting: direct, no-bullshit. State failures plainly. Don't claim "tested"
  for something only typechecked — true proof is the Vercel deploy.
- Schema gotchas: `whales.label` (not name); `price_alerts.price` (not
  target_price); `user_wallets_v2.wallets` is JSONB with `default_address`
  separate; `profiles` had NO `tier_source` until this session added it.

---

## 2. WHAT THE PREVIOUS SESSION SHIPPED (state of the world)

**NakaCult — fully built and MERGED to main** (PR #535 merged the stacked tip,
which carried the whole stack: entitlement decouple, wallet SIWE + NFT resolver,
Living Sigil rebrand, The Commons [Hall/Offering/Conviction/Pulse], Ape-or-Nope
game, Spotify player, pricing copy, automation crons). The 8 redundant stacked
cult branches were deleted. **The cult NFTs:** NIPPO `0x69411ADa5CccF7bbfb19428462a7bB6c38BCb4Cb`
= cult access (forever while held); Founder Pass `0x14Ab8f5c26eBABD31A66b89dC38d2D21D5E01C67`
= Max platform tier 6 months from first wallet-link (rare 1-yr token IDs still
TBD — defaulting all to 6mo). $NAKA `0x6967b9a8c0b14849CFE8f9E5732B401433fD2898`,
threshold 1,227,000. Cult migrations applied by owner.

**494 LOGIN WALL — root-caused + fixed (NEEDS MERGE):**
- Root cause: `components/ProfileTab.tsx` saved uploaded avatar AND cover images
  as **base64 data-URLs into `user_metadata`** (`auth.updateUser({data:{avatar_url:<base64>}})`).
  user_metadata rides in the session cookie → a 300KB image = a **439KB cookie**
  (confirmed live) → Vercel edge 494s every request. Hit any account that set a
  picture (covers allowed up to 4MB).
- Fix branches to MERGE:
  - **`fix/avatar-storage-no-base64`** — uploads now go to a Storage `avatars`
    bucket; URL stored in user_metadata + `profiles.avatar_url`/`cover_url`.
    Migration `2026_06_22_avatars_bucket_and_metadata_strip.sql` creates the
    bucket + RLS, adds `profiles.cover_url`, and **strips existing base64 out of
    `auth.users.raw_user_meta_data`** (owner already ran the strip SQL). RUN THE
    FULL MIGRATION on merge.
  - **`fix/auth-clear-server-side-494`** — `/auth/clear` now clears cookies
    server-side (a Set-Cookie deletion can evict httpOnly; the JS-only page
    couldn't). Recovery hardening.

**Branch conflicts — ALL RESOLVED** (were `package-lock.json`-only, no real code
conflicts with main): `feat/context-feed-virtualization`, `perf/recharts-removal`,
`feat/passkey-prf-wrap`, `feat/passkey-unlock-full` — merged main + regenerated
lockfile, tsc clean, pushed, re-verified clean. ⚠️ The 3 passkey branches
(`prf-wrap`, `unlock-full`, `unlock-prototype`) are competing versions of the
SAME feature — they conflict with EACH OTHER; merge ONE, delete the other two.

**Auth flows verified:** code (email/password) sign-in → hard-navigates to
`from || /dashboard` (clean, `app/login/page.tsx:312`); Google OAuth wired
(`signInWithOAuth({provider:'google'})` → `/auth/callback`; needs Google enabled
in Supabase). No X/Twitter provider (owner dropped that ask).

---

## 3. SCHEMA VERIFICATION (ran on LIVE DB 2026-06-22 — corrects audit false positives)

| Table | Columns checked | LIVE result |
|---|---|---|
| `notifications` | body / message / metadata | **Only `body` exists.** No `message`, no `metadata`. |
| `user_whale_follows` | alert_enabled / alert_threshold_usd / alert_channels | **All 3 EXIST** |
| `whales` | logo_url / logo_source / logo_resolved_at | **All 3 EXIST** |
| `bubblemap_conversations` | UNIQUE(user_id,token_address,chain) | **CONFIRM next session** (result not captured) |

**Consequences for the audit:**
- ✅ `lib/social/notify.ts` inserting `metadata` (+ omitting NOT-NULL `body`) is a
  **REAL P0 bug** — fix it to use `body`, drop `metadata`. Also `lib/notifications/channels.ts`
  inserts `message`+`metadata` which also don't exist → REAL bug. Align all
  notification writers to the real columns (`body`, plus whatever else
  `notifications` actually has — re-list it).
- ❌ Whale watchlist alert columns + whale logo columns: **NOT bugs** (the code
  was right; the committed migrations were just stale). DOWNGRADE those whale
  "P0 schema drift" findings — the code works against live.
- ⚠️ Re-verify the bubblemap unique constraint before "fixing" it.

---

## 4. THE DEEP AUDIT REPORT (7 subsystems — full findings, file:line)

> Produced by a 7-agent fan-out over the real code. Every claim cites file:line.
> P0 = breaks users now. Verify schema-dependent items against live DB first.

### TL;DR — what's actually breaking users
1. **VTX agent — advisor model pairing likely invalid** (`claude-opus-4-6`
   advisor under `claude-sonnet-4-6` executor) → probable 400 on most VTX calls.
   `lib/services/anthropic.ts:360,392`. *Verify against the claude-api skill /
   reference for the current valid advisor↔executor pairing before changing.*
2. **VTX streaming drops all tool use** → tool queries return empty.
   `lib/services/anthropic.ts:437-447`, `lib/ai/vtxAgent.ts:69`. Streaming is the
   default in `VtxAiTab`.
3. **Market Buy/Sell fakes success** — builds a 0x tx server-side, never signs/
   broadcasts, shows "Bought!" while nothing happens on-chain.
   `components/market/InlineBuySellForm.tsx:205-234`.
4. **Swap card 404s** — `/api/swap/execute` does NOT exist; quote params also
   mismatched (`from/to/amount` vs `sellToken/buyToken/sellAmount`).
   `components/vtx/SwapCard.tsx:130,198`; `app/api/swap/price/route.ts:14`.
5. **DM key rotated on every thread open** → all prior messages become
   undecryptable; race clobbers peer key. `app/dashboard/messages/[peerId]/page.tsx:67-87`
   + `app/api/social/dm/conversations/route.ts:65-77`.
6. **Whale feed empty** — `whale_activity.value_usd` never priced (inserted 0/
   null, never backfilled); feed filters ≥100k → shows nothing.
   webhooks `:189/:174`; `app/api/whale-tracker/feed/route.ts:90`.
7. **Notifications writes fail** — `notify.ts`/`channels.ts` use non-existent
   columns (`metadata`/`message`); `body` is the real column (§3).

### Cross-cutting root causes
- **Built-but-never-wired:** VTX tool cards (`tokenCard`/`swapCard`/`toolsUsed`
  built server-side, discarded by client `VtxAiTab.tsx:805-849`); social `notify`
  dispatcher (follow events never fired); `social_mutes` (stored, never
  filtered); `whale_activity` + `social_discovery` (written by crons, read by
  nothing); 3 SSE streams (built, client still polls); bubblemap share +
  deep-links wired on one end only.
- **Two parallel impls of everything:** two price cards, two swap stacks (working
  one only at `/dashboard/swap`), two bubblemap pipelines, three whale-scoring
  formulas.
- **Prompt cache defeated:** VTX interpolates volatile data into the cached
  system prefix → cache read ≈ 0 (`anthropic.ts:337` + `route.ts:1196-1203`).
- **RLS "permissive base, tighten in app":** DM update policy has no WITH CHECK;
  public-profile policy exposes `encrypted_private_key`/`dm_permission` to anon.

### SOCIAL + MESSAGING (`app/api/social/*`, `app/dashboard/messages/*`, `lib/social/*`)
- P0 `notify.ts:71-77` writes non-existent `metadata` + omits NOT-NULL `body`
  (live `notifications` has `body`, not metadata/message) → DM notifications
  silently fail (swallowed by `.catch(()=>{})` at `dm/messages/route.ts:112`).
- P0 DM conversation key clobber (above) → history undecryptable.
- P1 Follow/approve events never call `notifySocialEvent` (`follow/route.ts`).
- P1 `social_mutes` stored but **no read path filters muted users** (feed/
  leaderboard/list filter only `social_blocks`).
- P1 `dm_messages` UPDATE RLS has no `WITH CHECK` (`2026_05_16_social_layer_foundation.sql:212`)
  → any participant can rewrite any message column via raw PostgREST.
- P2 `recommendations/route.ts:22` `TIER_RANK` missing `mini`/`naka_cult`.
- P2 `follows/list` pagination drops pages when `q` filters a full page.
- P3 public-profile base-table RLS exposes sensitive columns to anon
  (`2026_05_23_public_profile_read.sql:50`).
- Posts/feed tab is hardcoded-empty (subsystem doesn't exist).
- NOTE: the cult "Whisper Network" is an anonymous intel board, NOT E2E DMs; the
  real E2E DM stack is `/dashboard/messages`.

### VTX AI AGENT (`app/api/vtx-ai/route.ts` ~1492 lines, `lib/services/anthropic.ts`, `lib/ai/*`, `components/VtxAiTab.tsx`)
- Models in use: executor `claude-sonnet-4-6`, advisor `claude-opus-4-6`
  (`anthropic.ts:360,366,392,398,477`). **Verify the advisor pairing** — agent
  suspected `opus-4-6` under `sonnet-4-6` is invalid → 400. Use `client.beta.messages.create`
  with `betas:["advisor-tool-2026-03-01"]`, not `(create as Function)` + manual
  header (`anthropic.ts:364,396`). CHECK THE claude-api skill for current valid IDs/pairings.
- Streaming has no tool loop (`vtxStream` only forwards text deltas) → tool
  turns return empty. Route tool turns through the non-streaming loop or build a
  streaming tool loop.
- ~40 tools defined (`anthropic.ts:98-312`, `lib/ai/vtxToolsP2B.ts`, `vtxToolsDune.ts`);
  tool-result cards (`tokenCard`/`swapCard`/`toolsUsed`) are built server-side
  (`route.ts:1333-1443`) but the client **never reads them** (`VtxAiTab.tsx:805-849`)
  → render them or delete the dead payload.
- Prompt cache defeated (volatile data in cached prefix). Move volatile context
  to a trailing message block; verify `usage.cache_read_input_tokens`.
- `app/api/vtx-ai/chat/route.ts:78` calls `runVTXAgent` with no `onToolCall` →
  tools silently dropped.
- Error handling string-matches `err.message` instead of typed `Anthropic.*Error`
  (`route.ts:1454`). `ModelPicker` (Fast/Balanced/Deepest) is decorative — wire
  it to `effort`/`thinking`. Daily-limit copy says 15 but enforces 25
  (`VtxAiTab.tsx:797` vs `FREE_TIER_LIMIT=25`).

### PRICE CARD + SWAP CARD (`app/dashboard/vtx-ai/page.tsx`, `components/vtx/SwapCard.tsx`, `components/market/WatchlistCard.tsx`)
- No `docs/` folder describes these — the OWNER'S SAMPLE IMAGES are the spec
  (request them). Reference flow: PRICE CARD = logo/symbol/name/truncated addr +
  copy + "Trusted" badge + price + 24h% + 24h line chart w/ hour ticks + stats
  grid (24h Vol +%, Holders, Market Cap, Liquidity, Supply, FDV +% unlocked) +
  "See on Orb". SWAP CARD = MULTI-SWAP batch ("Swap 1 of 3", step rail e.g.
  SOL→hSOL / SOL→BONK / SOL→2Z), You pay / You receive (~est), Minimum received,
  Slippage tolerance, Price impact, refresh-quote, "Sign & Swap" — fresh quote
  fetched at sign time, each leg signed separately.
- P0 `/api/swap/execute` does not exist (`SwapCard.tsx:198`, `useSwapExecution.ts:121`).
- P0 quote param mismatch (`SwapCard.tsx:130-136` sends `chain/from/to/amount`;
  `app/api/swap/price/route.ts:14` reads `sellToken/buyToken/sellAmount`) →
  400 every time, swallowed → shows placeholder `~` quote + 0.00% impact.
- P0 NO multi-swap model (single from/to; single regex `swap <amt> <A> for <B>`
  at `route.ts:1400`). The "Swap 1 of 3" batch flow doesn't exist.
- P0 no client wallet-signing step (the "Confirm in wallet" stage is cosmetic).
- P1 Trust badge + route preview starved (server swapCard sets symbols only, no
  token addresses — `route.ts:1410`).
- P1 Price card missing Trusted badge/copy/Holders/Supply/FDV/"See on Orb"
  (`vtx-ai/page.tsx:282-351`); chart is a synthetic 3-point reconstruction
  (`app/api/vtx/token-card/route.ts:124-159`); price/stats split-brain.
- Decimals: human amounts passed raw to 0x/Jupiter (expects base units) →
  wrong numbers even on a successful quote.
- Rebuild: ONE `PriceCard` on shared `lib/market` primitives (`TokenLogo`,
  `SparklineChart`, `PriceChangeDisplay`, `formatPrice`, `formatLargeNumber` —
  what `WatchlistCard` uses); delete dead `components/vtx/TokenCard.tsx`. New
  `SwapBatch{legs[]}` model; quote via `/api/swap/price` (correct params, base
  units, fresh at sign time); CREATE `/api/swap/execute` OR wire client signing
  (`useNakaWallet` / injected EVM) reusing the working `/dashboard/swap`
  `handleSwap` (page.tsx:945-1025). NOTE: the bubble-map page does NOT render
  these cards (it has its own inline bar `bubble-map/page.tsx:581-608`).

### WHALE TRACKER (`app/dashboard/whale-tracker/*`, `app/api/whale-tracker/*`, `app/api/whales/*`, crons `whale-*`)
- P1 (was mis-flagged P0) whale alert/logo columns EXIST live (§3) — code is
  fine; commit the matching migrations for repo parity if desired, but no
  runtime bug.
- P1 `value_usd` never priced → `whale_activity`-backed feed is empty (webhooks
  insert 0, poll inserts null, `whale-backfill-pnl` never updates
  `whale_activity.value_usd`; feed filters `.gte('value_usd',minUsd)` default
  100k). BUILD a USD pricing step (price on insert or a dedicated cron) — biggest
  whale gap.
- P1 `populate_whale_score` writes `wallet_profiles.whale_score`
  (`2026_05_17_populate_whale_score_fn.sql:37`) but every read uses
  `whales.whale_score` → scores never update. Three different scoring formulas
  exist.
- P1 `app/api/stream/whale-alerts/route.ts:60` default address is the literal
  string `'binance-hot-wallet'` → empty stream.
- P2 feed enrichment lowercases Solana addresses (`feed/route.ts:142,154`) —
  violates addressNormalize rule; follower-count query lacks chain filter.
- Missing: real-time (it's 15–30s polling, no Supabase Realtime), automated
  Alchemy/Helius webhook registration, multi-chain ingest (poll is ETH-only, 15
  whales/min), insider/MEV/bot label assignment.

### CONTEXT FEED (`components/ContextFeed.tsx`, `app/api/context-feed/*`, `lib/dune/useSurfaces.ts`)
- Owner wants MORE events. Cheapest wins (data already populated):
  1. Wire `whale_activity` (written every minute, read by nothing) into the live
     feed as labeled whale events. 2. Surface `social_discovery` (pump.fun +
     /biz/ crons write it; migration comment even claims the feed reads it — it
     doesn't). 3. Add a `smart_money_convergence` card. 4. Fix `cex_drain` to
     also emit inflows (`useSurfaces.ts:307` `.lt(net_inflow_usd,0)` drops half).
- One cheap fetcher each (services already present): LunarCrush social-velocity,
  GoPlus `rug_alert` (filter.ts already weights it 90), DexScreener "new pool"
  (`pairCreatedAt` already parsed).
- Bugs: in-memory `eventStore` is per-lambda (archive non-deterministic,
  `route.ts:123`); SSE `events/route.ts` built but client still polls; server/
  client type filters disagree.

### MARKET + TRADING (`app/dashboard/market/*`, `components/market/*`, `app/api/swap/*`, `app/api/market/trade/*`, `app/api/trading/*`)
- WORKS: quotes (`/api/swap/price` EVM 0x + Solana Jupiter), watchlist (Supabase-
  persisted), charts (TradingView + AdvancedChart), the `/dashboard/swap` engine
  (full sign+broadcast), order-type backends (`/api/trading/{limit-orders,
  positions,stop-loss,dca-bots}` exist).
- P0 `InlineBuySellForm.tsx:205-234` fakes success (no sign/broadcast — see TL;DR
  #3). The working signing code already exists in `/dashboard/swap` `handleSwap`
  (page.tsx:945-1025) — wire it in.
- P0 `useSwapExecution.ts:121,63` POST to non-existent `/api/swap/execute` (404)
  and to `/api/swap/quote` which only exports GET (405) → OrderForm/TradeTerminal
  path fully dead.
- P1 `app/api/trade/execute/route.ts:16-24` is a no-op stub.
- P1 `TradeTerminal.tsx:39-55` fabricates random-wallet trades (violates no-mock
  rule) → replace with `RecentTradesRail` real source.
- P2 `OrderForm.tsx:71,90` hardcodes `inputDecimals:6` for all tokens.
- Consolidate the two swap stacks; mirror the price card on `WatchlistCard` /
  `lib/market/formatters.ts` (`formatPrice`, `formatLargeNumber`, etc.).

### BUBBLE MAP (`app/dashboard/bubble-map/page.tsx`, `app/api/bubble-map/*`, `app/api/bubblemap-agent/route.ts`, `lib/services/contract-intelligence.ts`)
- P0 conversation upsert `onConflict:'user_id,token_address,chain'` but no such
  unique constraint (`bubblemap-agent/route.ts:165`; CONFIRM live §3) → persist
  silently fails.
- P0 page ignores `?share=` and `?address=` deep-links → shared/VTX links land
  on empty page (`page.tsx`; `VtxAiTab.tsx:532`).
- P1 agent top-holder filter uses id `'token'` but center node id is `'center'`
  (`page.tsx:487`) → 100% node leaks into reasoning. Top-5 concentration
  mislabeled "top-10" to the model (`contract-intelligence.ts:240` vs
  `bubblemap-agent/route.ts:107`). Fake timeline scrubber. Solana % is share-of-
  fetched not share-of-supply (`contract-intelligence.ts:336`).
- Adding `TokenCard` in place of the inline bar is a cheap win; SwapCard needs a
  quote/wallet wiring follow-up.

---

## 5. SWAP CARD + PRICE CARD — REBUILD SPEC (request owner images first)

See PRICE/SWAP section in §4 for the full reference flow + file map. Summary of
the build:
- **PriceCard:** one component on the shared `lib/market` primitives, mirroring
  `WatchlistCard`. Header (logo/symbol/name/addr+copy/Trusted badge), price+24h%,
  real 24h OHLC chart with hour ticks, stats grid (Vol+%, Holders, MCap, Liq,
  Supply, FDV +% unlocked), "See on Orb". Source one server payload; read every
  stat live (fix split-brain). Holders from `/api/intelligence/holders/[token]`;
  "% unlocked" needs a real source (GoPlus/unlocks) or hide it.
- **SwapCard (multi-swap):** `SwapBatch{legs:SwapLeg[]}` each leg
  `{fromToken,toToken,+addresses,chain,amount}`. UI: "Swap N of M", step rail,
  You pay / You receive (~est), Minimum received, Slippage, Price impact,
  refresh-quote, Sign & Swap per leg. Quote `/api/swap/price` with
  `sellToken/buyToken/sellAmount` in BASE UNITS, fresh at sign time; convert
  integer amounts back to human for display. Execute: create `/api/swap/execute`
  OR wire client signing (reuse `/dashboard/swap` handleSwap). Light up the
  Trust badge + route preview by carrying token addresses.

---

## 6. RECOMMENDED PHASE PLAN (next session)

Each phase = focused branch off main, audited, tsc-clean, pushed (owner merges).

- **Phase A — stop the platform lying (P0):**
  1. `fix/vtx-advisor-and-streaming` — verify+fix advisor model pairing (check
     claude-api skill) + route tool turns through the working loop.
  2. `fix/swap-execution-wiring` — wire real signing into market Buy/Sell +
     create/repoint `/api/swap/execute`; fix quote params + decimals.
  3. `fix/social-notifications-and-dm` — notifications columns (`body`), DM key
     clobber, DM RLS WITH CHECK.
- **Phase B — rich features / rebuilds:**
  4. `feat/price-swap-card-rebuild` (request images first).
  5. `feat/context-feed-expansion` (wire whale_activity + social_discovery + new
     fetchers).
  6. `fix/whale-tracker-pricing` (value_usd pipeline + score-table fix).
- **Phase C — polish/security:** mute enforcement, RLS holes, bubblemap deep-
  links + TokenCard, leaderboard tier rank, follow notifications.

Start each by VERIFYING the schema via MCP (now authorized) — several "bugs"
were stale-migration false positives (§3).

---

## 7. OPEN MERGE QUEUE (owner action)

- `fix/avatar-storage-no-base64` (+ run its migration) — ENDS the 494. Priority.
- `fix/auth-clear-server-side-494` — 494 recovery hardening.
- `feat/context-feed-virtualization`, `perf/recharts-removal` — conflicts
  resolved, ready.
- ONE passkey branch (`feat/passkey-unlock-full` is the most complete candidate;
  confirm), then delete `passkey-prf-wrap` + `passkey-unlock-prototype`.
- Clean-merge backlog: `feat/sc5-deep-link`, `feat/security-center-5-tab`,
  `feat/sse-and-deep-links`, `fix/cluster-key-drop`, `fix/profile-tab-stale-refs`,
  `docs/handoff-session-v`.
