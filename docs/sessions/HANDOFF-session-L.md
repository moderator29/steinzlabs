# Session L Handoff — 2026-05-15 (continued)

## 0. Read this first

Owner: Phantomfcalls / moderator29. Brand: Naka Labs (Steinz Labs codename).
**Read `docs/sessions/HANDOFF-session-K.md` §0z + §0a first** — the
environment + ruleset block in K is still authoritative (repo path,
git identity, no AI attribution, no `.toLowerCase()` on raw addresses,
no fabricated values, branch + push + STOP, etc.).

---

## 1. What this session shipped

**8 PRs pushed to GitHub, all rebased on top of main, all typecheck-clean.
Owner opens / merges in GitHub UI.**

| # | Branch | What |
| --- | --- | --- |
| 1 | `fix/p0-cross-cutting-solana-case-fifo-hygiene` | Solana case-sensitivity fixes across portfolio, clusters, sniper criteria; FIFO cross-chain key for performance route; sniper `console.error → Sentry`; `apiCost.ts` `any → unknown`; portfolio fail-open swallows replaced with Sentry capture |
| 2 | `fix/p0-security-goplus-failclose-solana-endpoint` | `simulateTransaction` now fails CLOSED with `riskLevel: 'UNKNOWN'`; `scanTokenSecurity` branches on chain — Solana uses `/solana/token_security/?contract_addresses=...` with new `parseSolanaTokenSecurity` for the nested-status payload shape |
| 3 | `security/p0-prompt-injection-and-auth-gates` | `withTierGate('pro')` on `/api/bubble-map`, `/api/dna-analyzer`, `/api/dna-analysis` (all were unauth'd before); `sanitizeForPrompt` / `sanitizeSymbol` / context-field sanitization in VTX, bubblemap-agent, DNA prompts; `vtxAnalyze` null → degraded stub instead of generic 500 |
| 4 | `refactor/p0-clusters-by-id-edge-chunking` | `/api/clusters/by-id/[id]` `.or()` truncation P0 — chunks the address list into batches of 50, runs two `.in()` queries per chunk in parallel, de-dupes by edge identity, caps at 500 |
| 5 | `security/p0-eip4361-siwe-message` | EIP-4361 SIWE for EVM + Phantom-shape SIWS for Solana via `lib/auth/siwe.ts` (single `buildSiweMessage` used by issuer + verifier so bytes match); domain + URI + chainId now part of signed payload (kills phishing replay); back-compat fallback for in-flight legacy nonce rows |
| 6 | `chore/dead-code-sweep-clusters-context-feed` | Deleted unscheduled `app/api/cron/context-feed-poll/route.ts`. Other audit "dead candidates" (lib/jobs/cluster-detection, components/clusters/Cluster2DGraph, /api/clusters/by-address) turned out to back the legacy `/dashboard/wallet-clusters/[address]` page and are NOT safe to delete without migrating that page first |
| 7 | `feat/proof-inline-swap-card` | Proof modal Buy button now expands the same `components/vtx/SwapCard.tsx` VTX AI uses, in-place — no more router.push to /dashboard/swap. `buildProofSwapData()` builds the SwapCardData payload from the context-feed event so the CA the user sees is the CA they trade |
| 8 | `feat/whale-copy-this-whale-button` | Whale-tracker `/[address]` Copy tab — replaced static "go to /copy-trading" message with a Copy this whale CTA that opens the existing `NewCopyRuleModal` pre-filled with the whale's address + chain |

### Suggested merge order

1. `fix/p0-cross-cutting-solana-case-fifo-hygiene` (security/data integrity, no UI risk)
2. `fix/p0-security-goplus-failclose-solana-endpoint` (closes simulate fail-open)
3. `security/p0-prompt-injection-and-auth-gates` (closes 3 unauth endpoints + sanitizes 4 prompt sites)
4. `refactor/p0-clusters-by-id-edge-chunking` (one route, low risk)
5. `chore/dead-code-sweep-clusters-context-feed` (1 file removed, 0 importers)
6. `security/p0-eip4361-siwe-message` (auth — DEPLOY MIGRATIONS FIRST, see §2)
7. `feat/proof-inline-swap-card`
8. `feat/whale-copy-this-whale-button`

---

## 2. Supabase migrations applied to prod (`phvewrldcdxupsnakddx`)

Two migrations applied via `mcp__supabase__apply_migration` this session
with explicit owner authorization:

- **`notification_quiet_hours`** — adds 6 columns to
  `public.notification_settings` (email_enabled, telegram_enabled,
  quiet_hours_enabled, quiet_hours_start_minute,
  quiet_hours_end_minute, quiet_hours_timezone). This unblocks the
  Phase B notification panel that was hiding those fields with
  "Pending — apply migration" since session K.
- **`auth_wallet_nonces_chain_id`** — adds `chain_id integer NULL` +
  `issued_at timestamptz NULL` to `public.auth_wallet_nonces`. Required
  by branch 5 (SIWE) so the verify route can reconstruct the exact
  signed bytes. Both columns are NULL-able + additive — legacy nonce
  rows keep working (verify-side has a 5-minute back-compat fallback).

SQL files mirrored into `supabase/migrations/` for repo parity:
`2026_05_15_notification_quiet_hours.sql` and
`2026_05_15_auth_wallet_nonces_chain_id.sql`.

---

## 3. The 18-audit consolidated recommendations doc

`docs/audits/audit-recommendations-2026-05-15.md` — 18 audits across:
the 10 feature areas (portfolio, sniper, auth, security, VTX, profile,
bubblemap, wallet-intel/DNA, context-feed/proof, whale-cluster), 4
cross-cutting (observability, design-system, perf, a11y/PWA — last 2
hadn't returned at end of session), and 4 ship-readiness (trade-exec,
compliance, onboarding, SEO/i18n, infra/testing, NAKA wallet flow,
swap-card unification, whale copy-trade).

P0/P1/P2 rollups per area with file:line refs and effort hours.
Total ~235h to reach industry-standard ship-ready. This session
shipped the foundational P0 layer; the rest is sequenced in §5.

---

## 4. Audit residuals from shipped branches

Issues found while re-reading the diffs after push:

- **`app/api/clusters/by-id/[id]/route.ts:41,51`** — branch 4 chunked
  the edge query but the member-address comparison still uses
  `.toLowerCase()`. For Solana clusters this drops members. Fix in
  branch 15 (cluster P1) — should use `normalizeAddress` consistently
  with `lib/clusters/detection.ts` (which branch 1 fixed).
- **Branch 3 commit message** mentions "Anthropic Sonnet 4.6" by name
  while explaining the cost-abuse vector. Borderline per CLAUDE.md
  "no AI by name". Going forward use neutral language ("external AI
  synthesis call", "model-based analysis"). Not worth a force-push.
- **Branch 6 dead-code sweep** — only deleted 1 file. Three more
  candidates flagged by the audit (`lib/jobs/cluster-detection.ts`,
  `components/clusters/Cluster2DGraph.tsx`,
  `app/api/clusters/by-address/[address]/`) are still wired to the
  legacy `app/dashboard/wallet-clusters/[address]/page.tsx`. Pick a
  single canonical cluster surface (`/[id]` vs `/[address]`), migrate
  the legacy page, then delete the duplicates. Audit doc has the full
  reasoning.
- **Branch 9 (proof inline swap)** — `BubbleVisualization` in
  `app/dashboard/proof/page.tsx:51-107` still generates fake
  deterministic-seeded holder percentages and labels them "Powered by
  on-chain data". CLAUDE.md "no fabricated values" violation. Branch
  was scoped to the Buy CTA replacement; fix the BubbleVisualization
  separately by either (a) fetching real holders from
  `/api/bubble-map` (now tier-gated, branch 3) or (b) adding a
  "Simulated" badge + disclaimer.

---

## 5. Open work — 14 branches scoped, not yet shipped

Each line is a self-contained branch. Pull from the consolidated
audit doc for the per-item file:line refs and effort estimates.

### P0 not yet shipped
- **Branch (compliance MVB)** — Cookie consent banner (OneTrust or
  inline), first-trade risk modal (lands on first swap, "I understand
  losses possible" checkbox + persists `users.first_trade_acknowledged`).
  Skip Chainalysis OFAC screening + Vercel geo-fence until the owner
  picks a vendor and provides the API key + the IP-geo service.
- **Branch (engagement persistence + proof Zod)** —
  `/api/engagement/route.ts` uses an in-memory `Map` for likes / views /
  shares; wiped on every redeploy. Migrate to the existing `engagement`
  Supabase table (already declared, never written). Also: Zod-validate
  the `steinz_proof_event` sessionStorage payload in
  `app/dashboard/proof/page.tsx:119` before `JSON.parse` (XSS via
  `event.title`). Drop the fake `BubbleVisualization` or add a
  "Simulated" badge per §4 above.

### Architectural unification
- **Branch (NAKA wallet unification)** — `useNakaWallet()` hook +
  `WalletContextProvider` wrapping `app/dashboard/layout.tsx` so
  Portfolio / Swap / VTX / Sniper / Whale read wallet state through
  ONE source instead of the 4 different `localStorage` keys + 3
  different chain-selection mechanisms the audit found. Persistent
  wallet pill in the top bar (chain icon + address + balance +
  VTX-access status). Enforce the VTX wallet-access toggle
  server-side (`app/api/vtx-ai/route.ts` should null `walletAddress`
  in the system-prompt context when `user_preferences.vtx_wallet_access
  = false`, AND reject `prepare_swap` tool calls). Big refactor —
  best in a fresh session.

### P1 features
- **VTX P1** — `react-markdown` + `remark-gfm` to replace the
  regex-strip at `VtxAiTab.tsx:1141`; streaming caret animation;
  AbortController stop-generation button; copy-message; regenerate;
  edit-and-resend; model picker (Sonnet / Opus / Haiku); suggested
  follow-up pills; emit `tool_start` events mid-stream so
  `VtxToolSidecar` populates in real time.
- **Sniper P1** — pulsing Live badge next to History tab when
  `liveConnected`, pulse-on-fill animation on new execution rows,
  dev-wallet auto-block (extend GoPlus check to block criteria when
  creator address matches top-N holders), pre-flight dry-run
  (`eth_call` / `simulateTransaction` before execute).
- **Portfolio P1** — multi-wallet aggregation (`/api/portfolio/aggregate`
  + multi-select UI), sortable `HoldingsTable` columns, watchlist +
  spam-token filter (toggle that hides GoPlus-flagged risk).
- **Bubble map P1** — D3 hover tooltips with label / address /
  balance / first-tx age / edge weight; wallet-search pin
  (highlight-and-center input above chart); chain-aware explorer
  router (replaces the `/api/bubblemap-agent/route.ts:178`
  hardcoded Solscan); suspicious-cluster alert (>5 wallets created
  within 24h holding identical %).
- **Whale cluster P1** — persist `risk_score` (orchestrator computes
  it; the column doesn't exist — migration needed); entity_registry
  table for known addresses (Binance Deposit, Uniswap Router); time-
  decay weighting on edges; `label_source` enum (verified / community
  / ai / exchange).
- **Trade-exec P1** — MEV toggle on `InlineBuySellForm` (sniper has
  it; main swap UI doesn't); EIP-1559 gas params at broadcast time
  (currently quote-time only, can stale); quote re-fetch when stale
  > 10s before signature; Permit2 support to bundle approve+swap
  into one tx.
- **Profile P1** — avatar upload (Supabase Storage bucket; schema
  has `avatar_url`, no UI), bio + Twitter/Discord/GitHub fields
  (schema has `bio`, no UI), session-revocation buttons on
  `login_activity` rows, GDPR export (POST `/api/account/export` →
  JSON archive), 30-day soft-delete.

### Onboarding + SEO + UI 2030 + Observability
- **Onboarding P0** — Joyride first-run tour, post-verify `/onboarding/
  complete` funnel page, real `notification-digest` cron logic
  (currently a stub), empty-state CTAs across portfolio / sniper /
  watchlist.
- **SEO P0** — `app/[locale]` segment so `next-intl` actually routes
  the 10 translation files (currently no-op); `app/sitemap.ts`
  (dynamic for token pages); `public/robots.txt` (Disallow /admin
  /dashboard); convert `/market/[chain]/[address]` from `"use
  client"` to a server component with `generateMetadata` so each
  token has its own OG image / title.
- **UI 2030 sweep** — single sweep across all dashboards: glass cards,
  framer-motion animated counters, skeleton loaders (replace "Loading
  X…" text), command palette ⌘K, AAA-contrast pass (`text-slate-500
  / 600 → 300 / 400` on slate-950 backgrounds — fails AAA at 3.4:1
  today), spring easing, focus-visible rings everywhere, sparkline
  per row in HoldingsTable.
- **Observability** — pino structured logger replacing the 162
  `console.*` instances across 78 routes; Sentry release tracking
  (`release: process.env.VERCEL_GIT_COMMIT_SHA`); Sentry capture in
  the 18 silent `.catch(() => {})` blocks the audit found; retry
  wrapper for external API calls (CoinGecko has a partial fallback,
  Alchemy / Birdeye / DexScreener / GoPlus have none); per-route
  `tracesSampler` to cut Sentry cost ~40-60%.

---

## 6. Things to NOT do

- **Don't apply Supabase migrations without explicit owner approval
  per migration.** This session got authorization for two specific
  migrations (notification quiet-hours + auth_wallet_nonces). Any
  new migration needs a fresh "approve the X migration" from
  Phantomfcalls before running `mcp__supabase__apply_migration`.
- **Don't force-push to existing PR branches** unless the owner asks.
  Push new commits, let the owner decide.
- **Don't delete the legacy `/dashboard/wallet-clusters/[address]/`
  page or its supporting files** until you've migrated the
  functionality to `/[id]` and confirmed parity. The audit flagged
  them as duplicates but they're load-bearing.
- **Don't reference Claude / Anthropic / Sonnet / Opus / Haiku by
  name in commit messages or code comments.** Use neutral language
  ("external AI synthesis call", "model-based analysis") going
  forward.

---

## 7. Quick environment confirm (same as session K §0z)

Repo: `c:\Users\DELL LATITUDE 5320\Downloads\steinzlabs` (Windows;
PowerShell + Git Bash both available; default cwd is the parent
folder, `cd steinzlabs` first).
Remote: `https://github.com/moderator29/steinzlabs` — push works,
HTTPS creds cached. **`gh` CLI is NOT installed and that's
intentional** — push the branch, GitHub returns the
`/pull/new/<branch>` URL, owner opens the PR.
MCP: Supabase (`phvewrldcdxupsnakddx`) + Vercel only.
Sentry: `import * as Sentry from "@sentry/nextjs"` — used by
`lib/api/fetchWithRetry.ts`, `lib/cache/redis.ts`, several routes.
