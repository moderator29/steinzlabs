# Session L Handoff — 2026-05-15 (final, supersedes earlier L)

## 0. Read this first

Owner: Phantomfcalls / moderator29. Brand: Naka Labs (Steinz Labs codename).
Repo: `c:\Users\DELL LATITUDE 5320\Downloads\steinzlabs` — Windows; PowerShell
+ Git Bash both available. **`cd steinzlabs` first** — the default cwd
Claude Code lands in is the parent folder, NOT a git repo.

**Required reading before any multi-section work:**
1. `docs/sessions/HANDOFF-session-K.md` §0z (environment) and §0a (the
   full ruleset). Still authoritative.
2. `CLAUDE.md` — committed ruleset. Re-read if any item below is unclear.
3. `docs/audits/audit-recommendations-2026-05-15.md` — the 18-audit
   consolidated rollup (P0/P1/P2 per area with file:line refs +
   effort hours).
4. This file.

**Quick environment confirm**
- Remote: `https://github.com/moderator29/steinzlabs` — push works, HTTPS
  creds cached. `gh` CLI is NOT installed and that's intentional. Branch
  + push + STOP. Owner opens the PR.
- MCP servers used this session: Supabase
  (`phvewrldcdxupsnakddx`). Vercel disconnected mid-session — only used
  for read-only deploy log spot-checks, fine to omit.
