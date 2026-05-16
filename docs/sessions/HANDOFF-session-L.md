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

---

# APPENDIX A — FULL CLAUDE.md RULESET (reproduced verbatim so next session can't miss anything)

These rules are enforced on every commit. The canonical source is
`CLAUDE.md` at the repo root — re-read it before any commit.

## Git identity (STRICT)
- All commits must be authored as `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- If `git config user.name` shows anything else, set it before committing:
  ```
  git config user.name "moderator29"
  git config user.email "101205446+moderator29@users.noreply.github.com"
  ```

## Forbidden in commit messages
Never include any of:
- `Co-Authored-By: Claude <noreply@anthropic.com>` or any AI co-author trailer
- `🤖 Generated with Claude Code`
- `Generated with Claude Code` / `Generated by Claude`
- `AI-assisted` / `AI assisted`
- Any other phrase indicating AI involvement

## Forbidden in code, comments, docs, READMEs, PR descriptions
Never include any of:
- "Generated by Claude" or any variant
- "AI-generated" or any variant
- "Built with Claude Code"
- Comments referencing Claude / Anthropic / specific model names by name
- Auto-generated header blocks attributing AI

Neutral language allowed: "external AI synthesis call", "model-based analysis", "LLM-backed", "agent".

## Branch naming (STRICT)
- **Forbidden prefixes:** `claude/`, `ai/`, `claude-code/`.
- **Use functional prefixes:** `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `style/`, `perf/`, `security/`.

## Branching & merging
- **Never commit to `main`.** Owner (`Phantomfcalls` / `moderator29`) is the only one who merges to `main`; Vercel auto-deploys from `main`.
- Always cut feature branches from a freshly pulled `main`:
  ```
  git checkout main && git pull --ff-only && git checkout -b <branch>
  ```
- **Push the branch and STOP.** Do not open the PR via `gh`. Owner opens the PR in the GitHub UI and merges.

## Commit message format
Use Conventional Commits exclusively:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code restructuring without behavior change
- `chore:` maintenance, dependencies, tooling
- `docs:` documentation
- `test:` tests
- `style:` formatting only
- `perf:` performance improvement
- `security:` security fix

## Code style
- **No `any` types** in TypeScript unless absolutely necessary (and document why).
- **No `console.log`** in production code (use a logger / Sentry).
- **No commented-out code** (delete it; git remembers).
- **No empty `try/catch`** blocks.
- **All functions over 50 lines** need a brief docstring.
- **Match existing code style** — don't introduce new patterns without reason.
- **Use `lib/utils/addressNormalize.ts`** for all address comparisons. **Never call `.toLowerCase()` directly on a wallet/token address** — Solana is case-sensitive.

## Mock data — FORBIDDEN
This is a production trading platform. **Never introduce mock / fake / demo data, hardcoded sample wallets, or stubbed API responses.** Wire to real APIs (CoinGecko, Alchemy, Helius, GoPlus, Jupiter, 0x, Anthropic, Supabase). If data is unavailable, return an empty state with an error, never fabricated numbers.

## Documentation
- Update `/docs/` whenever a feature changes meaningfully.
- Update `README.md` when adding major features or changing setup steps.
- Update `CHANGELOG.md` for every release.

## Security
- **Never commit secrets, API keys, or credentials.** `.gitignore` blocks `.env*` and `.vercel/` — do not work around it.
- **Never log sensitive data** (private keys, seed phrases, passwords, raw JWTs). Sentry's `beforeSend` already scrubs cookies — extend it if you add new sensitive paths.
- **Server-side validate everything** — never trust client validation alone.
- **Supabase:** prefer `apply_migration` via MCP and mirror the SQL into `supabase/migrations/` for repo parity. Never bypass RLS via `service_role` from a client-callable endpoint without explicit user-id binding.
- Reference `SECURITY.md` for the full security policy.

## Supabase schema gotchas (verified live, easy to get wrong)
- `whales.label` (NOT `whales.name`)
- `price_alerts.price` (NOT `price_alerts.target_price`)
- `user_wallets_v2.wallets` is JSONB — addresses live inside the JSON; `default_address` is separate.
- **Always verify column existence** via `mcp__supabase__list_tables` or `execute_sql` — migration files can be stale; past audits flagged false-positive "missing column" claims by reading old migrations.

