# SESSION U — HANDOFF

> Auto-begin doc. Read this top-to-bottom, then start executing the next pending branch in §4. Owner explicitly wants no questions, no pausing, just execute. Locked rules in §1 apply on every action.

---

## §0 Bootstrap (first 2 minutes)

```bash
git fetch origin --prune
git checkout main && git pull --ff-only
git config user.name       # MUST print: moderator29
git config user.email      # MUST print: 101205446+moderator29@users.noreply.github.com

# Open branches from session T (review/merge order in §3):
git branch -r --no-merged origin/main
```

If owner's first message is a fresh bug report or slash command → drop this doc, serve them. Otherwise → resume §4.

---

## §1 LOCKED rules — never violate

### Identity & commits
- Identity: `moderator29 <101205446+moderator29@users.noreply.github.com>` exactly
- **No AI attribution anywhere** — no `Co-Authored-By: Claude`, no "Generated with Claude", no robot footer, no emoji-credit. Owner has caught this and is firm.
- **Never commit to `main`** — owner is the only one who merges (Vercel auto-deploys from main)
- **Never amend** an existing commit — always create a new commit on top
- **Never `--no-verify`** or any hook-skip flag
- **Conventional Commits** — `feat:` `fix:` `refactor:` `chore:` `docs:` `test:` `perf:` `security:`. Message body explains *why* not *what* (diff shows what)
- **Audit BEFORE every commit**:
  1. `git diff --stat` — confirm only intended files
  2. `npx tsc --noEmit` — must be clean
  3. Scan: no `console.log` in prod, no empty `try/catch {}`, no TODO without tracking, no hardcoded secrets/test addresses, no commented-out code
  4. For UI: think loading/error/empty/unauthenticated/mobile failure modes

### Scope & process
- **No mock data ever.** UI missing real data → build the server pipeline in the SAME branch (Supabase / Alchemy / Helius / CoinGecko / Dune / GoPlus / DexScreener / Anthropic).
- **3–5 phase-branches max** per multi-section prompt. Don't ship 20 micro-branches.
- **Branch naming**: `feat/<slug>`, `fix/<slug>`, `perf/<slug>`, `security/<slug>`, `chore/<slug>`, `refactor/<slug>`, `docs/<slug>`. **Never** `claude/`, `ai/`, `claude-code/`.
- **Todo list = full backlog in plain English** then owner picks. Don't collapse multi-section asks to bullet headlines.
- **Autonomous mode**: keep going, confirm only for destructive / migration ops.
- **No false "fixed" claims** — only after prod verification. If you can't reach prod, say "attempted fix, pending production verification" and hand owner the URL.

### Brand & UX
- Casual tone with owner; MEVX / Nansen-grade UX bar
- WCAG **AAA** contrast minimums (7:1 normal, 4.5:1 large)
- Picture-perfect UX before raw functionality where they conflict at user-visible surfaces

### Schema gotchas (verified live against Supabase, NOT migration files)
- `whales.label` (NOT `name`)
- `price_alerts.price` (NOT `target_price`)
- `user_wallets_v2.wallets` is JSONB; addresses live INSIDE the JSON, `default_address` is separate
- `profiles` SELECT RLS now allows public read via `profiles_select_public_safe` policy (added in `2026_05_23_public_profile_read.sql`); also has `profiles_select_own` for full-row owner access
- `profiles` now has `tier_source` + `tier_updated_at` columns (added in `2026_05_23_naka_cult_tier_source.sql`) — `tier_source IN ('naka_balance','stripe','admin','legacy', NULL)`
- Before any DDL: `mcp__supabase__list_tables` first to verify column state; migration files lie

---

## §2 Owner's locked API/provider decisions — do NOT re-evaluate