- Identity must be `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- Never reference Claude / Anthropic / model names in code or commit messages.

---

## 1. Branches shipped this session (15)

All pushed to GitHub, all typecheck-clean, all unmerged. Owner opens PRs
in the GitHub UI and merges in suggested order.

| # | Branch | What |
| --- | --- | --- |
| 1 | `fix/p0-cross-cutting-solana-case-fifo-hygiene` | Solana case fixes across portfolio + clusters + sniper criteria + wallet-intel; FIFO cross-chain key on `app/api/portfolio/performance/route.ts:95`; sniper `console.error → Sentry`; `apiCost.ts any → unknown`; portfolio fail-open swallows replaced with Sentry capture |
| 2 | `fix/p0-security-goplus-failclose-solana-endpoint` | `simulateTransaction` fails CLOSED with `riskLevel:'UNKNOWN'` instead of `MEDIUM`; `scanTokenSecurity` branches on chain so Solana uses `/solana/token_security/?contract_addresses=` with new `parseSolanaTokenSecurity` for the nested-status payload |
| 3 | `security/p0-prompt-injection-and-auth-gates` | `withTierGate('pro')` on `/api/bubble-map`, `/api/dna-analyzer`, `/api/dna-analysis` (all unauth'd before); `sanitizeForPrompt` / `sanitizeSymbol` / context-field sanitization in VTX, bubblemap-agent, DNA prompt sites; `vtxAnalyze` null → degraded stub |
| 4 | `refactor/p0-clusters-by-id-edge-chunking` | `.or()` truncation on `/api/clusters/by-id/[id]` — chunks the address list into batches of 50, parallel `.in()` queries per chunk, dedupes by edge identity, caps at 500 |
| 5 | `security/p0-eip4361-siwe-message` | EIP-4361 SIWE for EVM + Phantom-shape SIWS for Solana via `lib/auth/siwe.ts` (single `buildSiweMessage` used by issuer + verifier so bytes match); domain + URI + chainId now part of signed payload; back-compat fallback for legacy nonce rows |
| 6 | `chore/dead-code-sweep-clusters-context-feed` | Deleted unscheduled `/api/cron/context-feed-poll`. Other audit "dead candidates" still wire to legacy `/dashboard/wallet-clusters/[address]/page.tsx` and are NOT safe to delete without migrating that page first |
| 7 | `feat/proof-inline-swap-card` | Proof modal Buy expands the same `components/vtx/SwapCard.tsx` VTX AI uses, in-place — no more `router.push` to `/dashboard/swap`. `buildProofSwapData()` builds the SwapCardData payload from the context-feed event |
| 8 | `feat/whale-copy-this-whale-button` | Whale-tracker `/[address]` Copy tab — replaced static "go to /copy-trading" message with a Copy this whale CTA that opens the existing `NewCopyRuleModal` pre-filled with the whale's address + chain |
| 9 | `fix/p0-proof-event-zod-validate` | Zod schema validates the `steinz_proof_event` sessionStorage payload before render. Bounded text fields (id≤128, title≤280, summary≤2000) with HTML-stripping transform; `safeUrl` enforces http(s); numerics are zod-finite; `safeParse` on read so a malformed event falls through to the existing "Event not found" screen instead of XSS-rendering it |
| 10 | `feat/compliance-cookie-consent-first-trade-modal` | `components/legal/CookieConsent.tsx` (glass banner, Essential/Accept-all, persists choice + dispatches `naka:cookie-consent-changed` event for downstream gating); `components/legal/FirstTradeRiskModal.tsx` (one-time required-checkbox-then-confirm before first swap, wired into `InlineBuySellForm.tsx` submit gate) |
| 11 | `feat/sniper-live-badge-pulse-on-fill` | Pulsing emerald Live / muted Offline pill next to the sniper History tab driven by `liveConnected`; pulse-on-fill animation on freshly-inserted execution rows (tracked via Set, 2.4s `naka-pulse-fill` keyframes via styled-jsx) |
| 12 | `fix/bubble-map-chain-explorer-and-tooltips` | Replaced hardcoded Solscan in WalletPanel with `explorerForChain(chain, addr)` (Solana / Ethereum / BSC / Polygon / Base / Arbitrum / Optimism / Avalanche; label updates to match); added native SVG `<title>` hover tooltips on D3 nodes with name + entity + type + holdings + address + verified + scammer flag |
| 13 | `feat/profile-bio-socials-fields` | Settings → Profile: 280-char Bio textarea with live counter + Twitter / Discord / GitHub handle inputs. Persists to Supabase auth `user_metadata` via the existing `updateUser({ data })` path; `cleanHandle()` strips leading `@`. No migration. |
| 14 | `chore/migration-context-feed-engagement-sql` | Mirrors the `context_feed_engagement` migration into `supabase/migrations/` for repo parity. **The migration was applied to prod this session** (see §2). The route refactor is queued; see §5 below. |

### Suggested merge order

1. `fix/p0-cross-cutting-solana-case-fifo-hygiene` (data integrity, no UI risk)
2. `fix/p0-security-goplus-failclose-solana-endpoint`
3. `security/p0-prompt-injection-and-auth-gates`
4. `refactor/p0-clusters-by-id-edge-chunking`
5. `fix/p0-proof-event-zod-validate`
6. `chore/dead-code-sweep-clusters-context-feed`
7. `chore/migration-context-feed-engagement-sql` (DB already applied; merging makes the SQL canonical in repo)
8. `security/p0-eip4361-siwe-message`
9. `feat/compliance-cookie-consent-first-trade-modal`
10. `feat/sniper-live-badge-pulse-on-fill`
11. `fix/bubble-map-chain-explorer-and-tooltips`
12. `feat/profile-bio-socials-fields`
13. `feat/proof-inline-swap-card`
14. `feat/whale-copy-this-whale-button`

---

## 2. Supabase migrations applied to prod (`phvewrldcdxupsnakddx`)

Three migrations applied via `mcp__supabase__apply_migration` this
session with explicit owner authorization. All three are additive +
NULL-safe, no breaking changes.

| Migration | Adds | Why |
| --- | --- | --- |
| `notification_quiet_hours` | 6 columns on `public.notification_settings` (`email_enabled`, `telegram_enabled`, `quiet_hours_enabled`, `quiet_hours_start_minute`, `quiet_hours_end_minute`, `quiet_hours_timezone`) | Unblocks the Phase B notification panel that had been hiding those fields with "Pending — apply migration" since session K |
| `auth_wallet_nonces_chain_id` | `chain_id integer NULL` + `issued_at timestamptz NULL` on `public.auth_wallet_nonces` | Required by branch 5 (SIWE) so the verify route can reconstruct the exact signed bytes. Legacy nonce rows keep working (verify-side has a 5-minute back-compat fallback) |
| `context_feed_engagement` | New `public.context_feed_engagement` table (id / event_id text / user_id uuid nullable FK to auth.users ON DELETE SET NULL / action text CHECK in view/like/share/comment / created_at) + RLS (insert own-or-anon, delete own, select public) + unique index on (event_id, user_id, action) WHERE user_id IS NOT NULL | Replaces in-memory Map in `/api/engagement/route.ts` (counters were wiped on every Vercel redeploy). Route refactor pending — see §5 |

SQL files mirrored into `supabase/migrations/`:
`2026_05_15_notification_quiet_hours.sql`,
`2026_05_15_auth_wallet_nonces_chain_id.sql`,
`2026_05_15_context_feed_engagement.sql`.

---

## 3. Audit residuals from shipped branches

Issues found while re-reading diffs after push:

- **`app/api/clusters/by-id/[id]/route.ts:41,51`** — branch 4 chunked
  the edge query but the member-address comparison still uses
  `.toLowerCase()`. For Solana clusters this drops members. Fix in a
  cluster P1 follow-up using `normalizeAddress` consistently with
  `lib/clusters/detection.ts` (which branch 1 fixed).
- **Branch 6 dead-code sweep** — only deleted 1 file. Three more
  candidates flagged by the audit (`lib/jobs/cluster-detection.ts`,
  `components/clusters/Cluster2DGraph.tsx`,
  `app/api/clusters/by-address/[address]/`) still back the legacy
  `app/dashboard/wallet-clusters/[address]/page.tsx`. Pick a single
  canonical cluster surface (`/[id]` vs `/[address]`), migrate the
  legacy page, then delete the duplicates.
- **`app/dashboard/proof/page.tsx:51-107`** —
  `BubbleVisualization` still generates fake deterministic-seeded
  holder percentages and labels them "Powered by on-chain data".
  CLAUDE.md "no fabricated values" violation. Branch 7 scoped to the
  Buy CTA replacement; branch 9 scoped to Zod validation. Fix:
  either fetch real holders from `/api/bubble-map` (now tier-gated)
  OR add a "Simulated" badge + disclaimer.
- **Branch 13 (profile bio/socials)** persists to `user_metadata`,
  not a `profiles` table. Fine for the settings page itself, but
  public-profile / hover-card consumers will need to read from the
  same place. If the audit's "queryable profile" path is taken in a
  follow-up, migrate display_name + bio + socials into
  `public.profiles` together with `avatar_url`.

---

## 4. Things NOT to do (carry-forward from session K + new)

- **Don't apply Supabase migrations without explicit owner approval per
  migration.** Three migrations had explicit go-aheads this session.
  Any new one needs a fresh "approve the X migration" before running
  `mcp__supabase__apply_migration`.
- **Don't force-push to existing PR branches** unless owner asks.
- **Don't delete the legacy `/dashboard/wallet-clusters/[address]/`
  page or its supporting files** until the functionality has been
  migrated to `/[id]` and confirmed at parity. They look like
  duplicates but they're load-bearing.
- **Don't reference Claude / Anthropic / model names** in commit
  messages or code comments. Use neutral language ("external AI
  synthesis call", "model-based analysis").
- **Don't bypass the cookie consent / first-trade modal gating** in
  any new trade-execution path. The compliance MVB lives in those two
  components; any new buy/sell surface must call
  `hasAcknowledgedTradeRisk()` from
  `components/legal/FirstTradeRiskModal.tsx` before signing.
- **Don't reintroduce `.toLowerCase()` on raw addresses.** Use
  `normalizeAddress(addr, chain)` from `lib/utils/addressNormalize.ts`.
  Branch 1 closed the worst sites; new code must follow.

---

## 5. Deferred work — concrete specs for the next session

These items have full scope, file:line refs, and effort sizing in
`docs/audits/audit-recommendations-2026-05-15.md`. Listed here with the
extra detail accumulated this session.

### 5.1 Engagement route refactor (small — finishes branch 14)

**Status**: Migration `context_feed_engagement` is applied to prod
(this session) + mirrored to `supabase/migrations/`. The
`/api/engagement/route.ts` route still reads/writes the in-memory
Map and needs to be flipped to the table.

**Plan**:
1. New branch `feat/engagement-route-supabase`.
2. Cut `/api/engagement/route.ts` to use the user's session client
   (read `cookies()` via `next/headers` + `createServerClient` —
   pattern already used in `app/api/whales/follow/route.ts`).
3. POST handler:
   - Validate body with Zod (`{ eventId: string max 128, action:
     'view'|'like'|'unlike'|'share' }`).
   - `unlike` → `DELETE` from `context_feed_engagement` WHERE
     event_id = $1 AND user_id = auth.uid() AND action = 'like'.
   - `view|like|share` → `INSERT ... ON CONFLICT (event_id,
     user_id, action) DO NOTHING` (the unique index makes views +
     likes idempotent; anon view rows are allowed to repeat).
   - Return the fresh aggregated counts so the optimistic-update
     client gets confirmation in one round trip.
4. GET handler: `select action, count(*) from context_feed_engagement
   where event_id = $1 group by action`. Map into the existing shape
   `{ views, likes, shares, comments }`.
5. Wrap both handlers in a try/catch. On DB error, log to Sentry +
   return zeros (NOT the in-memory Map — the audit's "no fabricated
   values" rule applies; better to show 0 than an unreliable count).
6. Delete the `engagementStore` Map + `userActions` Set at the top of
   the file — they're dead after the cut-over.
7. Verify by tapping like/view on a few context-feed cards and
   confirming the counts persist across a Vercel redeploy.

**Effort**: ~1.5h.

### 5.2 Trade-exec P1 (MEV toggle + quote re-fetch + Permit2)

See `docs/audits/audit-recommendations-2026-05-15.md` §11 + §10. Split
into 3 small branches:

- **MEV toggle on `InlineBuySellForm.tsx`** (~2h) — checkbox next to
  the slippage row; persist per chain in localStorage like slippage
  does. POST `/api/market/trade/execute` already accepts `slippage`;
  extend it with `mevProtect: boolean` then route to the existing
  sniper-engine MEV adapter when truthy. Sniper has it; just plumb.
- **Quote staleness + re-fetch** (~2h) — on the swap page (`app/
  dashboard/swap/page.tsx`), track a `quoteIssuedAt` timestamp; if
  the user hits Sign and the quote is >10s old, re-fetch first; if
  the new quote's output drifts >slippage threshold, abort with a
  toast asking the user to confirm. Audit notes the gap at sniper
  engine line 22 (30s validity hardcoded).
- **Permit2** (~3h) — `lib/services/zerox.ts` — query the token for
  Permit2 support; if available, include `permit` calldata in swap
  tx instead of a separate `approve` tx. Halves gas + clicks.

### 5.3 VTX AI P1 (markdown + stop + copy + regenerate)

See audit §5. One bigger branch worth doing carefully:

1. Install `react-markdown` + `remark-gfm` (already in audit P1 list).
2. Replace the regex-strip at `components/VtxAiTab.tsx:1141` with
   `<ReactMarkdown remarkPlugins={[remarkGfm]} components={{...}}>`.
   Tables, code blocks (with syntax highlight via
   `react-syntax-highlighter` or `shiki`), lists, links.
3. Streaming caret — render an animated `▌` cursor while the SSE
   stream is open.
4. Stop button — wire `AbortController` into the existing fetch
   start; expose via a small ⏹ icon next to the input.
5. Copy message + copy-as-markdown — icons on each assistant message.
6. Regenerate — button that re-POSTs the last user message with same
   `context`.
7. Edit-and-resend — pencil icon on user messages, opens inline
   editor + a Resend button.

**Effort**: ~10h. Worth a focused half-day in a fresh session.

### 5.4 Onboarding P0 (Joyride + post-verify + digest + empty-states)

See audit §6 (onboarding agent). Four small branches:

- **First-run tour** (~4h) — install `react-joyride`; add a 3-step
  tour (connect wallet → set first price alert → explore whale
  tracker) on first dashboard visit. Hide flag in `localStorage.naka_tour_done`.
- **Post-verify funnel page** (`/onboarding/complete`, ~2h) — three
  micro-CTAs after email verification: connect wallet, join Telegram,
  bookmark support. Better conversion than dumping users on the bare
  dashboard.
- **Real `notification-digest` cron** (~3h) — body is a stub today;
  wire it to email users with active alerts a weekly summary using
  `lib/email.ts`.
- **Empty-state CTAs** (~3h) — portfolio holdings empty / sniper no
  rules / watchlist empty / alerts empty all show useful CTAs
  instead of "No data" text. Add a reusable
  `components/dashboard/EmptyStateCta.tsx`.

### 5.5 NAKA wallet unification (architectural — schedule a full session)

The wallet-flow audit found 4 different `localStorage` keys reading
"current address" + 3 different chain-selection mechanisms across
Portfolio / Swap / VTX / Sniper / Whale. **Don't ship in chunks** —
the value comes from doing all consumers in one PR so the contract
flips atomically. Concrete spec:

1. New `lib/hooks/useNakaWallet.ts` exposing `{ address, chain,
   balance, provider, isBuiltIn, vtxAccessGranted, chainId,
   walletPlatformChain }`.
2. `WalletContextProvider` wrapping `app/dashboard/layout.tsx`. Reads
   from one source (localStorage with Supabase fallback), broadcasts
   on `'steinz:balance-changed'` and `'steinz_wallet_changed'`.
3. Migrate consumers — portfolio page, swap page, VTX, sniper,
   whale, proof modal — to `useNakaWallet()`. Delete the
   `localStorage.getItem('wallet_address')` direct reads.
4. Persistent wallet pill in dashboard top bar (chain icon + address
   + balance + VTX-access status).
5. Enforce the VTX wallet-access toggle server-side in
   `app/api/vtx-ai/route.ts` — when `user_preferences.vtx_wallet_access
   = false`, null the `walletAddress` in the system-prompt context AND
   reject `prepare_swap` tool calls.

**Effort**: ~12-16h. Schedule a fresh session for this; it's the
biggest blocker to the "one wallet everywhere" feel the platform
needs.

### 5.6 Portfolio P1 (multi-wallet + NFT + DeFi + sortable + CSV)

See audit §1 P1. Four discrete branches:
- Multi-wallet aggregation route + multi-select UI (~4h).
- NFT tab via Alchemy `getNFTs()` + OpenSea floor (~4h).
- DeFi positions tab via Zerion `position_type=deposit/staked` (~4h).
- Koinly-schema CSV export (~3h).
- Sortable `HoldingsTable` cols + watchlist+spam filter (~3.5h).

### 5.7 Cluster P1 (risk_score + entity_registry + decay + provenance)

See audit §10. Needs a migration for `wallet_clusters.risk_score
numeric` + new `entity_registry` + `cluster_label_audit` tables.
Plan the migration carefully (per-session owner approval).

### 5.8 Security stack P1 (source triangulation + pre-sign simulate + LP lock duration + deployer rug history)

See audit §4. Each one is its own small branch (~2-6h). Honeypot.is +
de.fi + RugCheck triangulation is the biggest unlock.

### 5.9 SEO P0 (locale + sitemap + robots + per-token OG)

See audit §15. `app/[locale]` segment is a heavy migration — touches
every dashboard route. Plan a full session for this one (~8-12h).

### 5.10 UI 2030 sweep (single PR across all dashboards)

See audit §20. Glass cards, animated counters, skeleton loaders,
command palette ⌘K, AAA-contrast pass (`text-slate-500 / 600` → `300
/ 400` everywhere on slate-950 backgrounds), spring easing,
focus-visible rings, sparklines. ~10-15h, single PR so the visual
language stays consistent.

### 5.11 Observability (pino logger + Sentry capture sweep + retry wrapper + sampler)

See audit §observability. Replace the 162 `console.*` calls across 78
routes with a structured `pino` logger; add `Sentry.captureException`
to the 18 silent `.catch(() => {})` blocks; wrap external API calls
in a retry helper; add a per-route Sentry `tracesSampler` to cut cost
40-60%. ~15h, mechanical, can be split into 3 PRs.

### 5.12 Dependency CVE remediation

32 open Dependabot vulnerabilities (10 high, 19 moderate, 3 low).
- `npm audit fix` for the moderate / low ones first.
- Manually review the 10 high — most are likely transitive. Bump the
  parent if possible.
- Then flip `.github/workflows` `npm audit --audit-level=high` from
  `continue-on-error: true` to `false` so future CVEs block PRs.

---

## 6. How to start the next session

1. **Open VS Code in the repo**: `cd c:\Users\DELL LATITUDE 5320\Downloads\steinzlabs`
2. **Re-read these three files** (in order):
   - `docs/sessions/HANDOFF-session-K.md` (env + ruleset)
   - `docs/sessions/HANDOFF-session-L.md` (this file)
   - `docs/audits/audit-recommendations-2026-05-15.md` (full audit
     rollup with file:line refs)
3. **MCP**: Supabase (`phvewrldcdxupsnakddx`) is the only must-have.
   Vercel is optional (used for deploy log spot-checks only).
4. **Pull main first**: `git checkout main && git pull --ff-only` —
   the owner may have merged the 14 PRs from this session, and
   you want to branch from the new tip.
5. **Pick a deferred item from §5** and run it. Each one is sized +
   spec'd. Suggested next order: §5.1 (engagement route, ~1.5h) → §5.5
   (NAKA wallet unification, full-day) → §5.3 (VTX P1, ~10h).
6. **Branch + push + STOP**. The owner opens the PR. No `gh pr create`.

---

## 7. What this session did NOT ship and why

- **NAKA wallet unification (§5.5)** — needs a full session, not a
  rushed chunk. The contract flip has to be atomic across 6 consumers.
- **Trade-exec P1 (§5.2)** — split into 3 branches; medium complexity
  on quote-staleness timing logic; better to plan than rush.
- **VTX AI P1 markdown + stop + copy + regenerate (§5.3)** — touches
  the chat component deeply; deserves its own focused window.
- **Onboarding P0 (§5.4)** — 4 sub-branches across pages; needs UX
  consistency review before shipping piecemeal.
- **UI 2030 sweep (§5.10)** — single big PR for visual consistency;
  not a chunkable item.
- **SEO P0 (§5.9)** — `app/[locale]` migration touches every route;
  full-session work.
- **Observability (§5.11)** — mechanical but 78-file sweep; plan 3
  PRs.

The 14 PRs that did ship are the highest-leverage P0 (security /
correctness / compliance) + the two user-requested user-visible
features (proof inline SwapCard, Copy this whale button) +
foundational UI improvements (sniper live badge, bubble map chain
explorer, profile bio/socials). The deferred work is sized so the
next session can hit a specific item from §5 and ship it cleanly
instead of inheriting half-shipped work.