## Required reading before multi-section work
- `docs/sessions/HANDOFF-session-A.md` through `HANDOFF-session-L.md` (this file)
- `docs/cleanup-2026-05/audit-findings.md` (12-agent §1 audit)
- `docs/audits/audit-recommendations-2026-05-15.md` (this session's 18-audit consolidated rollup)
- `CLAUDE.md` (canonical source — re-read if unclear)

## Tone & workflow with owner
- Casual tone. Owner says "go" / "yes do this" — ship without re-asking.
- "Todo list" from owner = FULL backlog in plain English, then he picks.
- "Don't stop" / "do everything" = autonomous mode. Pick reasonable defaults, don't pause for clarification.
- Tell the truth about what shipped vs what didn't. Don't claim "done" unless verified on disk.

## NAKA token (gating)
- ETH-only, contract `0x6967b9a8c0b14849CFE8f9E5732B401433fD2898`.
- Gating threshold: `1,227,000` tokens.
- NFT contracts not yet minted.

## Brand
- W image is COLOR / branding ref only — NOT a logo.
- The 3 glowing icons (rocket / helmet / pentagon) are the platform icon style and map to Conclave / Oracle / Sanctum chamber portals.

## New rules added this session (carry forward)
- **Don't reintroduce `.toLowerCase()` on raw addresses** — branch 1 closed the worst sites; use `normalizeAddress(addr, chain)` everywhere.
- **Don't bypass the cookie-consent / first-trade modal gating** — any new buy/sell surface must call `hasAcknowledgedTradeRisk()` from `components/legal/FirstTradeRiskModal.tsx` before signing.
- **Don't reference Claude/Anthropic/Sonnet/Opus/Haiku by name** in commit messages or code comments.
- **Don't apply Supabase migrations without explicit per-migration owner approval.** Three migrations had explicit go-aheads this session; any new one needs a fresh "approve the X migration".
- **Don't delete the legacy `/dashboard/wallet-clusters/[address]/` page** or its supporting files (`lib/jobs/cluster-detection.ts`, `components/clusters/Cluster2DGraph.tsx`, `/api/clusters/by-address/[address]/`) until the functionality has been migrated to `/[id]` and confirmed at parity. They look like duplicates but they're load-bearing.
- **Don't force-push** to existing PR branches unless owner asks.

---

# APPENDIX B — EVERY REMAINING WORK ITEM (post 15-PR ship state)

Per-area enumeration of everything `docs/audits/audit-recommendations-2026-05-15.md` flagged that the 15 PRs did NOT close. Effort estimates carried from the audit. Strike-through where the 15 PRs closed it.

## B.1 Portfolio

### P0 (still remaining)
- ~~Solana `.toLowerCase()` violations~~ — closed by PR #1.
- ~~Cross-chain FIFO key bug~~ — closed by PR #1.
- ~~Fail-open swallow~~ — closed by PR #1.

### P1 industry-parity (all remaining)
- **Multi-wallet aggregation** — `/api/portfolio/aggregate` + multi-select UI. **4h**
- **NFT tab** — Alchemy `getNFTs()` + OpenSea floor; new `/api/portfolio/nfts` route + tab. **4h**
- **DeFi positions tab** — parse Zerion `position_type=deposit/staked` for Aave/Curve/Uni LP; new `/api/portfolio/defi-positions`. **4h**
- **CSV export (Koinly schema)** — `/api/portfolio/export/csv` streaming with tx_hash, date, buy/sell asset, cost_basis, realized_pnl. **3h**
- **Sortable HoldingsTable columns** — `HoldingsTable` (line 516–627) hardcoded; needs `useState<SortKey>` + clickable headers. **1.5h**
- **Watchlist + spam-token filter** — surface existing GoPlus risk into a "Hide spam" toggle. **2h**

### P2 UI 2030 (all remaining)
- Glass hero + parallax on totalValueUsd card. **1h**
- Animated counter (framer-motion `useSpring`) for $ total. **0.5h**
- Skeleton loaders (replace "Loading holdings…" text). **1h**
- AAA contrast: `text-slate-500 / 600` → `text-slate-300 / 400`. **0.5h**
- Sparkline per row (recharts `AreaChart` 20px height, no axes). **2h**
- Command palette ⌘K with portfolio actions. **3h**

## B.2 Sniper Bot

### P0 (still remaining)
- ~~`console.error` violations~~ — closed by PR #1.
- ~~`any` type in apiCost.ts~~ — closed by PR #1.
- ~~Wallet addresses not canonicalized~~ — closed by PR #1.

### P1 (mostly remaining)
- ~~Live-status badge~~ — closed by PR #11.
- **Dev-wallet auto-block** — extend GoPlus check to block criteria when creator address matches top-N holders. **2h**
- **Pre-flight dry-run** — `eth_call` (EVM) / `simulateTransaction` (Solana) before execute; log to `sniper_match_events.details.dryRunResult`. **3h**
- **Anti-rug auto-sell triggers (LP-pulled, dev-dump)** — listen to LP events, fire auto-sell. **4h**
- **Copy-trade execution cron** — `user_copy_rules.copy_mode = 'auto_copy'` rows have no cron firing trades; new `/api/cron/copy-trades-monitor`. **5h** (also closes the whale audit's "copy-trade NOT live" gap)
- **Telegram integration** — wire criteria → `/api/telegram/webhook` for pre-execution notifs + reaction veto. **3h**
- **Risk dashboard per snipe** — max-loss USD, max-gas USD, kill-switch reason in History row. **3h**

### P2 UI 2030
- ~~Pulse-on-fill animation~~ — closed by PR #11.
- **Command palette `/snipe <token>`** — wire into `GlobalSearch.tsx`. **4h**
- **Live tape ticker** (left rail real-time fills, colored by P&L). **3h**
- **Tip-strategy auto-bid** (Jito/Flashbots dynamic). **2h**

## B.3 Auth wallet-connect

### P0
- ~~EIP-4361 SIWE / chain-ID binding~~ — closed by PR #5.

### P1 (all remaining)
- **Coinbase Wallet SDK native** — `@coinbase/wallet-sdk` (~50KB) wired into AppKit's `WagmiAdapter`. Touches `lib/wallet/appkit.ts:62-67`. **2h**
- **Trust Wallet direct** — extend AppKit. **1h**
- **Backpack + Glow (Solana alt wallets)** — extend SolanaWalletAuthButton to detect + offer. **2h**
- **Wallet detection + recommendation** — scan `window.ethereum` / `window.solana` / `window.coinbaseWallet` on mount; pin to top of modal. **3h**
- **Email + social broadening** — Magic Link or Web3Auth (Twitter/Discord/Apple/Google). **8h**
- **Passkey / WebAuthn** — Coinbase Smart Wallet / Privy seedless style. **8h+** (deferred — multi-day)

### P2 UI 2030
- Glass modal with `backdrop-blur(24px)`, `rounded-2xl`, soft shadow. **1h**
- Animated wallet logos (3D rotate on hover). **1h**
- "Detected" green badge when injected provider present. **0.5h**
- "Recent wallet" pinning row. **1h**
- Inline network-switch CTA on wrong chain. **1h**

## B.4 Security stack (GoPlus / SecurityGate)

### P0
- ~~`simulateTransaction` fails OPEN~~ — closed by PR #2.
- ~~Solana endpoint mismatch~~ — closed by PR #2.
- **`portfolio-risk/route.ts:53` LP lock coercion** (`String(h.is_locked) === '1'`). **0.25h** — wasn't shipped this session.

### P1 (all remaining)
- **Source triangulation** — add Honeypot.is + de.fi Scanner + RugCheck (Solana) with 3-source voting. New `lib/security/triangulate.ts`. **6h**
- **Pre-sign simulation in SecurityGate** — `components/security/SecurityGate.tsx:172–190` add lazy "Simulate" button. **2h**
- **LP lock duration** — fetch Team Finance / Unicrypt unlock timestamp via Etherscan/Blockscout; surface in SecurityPanel facts. **3h**
- **Deployer rug history** — Arkham entity lookup on creator + owner addresses. **2h**
- **Bundled-supply detection** — % sniped in first N blocks by single entity. **4h**
- **Tax simulation (1-wei eth_call)** — surface actual vs claimed tax delta. **3h**
- **Top-3 holder labels** (CEX / LP / dev / whale) — Arkham labels into SecurityPanel. **2h**

### P2 UI 2030
- Source-triangulation badge stack (3 badges, hover = "3/3 agree = high confidence"). **1h**
- Animated severity bar (left-to-right fill, color-graded 0–100). **1h**
- Expandable findings drawer with mitigation copy + "Simulate sell" button. **2h**

## B.5 VTX AI

### P0
- ~~Prompt injection (context allow-list)~~ — closed by PR #3.

### P1 (all remaining)
- **Real markdown render** — replace regex strip at `VtxAiTab.tsx:1141` with `react-markdown` + `remark-gfm` (tables, code blocks, syntax highlight). **2h**
- **Streaming caret** — animated `▌` cursor while tokens arrive. **0.5h**
- **Visible tool calls during stream** — emit `{type:'tool_start', name, args}` events; collapsed cards in UI. **3h**
- **Stop-generation button** — wire `AbortController` into fetch + UI. **1h**
- **Copy message + copy-as-markdown** — buttons on assistant messages. **0.5h**
- **Regenerate response** — re-POST last user message with same context. **1h**
- **Edit-and-resend** — pencil icon on user message, opens inline editor. **2h**
- **Citations (Perplexity-style)** — when tools return URLs/sources, show numbered footnotes with hover preview. **3h**
- **Model picker** — Sonnet / Opus / Haiku toggle. **1h** (use neutral labels in UI: Fast / Balanced / Deepest)
- **Suggested follow-ups** — emit 3 questions in done event; render as pills. **1.5h**

### P2 UI 2030 (per-feature spec)
- Glass message bubbles (`backdrop-blur-xl border border-white/5`). **0.5h**
- Gradient streaming cursor (blue→purple). **0.25h**
- Animated tool-call cards with fade-in. **1h**
- Char-by-char (20ms/char) with blinking cursor, hold-to-reveal-all. **2.5h**
- Token cards in-message: scale-up 0.8→1, 300ms spring; hover shadow + border shift. **1.5h**
- Tool-call cards: slide-left + fade 250ms; auto-highlight inputs w/ border glow 100ms delay. **2h**
- Conversation sidebar: hover bg shift + truncated tooltip; click scrolls main + previous-messages fade-out 200ms. **2h**
- Settings drawer: slide-in right 300ms cubic-bezier. **1.5h**
- Suggestion pills: stagger-fade 50ms apart; hover scale 1.02 + glow. **1h**

## B.6 Profile / settings / notifications

### P0
- ~~Apply pending notification quiet-hours migration~~ — applied this session (§2).
- ~~Bio + Twitter/Discord/GitHub fields missing~~ — closed by PR #13.
- **Avatar upload missing** — schema has `avatar_url` but no UI. Add Supabase Storage bucket + uploader. **3h**

### P1 (all remaining)
- **2FA: TOTP + WebAuthn** — `@oslojs/otp` + `@passwordless-id/webauthn`. **8h** (deferred — multi-day)
- **Active sessions revocation** — "Sign out this device" + "Sign out everywhere" buttons on `login_activity` rows. **3h**
- **Device naming** — parse user agents into "Chrome on macOS" labels. **1h**
- **GDPR data export** — POST `/api/account/export` returns JSON archive. **3h**
- **Soft-delete with 30-day grace** — flag account, cron purges after 30 days. **3h**
- **API keys with scopes** — generate + last-used timestamps. **6h**

### P2 UI 2030
- Segmented toggle group for channels (Linear-style). **1h**
- Sentry breadcrumbs on preference saves. **0.5h**
- "Test email" button alongside existing "Test push". **0.5h**
- Auto-detect timezone + lazy-load IANA list. **0.5h**
- Animated channel badges (push/email/telegram dots). **0.5h**

## B.7 Bubble map + agent

### P0
- ~~`/api/bubble-map` tier gate~~ — closed by PR #3.
- ~~Prompt injection (token name/symbol)~~ — closed by PR #3.
- ~~Hardcoded Solscan explorer~~ — closed by PR #12.

### P1 (mostly remaining)
- ~~Native SVG hover tooltips~~ — closed by PR #12 (cheap version).
- **Rich D3 hover tooltips** (positioned div with token logos / sparklines) — upgrade from native `<title>`. **3h**
- **Wallet-search pin** — input above chart, type address → highlight + center. **2h**
- **Time-scrubber** — connect existing `/api/intelligence/holders/[token]/timeline` to D3; slider replays supply distribution by block. **5h**
- **Suspicious-cluster alert** — flag clusters with >5 wallets created within 24h holding identical %. **3h**
- **Export PNG/SVG** — canvas snapshot button. **1h**
- **Cluster legend refinement** — sub-categories (CEX hot / fresh / OG / sniper). **1.5h**

### P2 UI 2030
- Glass canvas overlay with `backdrop-blur(8px)`. **0.5h**
- Staggered bubble-arrival animation (0.2s per node, scale + opacity spring). **1h**
- Gradient edge color by transfer-volume (blue→red). **1h**

## B.8 Wallet intelligence + DNA analyzer

### P0 (all remaining)
- **Prompt injection sanitize symbols** — `app/api/dna-analyzer/route.ts:22–66`. **0.5h** (PR #3 covered the agent/bubblemap sanitization but the DNA-analyzer sanitization is separate)
- ~~No auth on DNA endpoints~~ — closed by PR #3 (tier-gated).
- **EVM symbol case-mismatch** — `wallet-intelligence/route.ts:148` doesn't `.toUpperCase()` before BLUE_CHIP set lookup. **0.25h**
- **Hardcoded compare button (no tier check)** — `wallet-intelligence/page.tsx:449–459`. **0.5h**
- ~~`vtxAnalyze()` fail-open~~ — closed by PR #3.

### P1 (all remaining)
- **Realized PnL calculation** — new `lib/pnl/calculator.ts`: avg_entry vs current price per holding + closed lots from history. **8h**
- **On-chain identity (ENS / SNS / Arkham entity)** — call Arkham label lookup on the wallet itself. **4h**
- **Decomposed risk score** — concentration (HHI) / liquidity / entry-timing / smart-money-following / scam exposure. Stacked bar. **4h**
- **Cohort comparison radar** — top 20 same-archetype wallets, plot percentile rank. **5h**
- **Trade-style detection (sniper/swing/arb)** — entry/exit pattern from tx history. New `lib/trade-classifier.ts`. **6h**
- **Behavior-shift timeline** — weekly snapshots in `wallet_snapshots`; detect "HODLER → DEGEN" pivots. **5h**

### P2 UI 2030
- Animated DNA helix in hero (framer-motion SVG). **2h**
- Trait chips with hover-define tooltips. **1h**
- Score gauge with band coloring (red/orange/yellow/green). **1h**
- AAA contrast pass (`text-gray-300` → `text-gray-200`). **0.5h**
- DNA helix intro: spiral grows from center + rotates 1s spring. **2h**
- Report sections: slide-down + fade-in stagger 100ms; left accent border grows 0→full 150ms. **2h**
- Gene card hover: scale 1.02 + shadow + glow; inline mini-chart animates to full color. **1.5h**
- Risk ring SVG: stroke animates 0°→arc 300ms; smooth color transition by risk level. **2h**
- Trait badges: stagger-in 30ms from left; hover scale + glow. **1h**

### Stuff to remove (in cluster-migration follow-up)
- `lib/intelligence/holderAnalysis.ts` — never called by wallet-intelligence/DNA routes.
- `lib/intelligence/historicalTracking.ts:findSimilarTokens()` — returns stub; mark TODO or feature-flag.

## B.9 Context feed + proof modal

### P0
- **Engagement persistence (Map → Supabase)** — table applied (§2); route refactor queued. See §5.1 above. **1.5h**
- ~~Proof event Zod validation~~ — closed by PR #9.
- **Fake holder distribution labeled as real** — `proof/page.tsx:51-107` `BubbleVisualization`. Either fetch real Birdeye/DexScreener holders OR add "Simulated" badge + disclaimer. **3h** — CLAUDE.md "no fabricated values" violation; should be a P0 follow-up branch.

### P1 (all remaining)
- **Trust score consistency** — different formula per source (alchemy=value, pump.fun=mcap/vol, dexscreener=liq+vol). Document scoring matrix; unify formula. **2h**
- **Cielo-style "Activity for $SYMBOL" filter chip** — group events by token. **2h**
- **Friend.tech-style social attribution** — "N users endorsed bullish" + avatar stack. **3h**
- **OpenSea-style verified-badge tiers** — VERIFIED at score≥75, WHALE-ALIGNED, WATCHLIST-HIT. **1.5h**

### P2 UI 2030
- Glass timeline cards (alternating left/right on desktop, vertical line). **2h**
- Animated event arrival (fade + slide-up). **0.5h**
- Sentiment-pulse ring matching color (green/red/blue). **0.5h**
- Overlapping proof-badge stack. **0.5h**
- Row hover: depth + right actions fade-in (verify/copy/share). **1h**
- Verification flow: idle → verifying → verified | failed (red X + shake). **1.5h**
- Inline expand: max-height slide 200ms; tx hash + timestamp stagger fade-in. **1.5h**
- Filter pills slide-in from left on load. **1h**
- Copy: icon swap to checkmark flash → back; toast. **0.5h**

### Stuff to remove
- ~~`/api/cron/context-feed-poll/route.ts`~~ — deleted by PR #6.
- `displayTimestamp` 6-second staggering in `useContextFeed.ts:48–63` — clever but adds complexity; low value. Mark for future cleanup. **0.5h**

## B.10 Whale cluster

### P0
- ~~Solana case violations~~ — closed by PR #1.
- **Risk score never persisted** — `orchestrator.ts:115–122` computes `risk_score` but `wallet_clusters` table doesn't have the column. **Needs migration** + write in upsert. **1h** (needs owner-approval-per-migration)
- ~~Edge `.or()` query truncation~~ — closed by PR #4.
- **Claude narrative fail-open silent fallback** — `orchestrator.ts:191–218` returns hardcoded fallback names on Anthropic timeout. **Fix:** retry once + Sentry alert. **1h** (Note: use neutral wording in code comments — call it "external AI synthesis call" not "Claude narrative")

### P1 (all remaining)
- **Entity registry** — table mapping known addresses (Binance Deposit, Uniswap Router) to entity types. Enrich narratives. **4h**
- **Confidence weighting** — currently uniform 0.4–0.75; weight by `total_value_usd`, chain diversity, temporal entropy. **3h**
- **MEV / sandwich detector** (Algorithm 6) — front-run within 1s of UniswapV3 events. **6h**
- **Time-decay on edges** — edges 6 months old count equal to fresh; weight by recency. **2h**
- **Cross-chain bridge_pattern detector** — wallet_A on ETH + wallet_B on Solana via same Multichain/Stargate router within 2h → soft edge. **5h**
- **Label provenance enum** — `label_source`: verified / community / ai / exchange. UI highlights verified. **2h**
- **Realtime cluster updates** — Supabase Realtime on `wallet_edges` instead of weekly cron. **4h**

### P2 UI 2030
- Glass cluster cards with archetype-tinted glowing border. **1h**
- Hover tooltip per node (label / score / value / edges / explorer link). **1.5h**
- Floating draggable cluster legend. **1h**
- Risk score heatmap (X=whale_score, Y=risk_score scatter). **2h**
- Temporal evolution scrubber (slider over first_seen → last_seen, edges fade). **4h**
- Card hover: scale 1.02, primary-color border glow, archetype icon enlarges + 10° rotate. **1.5h**
- Archetype badge: subtle pulse-glow every 2s matching archetype color. **1h**
- Filter pill underline + cluster list re-render with stagger-fade 20ms apart. **1.5h**
- Analyze form: focus underline accent; submit spinner; success → result cards slide-up from bottom. **2h**
- Mini whale-score donut: hover segments shift out + tooltip. **1.5h**
- Member-count badge: count-up hover animation 300ms + pulsing bg. **1h**

### Stuff to remove (BLOCKED on legacy-page migration first)
- `lib/jobs/cluster-detection.ts` — orphan Solana-specific job.
- `components/clusters/Cluster2DGraph.tsx` — duplicate of `ClusterGraph.tsx`.
- `/api/clusters/by-address/[address]/route.ts` — overlaps `/api/clusters/analyze`.

## B.11 Performance / Web Vitals (cross-cutting)

Ranked by effort/impact ratio:

1. **Google-Fonts CDN → `next/font`** — `app/layout.tsx:75-78` + `app/globals.css:1-9`. **0.5h → 200–400ms LCP**
2. **Anthropic SDK out of client bundle** — `components/VtxAiTab.tsx` shouldn't import the SDK; client should `fetch('/api/vtx-ai')` only. **2h → 250–350KB JS, 1.2–1.8s transitions**
3. **Split mega-client pages** — `portfolio/page.tsx` (675 LOC), `whale-tracker/page.tsx` (992), `sniper/page.tsx` (581). Move to server-shell + `<Suspense>` per section; lazy lightweight-charts/recharts. **8h → 400–600ms LCP, 800–1200ms TTI**
4. **`react-force-graph-2d` lazy + skeleton + 500-edge ceiling** — `components/clusters/ClusterGraph.tsx:11`. **1h → 200–300ms FCP**
5. **AuroraBackground GPU optimize** — `app/dashboard/layout.tsx:22` conic keyframes on every dashboard route. **1h → 30–50ms / route transition**
6. **Route-level chart code-splitting** — d3 / recharts / lightweight-charts all eager-loaded everywhere. **4h → 600–800KB off critical path**
7. **Auth state caching (SWR/TanStack)** — `lib/hooks/useAuth.ts:67-120` re-fetches on every page. **3h → 300–500ms repeat-nav**
8. **`<Suspense>` boundaries on dashboard** — wrap KpiBar/Insight/MiniVtx individually. **3h → 400–600ms FCP, 200–300ms FID**
9. **Cron batching + backoff** — `vercel.json` runs 33 crons; merge feed-aggregator + exponential backoff for low-traffic tokens. **4h → 40–60% Vercel + Alchemy quota saving**
10. **Token logo `next/image` + dimensions** — market list (115 logos) causes CLS. **2h → 80–120ms LCP, CLS<0.1**

**Total perf: ~28h. Items 1+2+4+5+10 alone = 6.5h, biggest UX delta.**

## B.12 Accessibility + mobile + PWA (cross-cutting)

By user-impact severity:

1. **Microscopic type** — 391 instances of `text-[9px]` / `text-[10px]`. Floor 11px secondary, 13px body.
2. **Touch targets <44px** — `py-1` / `py-2.5` / `p-1.5` everywhere. Wrap micro-icons in `w-11 h-11` containers.
3. **No general service worker** — `push-sw.js` is push-only. Add fetch listener, offline shell, SWR cache for `/dashboard`, `/market`.
4. **No install prompt** — `manifest.json` is correct but no `beforeinstallprompt` listener; iOS gets no "Add to Home" CTA. Add `useInstallPrompt` hook + one-time banner.
5. **Modal focus trap + ESC missing** — `AlertModal.tsx`, `BuySellModal.tsx` have `onClose` but no ESC listener or focus trap. Use Headless UI Dialog or hand-roll.
6. **Label/input association broken** — `AlertModal:66`, `BuySellModal`, `OrderForm`, `ProfileTab` have orphan `<label>` w/o `htmlFor`. Pair every label `htmlFor={id}` with input `id={id}`.
7. **No mobile bottom nav** — `SidebarMenu.tsx` is desktop-first. New `<BottomNav>` `bottom-0`, 5 routes (Market/Wallet/Portfolio/Alerts/Profile), `sm:hidden`.
8. **Color contrast fails** — `text-gray-500` (#6B7280) on `#111827` = 3.8:1; `text-gray-600` = 3.2:1. WCAG AAA = 7:1. Bump `gray-500/600` → `gray-300/400` globally.
9. **Screen reader gaps** — TokenLogo fallback `<div>` w/ letter has no `aria-label`; no `aria-current="page"` on active nav; icon-only buttons missing `aria-label`; toast container missing `aria-live`.
10. **No reduced-motion support** — wrap animations in `@media (prefers-reduced-motion: reduce)`; framer-motion `useReducedMotion` hook.
11. **No safe-area insets** — `padding: env(safe-area-inset-bottom)` on bottom-fixed elements (iPhone X+ home indicator clips content today).
12. **Form validation associations** — `BuySellModal:68` shows balance error but no `aria-describedby` linking input → error div; AlertModal `aria-live` missing.

**Total a11y/mobile: ~18h. Items 1+2+5+7+8 = ~10h, single sprint.**

## B.13 Observability / reliability / analytics (cross-cutting)

By blast radius:

1. **Sentry init missing release/profiling/replay** — `instrumentation.ts:9-20`. Add `release: VERCEL_GIT_COMMIT_SHA`, `profileSampleRate: 0.05`, replay on error.
2. **18 `.catch(() => {})` blocks swallow errors** — across `app/api/sniper/execute`, `security/check-wallet`, `notifications`, `support/tickets`, +14 more. Always `Sentry.captureException(err)` before swallow.
3. **162 `console.*` in prod** — across 78 routes. Replace with `pino` JSON logger.
4. **Zero retry on 29 service wrappers** — only CoinGecko has 429-fallback. Add `p-retry` to Alchemy/Birdeye/DexScreener/GoPlus with 3 attempts + exp backoff.
5. **Health check incomplete** — `/api/health` only checks env vars + Supabase. Add Redis + critical external APIs; return 503 if any critical service down.
6. **Redis timeout silent fail-open** — `lib/cache/redis.ts:32-46`. Sentry warn before fallthrough; circuit breaker after 3 timeouts/60s.
7. **No per-route trace sampling** — flat 10%. Use `tracesSampler` callback: auth errors 100%, price-fetch 1%.
8. **CoinGecko plan-mismatch silent downgrade** — `lib/services/coingecko.ts:15-35`. Validate plan/key at startup → throw if mismatch.
9. **Cron error swallow** — `app/api/cron/_shared.ts:71-91` `logCronExecution()` catch is empty. Sentry capture; `/api/admin/cron-status` alerts on >2× schedule interval.
10. **PostHog client-only** — `lib/posthog.ts:1-41`. Add `posthog-node` server-side; track signup → confirm → first-trade events; `plan_tier` property.
11. **Timeout chaos** — CoinGecko 12s, DexScreener 10s, Birdeye 600s, Anthropic 900s. Env-driven `EXTERNAL_API_TIMEOUT_MS=8000`, `LLM_TIMEOUT_MS=30000`. CI lint: every fetch must have explicit timeout.
12. **No Web Vitals / RUM** — no `web-vitals` or `@vercel/analytics`. Add `@vercel/analytics/react` + custom `trade_latency_ms = execute - quote_requested`; alert P95 > 3s.

**Total observability: ~22h. Items 1+2+3+4 = ~7h and unblock everything downstream.**

## B.14 Design system + cross-section UI 2030 (cross-cutting)

Cross-section opportunities (highest leverage):

- **Command palette ⌘K** — fuzzy nav + actions, framer-motion layout-id selection slide. **15h**
- **Global keyboard shortcuts** — `g+p` portfolio, `g+m` market, `g+s` sniper; help modal `?`. **5h**
- **`:focus-visible` rings everywhere** — global Tailwind config, primary-blue ring + offset. **4h**
- **Spring easing presets** — add cubic-bezier-spring values to tailwind.config; use on card scales / button presses. **2h**
- **Real toast lib (Sonner)** — replace custom toast w/ Sonner: stacking, swipe-dismiss, sound, undo. **3h**
- **Headless UI Dialog** (focus trap, ESC, click-outside) — replace ad-hoc modals. **4h** (also closes a11y #5)
- **Skeleton shimmer** (not pulse) — left-to-right gradient sweep. **1.5h**

Per-feature micro-interaction effort summary (from audit §14):

- Portfolio: ~14h | Market list/detail: ~14h | Sniper: ~11.5h | Swap: ~13h | VTX AI: ~10.5h | Wallet: ~7h | Wallet clusters: ~8.5h | DNA: ~8.5h | Proof modal: ~5.5h | Login/Signup: ~8h | Settings/admin: ~4.5h | Context feed/notifications: ~4h

Full per-feature spec in `docs/audits/audit-recommendations-2026-05-15.md` §14.

**Total micro-interactions: ~110h (cross-section + per-feature combined). Quick-win items (focus-visible + Sonner + Headless Dialog + skeleton shimmer + spring easing): ~14h.**

## B.15 Trade execution (from trade-exec audit)

### P0 / P1
- **No MEV toggle on main swap UI** (sniper has it; `InlineBuySellForm` doesn't). **2h**
- **Quote staleness + re-fetch** — track `quoteIssuedAt`; if user hits Sign and quote >10s old, re-fetch + abort if drift >slippage. **2h**
- **EIP-1559 gas at broadcast** — currently quote-time only; refresh `baseFee + maxPriorityFee` on submit. **2h**
- **Permit2 support** — `lib/services/zerox.ts` query Permit2; include `permit` calldata in swap tx → bundle approve+swap. **3h**
- **Cross-chain bridge** — Wormhole/LayerZero/Stargate; currently chain-scoped only. **6h+** (consider deferring; bridge integrations are heavy)
- **Advanced order types in `/market`** (limit / stop-loss / OCO / TWAP / DCA — sniper has some). **8h+** (deferred — design-first)
- **Tax simulation pre-trade** — 1-wei eth_call to surface true tax delta. **3h** (overlap with security audit)

## B.16 Compliance + legal + sanctions (from compliance audit)

### P0 minimum-viable bar
- ~~Cookie consent banner~~ — closed by PR #10.
- ~~First-trade risk modal~~ — closed by PR #10.
- **Chainalysis address screening on signup** — POST `/api/auth/signup/screen` blocking flagged wallets. ~$200-500/mo. Owner picks vendor + provides API key. **2h dev**
- **Geo-IP fence (Vercel edge) for OFAC countries** — `vercel.json` middleware redirect for Iran / North Korea / Syria / Crimea. **1h**
- **Sanitized Sentry config** — extend to scrub wallet addresses if logged. **0.5h**
- **Terms amendment** — clarify non-custodial DEX status per MiCA Art. 6 (EU) + FCA registration exemption (UK). **1h** (owner draft)

### P1 ship-soon
- **CSV / 1099 tax export** (Koinly schema). **3h** (overlap with portfolio audit)
- **DPO appointment (EU)** — Deloitte / OneTrust / DPO.eu (€500-2K/mo). Owner action.
- **SCCs for US data residency** — legal review with Vercel/Supabase/Anthropic DPAs. ~5h legal.
- **Incident response plan + breach notification template** — `/legal/incident-response.md`. **2h**
- **Per-region Terms amendments** — Singapore wealth-advisor exemption, Japan JVCEA registration status. **legal time**
- **Subprocessor list** — `/legal/subprocessors.json` for GDPR Art. 28. **1h**

### UI surfacing
- **VTX AI warning on first chat** — modal: "AI is advisory only. Always review swaps before signing." **1h**
- **Jurisdiction warning banner** — geo-IP check; "Naka Labs is not available in [COUNTRY]" for restricted zones. **2h**
- **Risk-of-loss inline on order form** — surface in swap preview ("You may lose 100% of this trade"); red banner if slippage >30%. **1h**
- **Tax & 1099 callout** — footer link "Export trades for taxes". **0.5h**

## B.17 Onboarding + retention (from onboarding audit)

### P0
- **Joyride first-run tour** — 3 steps: connect wallet → set price alert → explore whale tracker. **4h**
- **Post-verify funnel page (`/onboarding/complete`)** — 3 micro-CTAs (connect wallet, join Telegram, bookmark support). **2h**
- **Real `notification-digest` cron** — body is stub today; wire it to email users with active alerts a weekly summary. **5h**
- **Empty-state CTAs** — portfolio holdings empty / sniper no rules / watchlist empty / alerts empty. Reusable `components/dashboard/EmptyStateCta.tsx`. **3h**

### P1
- **Referral program** — `user_referrals` + `referral_codes` tables; shareable links; email triggers. **6h**
- **Microcopy badges on advanced features** — hoverable `(?)` next to "Sniper Bot", "DNA Analyzer", "Bubble Map" with one-line explainer + docs link. New `<FeatureHint>`. **2h**
- **Welcome email + onboarding email sequence** — t=0 verification, t=1h "you're in" + sample alert, t=24h "join Telegram". **4h**
- **Wallet-connect prompt timing** — dismissible banner on `/dashboard` without connected wallet. **2h**

### P2
- **Annals leaderboard + achievements** — top wallets by 30d PnL; badges (First Copy Trade / 5 Successful Snipes / 100-Day Streak). **8h**
- **Streak counter** — consecutive login days w/ fire-emoji badge in header. **3h**
- **In-app tip system** — non-blocking Sonner toasts ("Did you know..."). **2h**
- **Push on key moments** — first alert trigger / whale follow big move / tier upgrade. **3h**

## B.18 SEO / marketing / i18n (from SEO audit)

### P0
- **`app/[locale]` segment** — `next-intl` is configured but `app/[locale]` segment never created → 10 translation files are no-ops. **8-12h** (massive — full session)
- **`app/sitemap.ts`** — dynamic for token pages. **2h**
- **`public/robots.txt`** — Disallow /admin /dashboard. **0.25h**
- **Convert `/market/[chain]/[address]` from `"use client"` to server component with `generateMetadata`** — so each token has its own OG image / title. **4h**

### P1
- **Per-token dynamic OG images** — `next/og` library for /api/og generation. **3h**
- **Missing marketing pages** — `/blog`, `/changelog`, `/status`, `/about`, `/careers`. Stub each at ~1h.
- **JSON-LD schema** — FAQPage, Organization, BreadcrumbList, FinancialProduct. **2h**
- **Expand translation coverage** — `messages/fr.json`, `es.json`, `ar.json`, `zh.json`, `ja.json`, `ko.json`, `pt.json`, `tr.json`, `hi.json` are at 6-50% of English. Bring to 80%+ (200+ keys per language). **6h**
- **Canonical link headers per locale**. **1h**

### P2
- **`Content-Security-Policy` header** in `vercel.json`. **1h**
- **`X-Frame-Options: DENY`** in `vercel.json` (not in middleware). **0.25h**
- **Cache header refinement** per route type. **1h**
- **Image optimization audit** — `priority`, `fill`, `sizes` on key images. **1h**

## B.19 Infra / reliability / testing (from infra audit)

### P0
- **32 Dependabot CVEs** (10 high, 19 moderate, 3 low) — `npm audit fix` for moderate/low; manual review for the 10 high. **3h**
- **Flip `npm audit --audit-level=high` from `continue-on-error: true` to `false`** in `.github/workflows/`. **0.25h**
- **Flip `next.config.js`: `ignoreBuildErrors: false` + `ignoreDuringBuilds: false`** — currently silent build failures pass CI. **0.25h** (will require fixing whatever errors surface)
- **Add `npm run typecheck` step to CI** (currently not gated). **0.25h**

### P1
- **Zero unit/integration/e2e tests** — install `vitest` + add `"test"` script; gate in CI. Build at least smoke tests for: login → dashboard, market data fetch, sniper rule create, portfolio balance. **6h initial scaffold + smoke tests**
- **Webhook rate limiting** — `/api/sniper-detect/route.ts`, Alchemy/Helius webhooks. Add Upstash throttle per-chain. **3h**
- **Admin audit log** — `admin_audit_log` table + middleware on every POST/PATCH/DELETE in `app/admin/`. **6h**
- **Smoke tests as Playwright cron** — `/api/cron/smoke-test` every 2h. **2h**
- **`vercel.json` security headers** — `X-Frame-Options: DENY` + minimum CSP. **1h**
- **Migration rollback companions** — `_rollback.sql` next to each migration. **2h**

## B.20 Engagement route refactor (table applied; route pending)

Migration `context_feed_engagement` was applied to prod and the SQL is in `supabase/migrations/2026_05_15_context_feed_engagement.sql` (via PR #14). The `/api/engagement/route.ts` route still uses the in-memory Map.

**Plan (~1.5h):**
1. New branch `feat/engagement-route-supabase`.
2. Replace in-memory `Map`/`Set` in route with Supabase calls using cookie-bound server client (`createServerClient` pattern from `app/api/whales/follow/route.ts`).
3. Zod-validate body `{ eventId: string max 128, action: 'view'|'like'|'unlike'|'share' }`.
4. POST handler:
   - `unlike` → DELETE WHERE event_id = $1 AND user_id = auth.uid() AND action = 'like'.
   - `view|like|share` → INSERT ... ON CONFLICT (event_id, user_id, action) DO NOTHING (unique index makes views+likes idempotent; anon view rows allowed to repeat).
   - Return fresh aggregated counts in one round-trip.
5. GET handler: `SELECT action, count(*) FROM context_feed_engagement WHERE event_id = $1 GROUP BY action`. Map to `{ views, likes, shares, comments }`.
6. On DB error, log to Sentry + return zeros (NOT in-memory fallback — CLAUDE.md "no fabricated values").
7. Delete `engagementStore` Map + `userActions` Set.

---

# APPENDIX C — REVISED 5-SPRINT EXECUTION ORDER

From the audit doc, validated against what shipped this session:

**Sprint 1 — Foundation (~50h)**
- ~~P0 security sweep across all 10 features (PR #1-5, #9, #14)~~ DONE
- ~~Apply pending Supabase migration (notification quiet-hours)~~ DONE
- ~~Compliance MVB (cookie + first-trade)~~ DONE
- Remaining sprint-1: Sentry release/profiling/replay + replace 18 catch-swallow + Pino logger (~8h). next/font + AnthropSDK out-of-client + AuroraBg GPU + token-logo `next/image` (~6h). Touch targets 44px + min font 11px + AAA contrast pass + focus-visible globally (~7h). Headless UI Dialog + Sonner toast (~7h).

**Sprint 2 — Industry parity for top-3 P1 (~50h)**
- Portfolio: multi-wallet + NFT + DeFi + CSV (~15h) — B.1
- Security: source triangulation + pre-sign sim + LP-lock duration + deployer history (~14h) — B.4
- VTX AI: react-markdown + streaming caret + tool cards + stop button + regenerate + edit-resend (~12h) — B.5
- Mobile bottom nav + safe-area insets + PWA install prompt + offline shell (~9h) — B.12

**Sprint 3 — UI 2030 sweep (~50h)**
- Command palette ⌘K + global keyboard shortcuts (~20h) — B.14
- Per-feature micro-interactions: portfolio + market + sniper + swap (highest ROI 4) (~30h) — B.14

**Sprint 4 — Long-tail P1 (~50h)**
- Wallet-intel real PnL + ENS/SNS + decomposed risk score (~16h) — B.8
- Whale-cluster entity registry + time-decay + bridge detector + Realtime updates (~15h) — B.10
- Bubble-map time-scrubber + hover tooltips + wallet-search + suspicious-cluster alert (~12h) — B.7
- Profile avatar + sessions revocation + GDPR export (~7h) — B.6

**Sprint 5 — Polish + remaining UI 2030 (~30h)**
- Sniper UI 2030 + DNA UI + wallet/clusters/proof/context-feed/settings micro-interactions
- Web Vitals RUM + per-route trace sampling + `/api/health` deep-check + retry-on-29-APIs — B.13

**Deferred — worth shipping, not blocking:** 2FA (B.6), passkey (B.3), MEV detector (B.10), cohort radar + behavior timeline (B.8), server-side PostHog backfill (B.13), cross-chain bridge (B.15).

---

# APPENDIX D — COMPETITIVE PARITY MATRIX (snapshot)

Pulled from `docs/audits/audit-recommendations-2026-05-15.md`. Reference for "are we good enough yet?" calls.

**Net post-fix:** matches industry on 30 of 33 standard capabilities AND keeps the 5 unique features (whale clusters, DNA analyzer, bubble map, context feed, proof modal) that nobody else has.

**Today (15 PRs in):** P0 sweep done, compliance disclosure shipped, EIP-4361 SIWE shipped, sniper realtime polish shipped, bubble-map chain explorer shipped, proof-event Zod hardened, proof inline SwapCard unifies the buy flow, whale Copy CTA real.

**Still missing for ship-grade:** Sprint 1 cross-cutting (Sentry coverage + Pino + perf + a11y), Sprint 2 top-3 P1 (portfolio multi-wallet/NFT/DeFi/CSV + security triangulation + VTX markdown), Sprint 3 UI 2030 (cmd palette + per-feature motion).

**Time to ship-grade from here:** ~150h (Sprints 1-3) for matching industry; ~230h adding Sprint 4-5 long-tail + polish; ~280h adding the deferred items.

Full matrix: `docs/audits/audit-recommendations-2026-05-15.md` lines 539-577.