| Capability | Provider | Env |
|---|---|---|
| Cross-chain bridge + cross-chain swap | LiFi | `LIFI_API_KEY` |
| EVM aggregator | 0x | `ZEROX_API_KEY` |
| EVM multi-aggregator | 1inch + KyberSwap + OpenOcean | their keys |
| Solana swap | Jupiter | `JUPITER_*` |
| EVM private mempool | Flashbots Protect RPC | `FLASHBOTS_PROTECT_RPC` |
| BSC private mempool | BloxRoute | `BLOXROUTE_BSC_URL` + `BLOXROUTE_AUTH` |
| Solana private mempool | Jito bundles | `JITO_BLOCK_ENGINE_URL` |
| EVM RPC + indexing | Alchemy | `ALCHEMY_API_KEY` |
| Solana RPC + indexing | Helius | `HELIUS_API_KEY` |
| Market data | CoinGecko (primary), DexScreener (DEX), GeckoTerminal (fallback) | `COINGECKO_API_KEY` |
| Token security | GoPlus (primary) + Honeypot.is + De.Fi + RugCheck triangulation | `GOPLUS_API_KEY` |
| Social signals | LunarCrush | `LUNARCRUSH_API_KEY` |
| Bot protection | Cloudflare Turnstile | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` |
| Onchain SQL | Dune Analytics | `DUNE_API_KEY` (+ 11 query IDs in §6) |
| Realtime wallet API | Sim by Dune | `SIM_API_KEY` |
| LLM | Anthropic Claude (Sonnet 4.6 executor + Opus 4.6 advisor) | `ANTHROPIC_API_KEY` |
| Database + auth | Supabase | standard |
| Push | VAPID Web Push | `VAPID_*` |
| Telegram | Telegram Bot API | `TELEGRAM_BOT_TOKEN` |
| Hosting | Vercel | — |

---

## §3 What shipped in Session T — 6 open branches awaiting owner merge

All pushed; owner opens PR in GitHub UI + merges.

### Merge order (do this BEFORE starting Session U work)
1. **`security/critical-rotations-and-patches`** (10 commits) — supply-chain CVE patches, private-key zeroization, fail-closed auth rate-limit, cron sig defense, Sentry PII scrub (wallet/tx/email/JWT/breadcrumbs), DM body sanitizer, account-delete email-confirm, Turnstile fail-closed, OFAC strict mode, game-scores hardcoded password removed, webhook rate limiting (Alchemy + Helius 120/60s/IP)
2. **`fix/wallet-vtx-cult-broken-paths`** (5 commits) — `/u/Puffnutz` 404 fix (RLS migration + UUID fallback + username backfill), VTX sidebar dedup (squidgrow×8), NakaCult scroll bug (ChamberPortal animate-once + history.scrollRestoration='manual'), DM block-bypass GET, VTX stream observability logging
3. **`perf/cpu-bundle-and-reflows`** (3 commits) — naka-cult stats `unstable_cache(60s)`, PauseAnimationsOnHidden component + will-change, NotificationBell BroadcastChannel tab coordination
4. **`feat/p1-feature-completions`** (3 commits) — `/api/whales?sort=pnl&min_pnl=N`, SPL token symbol resolution via DexScreener, copy-trading decimal precision fix
5. **`feat/wallet-connect-mobile-and-eip6963`** (1 commit) — Phantom mobile deep-link (removes premature `isPhantom` guard that was misfiring on first paint)
6. **`feat/naka-cult-tier-resolver`** (1 commit) — on-chain NAKA balance resolver cron + tier_source/tier_updated_at migration

### Migrations to apply (after each branch merges)
- `supabase/migrations/2026_05_23_public_profile_read.sql` (Branch 2)
- `supabase/migrations/2026_05_23_naka_cult_tier_source.sql` (Branch 6)

Apply via `mcp__supabase__apply_migration` or Supabase Dashboard → SQL Editor.

### Env vars to set / rotate (Vercel project settings)
- `SUPABASE_SERVICE_ROLE_KEY` — **ROTATE** (was flagged in SECURITY_BACKLOG)
- `JWT_SECRET` — owner set to `jasonbourne203046930*vwdk` (do NOT save this value to any file/memory; owner manages)
- `ADMIN_BEARER_TOKEN` — verify set in prod (Branch 1 game-scores now requires it)
- `TURNSTILE_SECRET_KEY` — verify set in prod (Branch 1 fails closed if missing)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — verify set (webhook rate-limiting uses these; fails open if missing)
- `NAKA_CULT_THRESHOLD=1227000` (already set)
- `NEXT_PUBLIC_NAKA_TOKEN_ADDRESS=0x6967b9a8c0b14849CFE8f9E5732B401433fD2898` (already set)
- 11 Dune query IDs (already provided to owner — see §6)

### Spot-check after each branch deploys
- Branch 1: `?password=195656` on `/api/game-scores` → 401, Sentry has no plaintext wallet addrs in breadcrumb URLs
- Branch 2: `/u/Puffnutz` loads profile (not 404), VTX shows one squidgrow entry, `/naka-cult` doesn't auto-scroll-up while reading
- Branch 3: open 3 dashboard tabs → only one polls `/api/notifications` (DevTools Network)
- Branch 4: `/api/whales?sort=pnl&limit=10` returns top-PnL whales in order
- Branch 5: on mobile, tap Phantom Sign In → opens Phantom in-app browser (not download page)
- Branch 6: trigger cron manually with cron auth header → response has `qualified: >0` after first sweep; Supabase: `SELECT COUNT(*) FROM profiles WHERE tier='naka_cult' AND tier_source='naka_balance';` shows non-zero

---

## §4 Pending branches — execute in this order

Each is a self-contained branch from main. Pick the next one, cut, do audit-before-each-commit, push, report PR URL to owner. **One in_progress todo at a time.**

### Branch 7 — `feat/swap-provider-and-mev-wiring`
Owner's reported "swap doesn't work" — root cause is selectedProvider collected in UI but ignored in execute. Files: `app/dashboard/swap/page.tsx` (handleSwap around line 825-862), `app/api/market/trade/execute/route.ts` (already accepts selectedProvider param), `lib/services/swap-aggregator.ts`.
- SWAP1: pass `selectedProvider` + `quoteData` from `RouteComparison.onSelect()` into `handleSwap()`. When `selectedProvider !== '0x'`, POST to `/api/market/trade/execute` with `{ selectedProvider, routeQuoteData: quoteData.raw, ... }`. When '0x', keep existing `/api/swap/quote` flow.
- SWAP2: add `mevProtect` field to body of `/api/swap/quote` + `/api/market/trade/execute`; relayer reads it.
- SWAP3: Solana — when `mevProtect && chain==='solana'`, wrap Jupiter tx in Jito bundle with priorityFeeLamports. `lib/services/jupiter.ts` `buildSwapTransaction` needs Jito bundle export.
- SWAP4: useEffect on swap page mount — if `onMobileDevice && !isConnected`, auto-open AppKit modal after 300ms.
- SWAP5: in gasless check (`page.tsx:1407`), add `&& !onMobileDevice` so MetaMask mobile (no EIP-712) doesn't show broken gasless option.
- SWAP6: Bridge tab in swap page when sourceChain !== destChain → call `getLifiQuote()` via `lib/services/lifi.ts`.

### Branch 8 — `feat/dm-notifications-and-realtime-depth`
- DM3: in `POST /api/social/dm/messages` after insert, call `await notifySocialEvent({ recipient_id: peerId, event: 'dm_received', metadata: { sender_id: user.id } })` (import from `lib/social/notify`).
- DM4: in `app/dashboard/messages/[peerId]/page.tsx` useEffect for Realtime channel, add `document.addEventListener('visibilitychange', ...)` that resubscribes when `document.visibilityState === 'visible'`.
- DM5: line ~107 sort: `decrypted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())` (NOT localeCompare).
- DM7: Add "Load older messages" button that fetches `?before=<oldest.created_at>` and prepends to list.

### Branch 9 — `feat/alerts-realtime-and-composite`
- ALERT1: new migration `2026_05_24_enable_notifications_realtime.sql` → `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` (verify exact publication name in current Supabase setup first via `mcp__supabase__execute_sql "SELECT pubname FROM pg_publication"`).
- ALERT2: in `/api/cron/alert-monitor/route.ts` loop, add composite alert evaluation: read `composite_alerts` rows where `last_triggered_at IS NULL OR now() - last_triggered_at > cooldown_seconds`, evaluate condition_json predicate, fire + update last_triggered_at.
- ALERT4: in `notification-digest` cron, on Telegram send failure, insert into `pending_telegram_messages` table; retry cron picks up.
- ALERT6: `app/alerts/page.tsx` line 22-34 — change useState to backend POST/GET via `/api/alerts`.
- ALERT7: wire Discord webhook delivery + Twilio SMS — reuse Telegram retry queue pattern.

### Branch 10 — `perf/lazy-bundles-and-poll-cleanup`
- PERF1: `components/ProfileTab.tsx:150` — guard `clearInterval` with mounted ref to prevent the leak on rapid re-mount.
- PERF3: `hooks/market/useLivePrice.ts:29-37` — replace setState-driven flash with CSS-only `data-flash` attribute + `transition: color 600ms`.
- PERF8: lazy-load via `next/dynamic` — `ethers` (275KB) only on swap/wallet routes; `@solana/web3.js` (210KB) only on Solana surfaces; `html2canvas` (72KB) only when share-as-PNG button clicked.
- PERF8b: `npm rm recharts` (60KB, prior audit confirmed unused).
- PERF9: in `components/cinematic/ParticleField.tsx:114-116`, add frame-skip on mobile to cap at 30fps.

### Branch 11 — `feat/whale-archetype-and-arkham-surfacing`
- WHALE2: `app/api/cron/whale-backfill-pnl/route.ts:157-183` `computeMetrics()` — compute `avg_hold_hours` from buy/sell pair time deltas (find matched closed positions in windowTx30).
- WHALE3: same cron, compute `archetype` using `deriveBadges()` logic from `app/dashboard/whale-tracker/page.tsx:850-861`; upsert to `whales.archetype` column.
- WHALE5: `app/dashboard/whale-tracker/[address]/page.tsx` — render Arkham entity intel (name, logo, website, twitter, verified) from existing `/api/whales/[address]` Arkham fetch.
- WHALE6: in feed card render, read `whales.archetype` for badge.
- WHALE7: delete dead `components/whale/LeaderboardRow.tsx` and `WhaleAlphaCard.tsx`.

### Branch 12 — `fix/cluster-pagination-and-cost-cap`
- CLUSTER1: unify `cluster_key` (SHA from members) vs `cluster_id` (FNV hash) — pick one canonical; migrate `cluster_labels.cluster_key` to `cluster_id`.
- CLUSTER2: `app/api/clusters/by-id/[id]/route.ts:26-50` — raise 500-edge cap to 5000 with pagination cursor.
- CLUSTER3: `app/dashboard/wallet-clusters/cluster/[id]/page.tsx:227-237` — paginate member list 100 at a time + "Show more" button.
- CLUSTER4: `lib/clusters/orchestrator.ts:192-204` — wrap Claude call with daily-per-cluster rate limit (Upstash); log cost to new `claude_api_usage` table.
- CLUSTER5: `app/api/clusters/labels/[id]/vote/route.ts:44-62` — move vote count recompute into Postgres RPC with row lock.

### Branch 13 — `feat/bubblemap-edge-usd-and-mobile`
- BUBBLE1: `app/api/bubble-map/route.ts:93,99` — replace `Math.min(a.%, b.%)` with USD value from underlying transfer amounts.
- BUBBLE2: in `app/dashboard/bubble-map/page.tsx`, enable d3-zoom `.touchable(true)` + add `touch-action: manipulation` CSS.
- BUBBLE3: SVG viewBox should be dynamic from container `getBoundingClientRect()`.
- BUBBLE4: timeline scrub (date picker) → re-query `/api/bubble-map?at=<ts>`; signed share URL via JWT-signed permalink.

### Branch 14 — `feat/wallet-intel-alpha-report-and-arkham-fallback`
- WI1: create `app/api/wallet-intelligence/[address]/alpha-report/route.ts` that calls `vtxAnalyze()` with 2min Redis cache.
- WI2: wrap address inputs in `normalizeAddress()` everywhere (currently inline `.toLowerCase()` breaks Solana).
- WI3: `app/dashboard/wallet-intelligence/compare/page.tsx` — add diff highlighting (yellow=overlap, blue=only-A, red=only-B).
- WI4: in `lib/services/arkham.ts:46-67`, if confidence<70 call Nansen API as secondary source; cache 24h with `label_source` field.
- WI5: add `/api/share/wallet/route.ts` + Open Graph card image generation.

### Branch 15 — `feat/naka-wallet-solana-signing-and-approval-ui`
- NW1: `lib/wallet/pendingSigner.ts:188-224` `signBuiltin()` — add Solana branch: decrypt to Keypair, use `@solana/web3.js` Transaction.sign + sendRawTransaction.
- NW2: `app/api/wallet/send/route.ts:108` — extract `from` from signed tx, verify `tx.from.toLowerCase() === user.wallet_address.toLowerCase()` before broadcast.
- NW3: `@simplewebauthn/browser` integration for passkey unlock (prototype only — gate behind feature flag).
- NW4: new `app/dashboard/security/connected-dapps/page.tsx` querying AppKit's active sessions + revoke button.
- NW5: new `app/api/security/revoke-batch/route.ts` using Permit2 multicall.

### Branch 16 — `feat/security-center-health-score`
- SC1: composite 0-100 score on `/dashboard/security` — `walletReputation.score(50%) + approvalRisks.dangerCount(20%) + threatCount(15%) + honeypotsHeld(15%)`. Store in new `user_security_profile` table.
- SC2: HaveIBeenPwned API on signup + settings page — show banner if breached.
- SC3: 2FA enrollment CTA card on Security Center linking to settings.
- SC4: wire `ShadowGuardianScan.tsx` to real `/api/security/scan` (not hardcoded canned data).
- SC5: consolidate 7 pages into 5-tab Security Center (Health / Approvals / Portfolio Risk / Wallet Analysis / Connected Apps).

### Branch 17 — `feat/admin-rbac-and-cron-dashboard`
- ADM1: migration `admin_roles` table (super_admin/support/moderator/finance/read_only); `lib/auth/adminAuth.ts:35` rewrite to permission matrix.
- ADM2: TOTP (`otplib` or `speakeasy`) for admin + sessionStorage age check with 1h idle auto-logout.
- ADM3: `app/admin/cron-monitor/page.tsx` querying `cron_execution_log` + manual-trigger + pause.
- ADM4: `app/admin/feature-flags/page.tsx` generalizing the sniper kill-switch; every toggle logs to `admin_audit_log`.
- ADM6: `app/api/admin/impersonate/route.ts` issuing 10-min JWT for target user, super-admin only.

### Branch 18 — `fix/telegram-callback-handlers`
- TG1: `app/api/telegram/webhook/route.ts:55-59` — throw in production if `TELEGRAM_WEBHOOK_SECRET` missing (not silent bypass).
- TG2: at line 174-182, add `switch (action)` router for `chart:`, `holders:`, `unsub:`, etc.
- TG3: cron `telegram-retry-failures` reads `telegram_delivery_failures` table; exponential backoff 1h/24h/7d.
- TG4: pause-bot kill switch via `platform_settings.telegram_paused` boolean.
- TG5: `/myholdings`, `/pnl 7d`, `/trades 24h` commands using existing whale/portfolio data.

### Branch 19 — `feat/context-feed-sse-and-virtualization`
- CF1: replace 20s polling with `/api/context-feed/events` SSE endpoint pushing from Alchemy webhook + Dune alerts.
- CF2: wire smart_money_convergence + bridge_flow + cex_drain Dune card data (queries already exist in Dune now — IDs in §6).
- CF3: `user_preferences.muted_feed_sources` JSONB column + filter in `applyContextFilter`.
- CF4: cursor pagination `?cursor=<lastId>&limit=50` + `react-window` virtualization in render loop.
- CF5: dedup key uses FULL address not 10-char prefix.

### Branch 20 — `feat/dashboard-overview-portfolio-hero`
- OV1: above-fold portfolio total card (`$X.XX | +Y.Y% today`) on `/dashboard` fetching `/api/portfolio` (already exists).
- OV2: "What changed since last login" digest banner — compare `last_login_at` to alerts/watchlist movers in last 24h.
- OV3: widget reorder via `react-beautiful-dnd`; save to `user_preferences.dashboard_widgets`.

### Branch 21 — `a11y/focus-contrast-aria`
- A11Y1: `globals.css:271` remove `outline: none` global + add `:focus-visible { outline: 2px solid white; outline-offset: 2px }`.
- A11Y2: grep all icon-only buttons (~30+), add `aria-label`.
- A11Y3: wrap framer-motion components with `useReducedMotion()` hook (AuroraBackground, VaultEntryAnimation, ParticleField, ChamberPortal, HeroRight, OnboardingFlow).
- A11Y4: modal Escape handler + focus trap (20+ modals).
- A11Y5: tabs aria-selected + arrow key nav (WhaleDetailDrawer, VtxSettingsDrawer, ProfileTab).
- A11Y6: bump `--text-secondary #9CA3AF→#D4D9FF` (4.2→8.1:1) and `--text-muted #6B7280→#9BA3FF` (4.5→7.2:1).
- A11Y7: global `button { min-height: 44px; min-width: 44px }`.
- A11Y8: viewport-fit=cover in `app/layout.tsx:78`.

### Branch 22 — `fix/dead-code-purge`
- DEAD1: delete 30+ pure-orphan API routes (list from audit: `/api/aa/user-op`, `/api/account/login-activity`, `/admin/coingecko-usage`, `/admin/telegram/diagnose`, `/admin/newsletter`, all 5 `/admin/whales/{discover,verify,export}`, `/api/contract-ai-assessment`, etc.)
- DEAD2: delete 50+ orphan components (AlertMonitorProvider, ContextFeed [old], Predictions, MarketDashboard, VtxAiTab [old version], PlatformEventMonitor, SessionGuardProvider, SidebarMenu [old], aurora FX components)
- DEAD3: consolidate `/api/whale-tracker` + `/api/whale-activity/stream` + `/api/whale-tracker/feed` → single endpoint
- DEAD4: merge `/api/wallet-intelligence/alerts` into `/api/sniper/state`
- DEAD5: consolidate `lib/services/cluster-detection.ts` + `lib/intelligence/holderAnalysis.ts`
- DEAD7: `npm rm axios crypto-js class-variance-authority date-fns @hookform/resolvers`

### Branch 23 — `fix/landing-nav-broken-links`
- NAV1: `components/landing/LandingFooter.tsx:45,51` — use `process.env.NEXT_PUBLIC_TWITTER_URL` / `NEXT_PUBLIC_DISCORD_URL` (set in Vercel).
- NAV2: create `app/naka-cult/page.tsx` exists — verify pricing CTA at `app/dashboard/pricing/page.tsx:128` actually routes there.
- NAV3: `app/dashboard/swap/page.tsx` should exist after Branch 7; if owner wants to delete trading-suite, redirect.
- NAV4: create `app/whitepaper/page.tsx` rendering `docs/whitepaper.md`.
- NAV5: `app/terms/page.tsx:68` change `/pricing` → `/dashboard/pricing`.
- NAV6: add `app/share/[id]/not-found.tsx` + `app/token-preview/[id]/not-found.tsx`.

### Branch 24 — `feat/security-q2-roadmap`
- HIGH-5: re-auth modal (password or TOTP) before wallet export, account delete, swap >$10K — issue 5-min `recent_auth_token` cookie on re-verify.
- HIGH-6: standardize `await logAdminAction(...)` on every admin mutation route (research, announcements, email-templates, support-tickets, whale-submissions).
- C.7: `Idempotency-Key` header on `/api/sniper/execute` + `/api/copy-trading/execute` — store result + return cached on replay.
- C.5: Zod schema sweep on every route handler (currently patchy).
- D.1: RLS sweep — find any `USING (true)` policies on user-scoped tables; narrow them.

---

## §5 What owner reported as BROKEN — bug verification grid

After branches merge, owner should reproduce each:

| Owner-reported bug | Fixed in | Verify by |
|---|---|---|
| VTX sidebar duplicating "squidgrow" x8 | Branch 2 | Open VTX → sidebar shows one entry per conversation |
| `/u/Puffnutz` says user doesn't exist | Branch 2 | Visit `/u/Puffnutz` → profile loads |
| Computer fan spinning on naka-cult | Branch 3 | Open `/naka-cult` → switch tab → CPU drops via Activity Monitor |
| `/naka-cult` auto-scrolls up while reading | Branch 2 | Scroll naka-cult → page stays put |
| VTX not responding to questions | Branch 2 (logging only) | Check Vercel logs after a stuck reply — root cause now visible (`[vtxStream] completed with 0 text deltas` or `idle timeout` or `errored`) |
| Phantom mobile doesn't trigger anything | Branch 5 | Mobile: tap Phantom button → opens Phantom in-app browser |
| WalletConnect doesn't trigger sign in | Branch 5 (partial) + Branch 7 SWAP4 | Audit didn't reproduce a clear race; if still broken, file specific repro |
| NakaCult wallet flow doesn't work | Branch 6 | After cron runs once, wallets holding >=1.227M NAKA auto-promote to naka_cult tier |
| Swap doesn't work | Branch 7 (pending) | After Branch 7: selecting non-0x route in RouteComparison + Swap → tx broadcasts via that provider |
| Desktop "download wallet" prompt even when installed | Branch 5 | Desktop with Phantom extension installed → button connects, not download |
| DMs bugs (open-ended) | Branches 2 + 8 | Branch 2 fixes block-bypass + sanitizer. Branch 8 adds notifications + realtime reconnect + sort + pagination |
| Discovery / followers / following bugs | Audit found 14 findings, none broken-broken | Specific repro needed |

---

## §6 Dune query IDs (for env)

```
DUNE_API_KEY=<owner-set>
DUNE_PLAN=free
DUNE_QUERY_HOLDER_CONCENTRATION=7562459
DUNE_QUERY_SMART_MONEY=7562460
DUNE_QUERY_BRIDGE_FLOWS=7562461
DUNE_QUERY_WASH_TRADE=7562462
DUNE_QUERY_DEPLOYER_HISTORY=7562463
DUNE_QUERY_CLUSTER_AGGREGATES=7562465
DUNE_QUERY_TOKEN_AGE_BUYERS=7562466
DUNE_QUERY_SMART_MONEY_FLOW=7562467
DUNE_QUERY_STABLECOIN_PULSE=7562468
DUNE_QUERY_CEX_FLOW=7562469
DUNE_QUERY_MEV_LOSS=7562470
```

(Sequential gap at 7562464 is Dune-side, harmless.)

---

## §7 Removed from scope (do NOT work on)

Owner explicitly de-scoped these features. Do NOT audit, fix, or build:
- Predictions
- Launchpad
- Project Discovery (builders / projects)
- WGM Runner
- Leaderboard (as a standalone feature — leaderboards within other surfaces stay)
- Community page (vaporware)

---

## §8 Founder context

- Founder: Phantomfcalls / Seyifunmi (Omojuni Oluwaseyifunmi), email `Phantomfcalls@gmail.com`
- Brand: Naka Labs, NakaCult tier-gated inner ring
- Tone: casual, picture-perfect bar, MEVX / Nansen-grade
- Naka Labs is non-custodial — wallet keys stay client-side
- Founder is repeatedly burned by surface-level patches that don't fix root causes — every fix needs evidence (file:line + agent report) and prod verification
- Brutal honesty over hopium. If the audit was wrong / the fix isn't going to land cleanly / the scope is too big — say so explicitly

---

## §9 End-of-session report MUST include

1. Each item with status:
   - ✅ "Fixed and verified in production" — only after spot-check
   - ⚠️ "Fixed but pending production verification"
   - ❌ "Could not fix — [specific reason + what's needed]"
2. Branches pushed with their commit hashes + PR URLs
3. Discovered during work — bugs/opportunities found mid-task
4. Next steps for owner — what they need to do (merge order, env, migration, spot-check)

---

End of handoff. Session U begins at §4 Branch 7.
