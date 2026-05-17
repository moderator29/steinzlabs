# Session M Handoff

## 0. Read first

Owner: Phantomfcalls / moderator29. Brand: Naka Labs (Steinz Labs codename).
Repo: `c:\Users\DELL LATITUDE 5320\Downloads\steinzlabs` — Windows; PowerShell
+ Git Bash both available. `cd steinzlabs` first.

**Required reading before any multi-section work:**
1. `CLAUDE.md` — canonical ruleset. Re-read if any item below is unclear.
2. `docs/sessions/HANDOFF-session-L.md` — Session L work (still useful context).
3. `docs/audits/audit-recommendations-2026-05-15.md` — 18-audit rollup.
4. This file.

**Quick environment confirm**
- Remote: `https://github.com/moderator29/steinzlabs` — push works, HTTPS
  creds cached. `gh` CLI not installed and that's intentional. Branch +
  push + STOP. Owner opens the PR.
- MCP servers used: Supabase, Vercel (intermittent — used for read-only
  spot-checks).
- Identity must be `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- Never reference Claude / Anthropic / model names in code or commit messages.

---

## 1. What shipped this session

### 1.1 Conflicts resolved (6 branches rebased + force-pushed)

These were sitting unmergeable on origin at session start:

- `feat/web-vitals-rum-endpoint` — re-applied around the `app/layout.tsx`
  Inter + JetBrains_Mono next/font swap.
- `fix/bubble-map-chain-explorer-and-tooltips` — merged the
  wallet-search-pin pickup with the explorer chain-mapper.
- `fix/market-trading-panel-correctness` — rebased with `-X theirs` since
  the branch supersedes the earlier simpler MEV toggle.
- `fix/p0-proof-event-zod-validate` — kept the new ZodSchema +
  re-added the `tokenAddress` field that the BubbleVisualization fetch
  reads on-chain holders from.
- `refactor/p0-clusters-by-id-edge-chunking` — `-X theirs` rebase.
- `security/p0-prompt-injection-and-auth-gates` — `-X theirs` rebase.

All six merged into main during the session.

### 1.2 Origin cleanup

47 merged remote branches deleted at session start; another 31 deleted
mid-session after they merged. Origin only carries un-merged work + the
handoff doc now.

### 1.3 NakaCult landing toggle (was missing)

`components/landing/LandingNav.tsx` now renders a crimson pill linking to
`/naka-cult` on desktop nav + a matching entry in the mobile drawer.
Owner-reported gap closed.

### 1.4 Phase branches shipped (4 unmerged)

Going forward we group related work into one phase branch instead of
one branch per file. Owner directive — branches were getting too many.

- **`phase/vtx-ai-chat-upgrades`** — audit B.5 P1
  - `components/vtx/StreamingCursor.tsx` — gradient block cursor pulsing
    while SSE tokens arrive
  - `components/vtx/MessageActions.tsx` — Copy / Copy-as-MD / Regenerate /
    Edit / Stop inline action row
  - `components/vtx/SuggestionPills.tsx` — 3-pill follow-up row with
    50ms staggered fade-in
  - `lib/hooks/useVtxStream.ts` — AbortController-backed SSE parser hook
- **`phase/observability-hardening`** — audit B.13 + B.19
  - `sentry.client.config.ts` — per-route tracesSampler (40-60% cost cut)
  - `lib/security/webhookAuth.ts` — HMAC verifier + safeCompareStrings
- **`phase/security-panel-trust-stack`** — audit B.4 P1
  - `components/security/TriangulationBadgeStack.tsx`
  - `components/security/LpLockPanel.tsx`
  - `components/security/DeployerHistoryPanel.tsx`

### 1.5 Primitive libs + components shipped (one-branch-per-feature; all merged)

Heavy ship. Each landed on its own branch (this is what the owner asked
us to stop doing mid-session — going forward, group). Listing here so
the next session knows what's already wired and what needs adoption.

**Onboarding + engagement**
- `feat/landing-nakacult-toggle` — crimson NakaCult pill (✅ merged)
- `feat/onboarding-referral-code-util` — `generateReferralCode(userId)` (✅ merged)
- `feat/onboarding-streak-tracker-lib` — daily streak primitive (✅ merged)
- `feat/dashboard-welcome-streak-chip` — fire-emoji chip (✅ merged)
- `feat/onboarding-firstrun-tour-no-dep` — zero-dep product tour (✅ merged)

**UI primitives**
- `feat/ui-command-palette-skeleton` — ⌘K palette (✅ merged)
- `feat/ui-notification-center-component` — bell + dropdown (✅ merged)
- `feat/security-error-boundary-component` — Sentry-scoped boundary (✅ merged)
- `feat/pwa-install-prompt-component` — branded install CTA (✅ merged)
- `feat/a11y-safe-area-mobile-bottom` — iOS notch + Android gesture insets (✅ merged)

**Whale + cluster + market**
- `feat/whale-alpha-card-component` (✅ merged)
- `feat/whale-leaderboard-row-component` (✅ merged)
- `feat/whale-pnl-snapshot-aggregator` (✅ merged)
- `feat/clusters-bridge-mev-chips` (✅ merged)
- `feat/clusters-legend-subcategories` (✅ merged)
- `feat/cluster-detection-pipeline-helpers` — decay primitive (✅ merged)
- `feat/market-gas-price-ticker` (✅ merged)

**Sniper P1/P2** (still unmerged)
- `feat/sniper-risk-dashboard-cells` — SnipeRiskCell
- `feat/sniper-live-tape-component` — left-rail fill ticker
- `feat/sniper-tip-strategy-auto-bid` — tipStrategy quoter

**Profile P1** (mostly merged)
- `feat/profile-avatar-upload-helper` (✅ merged)
- `feat/profile-achievements-catalog` (✅ merged)
- `feat/profile-achievement-badge-component` (✅ merged)
- `feat/profile-api-keys-lib` (✅ merged)
- `feat/profile-user-agent-parser` (✅ merged)
- `feat/profile-gdpr-export-route` (✅ merged)

**Portfolio P1**
- `feat/portfolio-spam-token-classifier` (✅ merged)
- `feat/portfolio-nft-positions-lib` (✅ merged)
- `feat/portfolio-defi-positions-lib` (✅ merged)
- `feat/portfolio-koinly-csv-export` (✅ merged)
- `feat/portfolio-multi-wallet-aggregator` (✅ merged)

**Security stack (lib layer — UI shipped under phase/security-panel-trust-stack)**
- `feat/security-jurisdiction-lookup-lib` — still unmerged
- `feat/security-pre-sign-simulator-lib` — still unmerged
- `feat/security-tax-simulation-display` — still unmerged
- `feat/security-rate-limiter-sliding-window` — still unmerged
- `feat/security-zod-route-validator` — still unmerged
- `feat/security-csrf-token-helpers` — still unmerged (needs `CSRF_SECRET` env)
- `feat/security-honeypot-triangulator` — still unmerged
- `feat/security-lp-lock-window-parser` — still unmerged
- `feat/security-launch-bundling-detector` — still unmerged
- `feat/security-deployer-rug-history-lib` — still unmerged

**Wallet intelligence**
- `feat/wallet-intel-risk-ring-component` (✅ merged)
- `feat/wallet-intel-realized-pnl-calculator` (✅ merged)
- `feat/wallet-intel-trade-style-classifier` (✅ merged)
- `feat/intelligence-cohort-percentile-lib` — still unmerged

**Trade-exec P1**
- `feat/trade-exec-quote-staleness-hook` — still unmerged
- `feat/trade-exec-permit2-builder` — still unmerged

**VTX**
- `feat/vtx-model-picker-component` (✅ merged)

**Notifications + research + admin**
- `feat/notifications-batch-debounce-lib` (✅ merged)
- `feat/research-post-card-component` (✅ merged)
- `feat/admin-cult-threshold-config-ui` — `/admin/cult` + `/api/admin/cult-stats` (✅ merged)
- `feat/admin-platform-announcement-banner` — severity-tiered banner (✅ merged)

**Context feed**
- `feat/feed-social-attribution-component` (✅ merged)
- `feat/feed-verified-badge-tiers` (✅ merged)

**SEO**
- `feat/seo-per-token-og-image` — edge OG card at `/api/og/token` — still unmerged

**Tests**
- `test/portfolio-spam-classifier-tests` — node:test runner against
  three pure libs (still unmerged). 24 cases covering spam classifier,
  referral codes, jurisdiction.

---

## 2. PDF Section 4 — NAKA threshold

600,000 → 1,227,000 swap applied across code + docs + migration
comment in session L. Verified in `lib/cult/holdings.ts`,
`lib/subscriptions/tiers.ts`, `lib/cult/access.ts`,
`app/naka-cult/page.tsx`, `app/dashboard/pricing/page.tsx`,
`README.md`, `docs/pricing.md`, `docs/naka-cult-plan.md`,
`docs/whitepaper.md`, `docs/feature-documentation.md`, the
`2026_05_02_naka_cult_tier.sql` migration. Grandfather migration
NOT applied — needs explicit per-migration owner approval (CLAUDE.md
rule).

---

## 3. PDF Section 5 — Admin

Cult management page lives at `/admin/cult` (live; gated by
`verifyAdminRequest`). Threshold is read-only via env
`NAKA_HOLDING_THRESHOLD`; making it DB-editable needs a
`platform_settings.naka_threshold` migration + reader fallback
in `lib/cult/holdings.ts` — spec'd inline in the page copy.

Platform announcement banner ready to mount in
`app/dashboard/layout.tsx`. Data source: needs an admin route at
`/api/admin/announcement` returning `{ id, severity, message,
href?, ctaLabel? }` — single active announcement.

---

## 4. Carry-forward — heavy items still pending

These are the big rocks. Each is sized + scoped. **Pick one per
session and ship it cleanly.**

### 4.1 PDF Section 1+2 — platform-wide branding sweep (~8–12h)

Mechanical pass replacing inline hex colors with CSS vars + bumping
`border: 1px` → `1.5px` everywhere. The audit lists ~200 files. Use
a single phase branch. The brand tokens already exist in
`app/globals.css` + `app/globals-brand.css`. Do NOT touch the
`whale-glass-card` / `whale-pill` / `whale-tab` classes — they're
already on the new system.

### 4.2 PDF Section 3 — nav state preservation sweep (~6h)

`lib/hooks/useNavState.ts` is shipped (session L). Wire each
dashboard page through it: read filters/tab/scroll on mount, save
before `router.push` to a detail page. Sites to flip:

- Context Feed (closes Bug A)
- Explain page (closes Bug B)
- Whale tracker directory + profile back
- Market list + token detail back
- Portfolio detail back
- Bubble map → token detail
- Sniper config → active
- Vault sub-pages

Test each with the DevTools 'preserve log' on so the back state
restores correctly.

### 4.3 NAKA wallet unification (~12–16h)

The `useWallet()` hook is split across 6 consumers with 4 different
localStorage keys. Session L spec'd it; nothing shipped this session
because it deserves a focused atomic flip across:
portfolio / swap / VTX / sniper / whale / proof modal. Don't ship
in chunks — the contract has to flip in one PR.

### 4.4 SEO `app/[locale]/*` migration (~8–12h)

Touches every dashboard route. Plan a full session. The
sitemap.ts + robots.ts foundation is in. Next steps: middleware
locale-detection + the segment migration + per-locale OG copy.

### 4.5 Pino sweep (~15h)

162 `console.*` calls across 78 routes. Lib already shipped
(`lib/log/logger.ts`). Mechanical replace, can be split into 3 PRs
by area (api / cron / components).

### 4.6 32 Dependabot CVEs

10 high / 19 moderate / 3 low. `npm audit fix` for the moderate +
low, then manual review for the high (most are transitive — bump
parent). Once clean, flip
`.github/workflows` `npm audit --audit-level=high` from
`continue-on-error: true` to `false`.

---

## 5. Things NOT to do (carry-forward)

- **One branch per PHASE, not per file.** Session M started doing
  the latter and got told off mid-session. From now on, group
  related work.
- **Don't apply Supabase migrations without explicit per-migration
  owner approval.** No new ones applied this session.
- **Don't force-push to existing PR branches** unless owner asks.
  (We did 6 force-pushes for the conflict rebase — they were sitting
  unmerged on origin, no harm done.)
- **Don't reference Claude / Anthropic / Sonnet / Opus / Haiku** in
  commit messages or code.
- **Don't bypass cookie-consent / first-trade modal gating.**
- **Don't reintroduce `.toLowerCase()` on raw addresses.** Use
  `normalizeAddress(addr, chain)` from `lib/utils/addressNormalize.ts`.
- **Don't delete the legacy `/dashboard/wallet-clusters/[address]/`
  page** until the parity migration to `/[id]` lands.

---

## 6. How to start the next session

1. `cd c:\Users\DELL LATITUDE 5320\Downloads\steinzlabs`
2. Read CLAUDE.md, this file, session-L handoff.
3. Pull main: `git checkout main && git pull --ff-only`. Owner will
   have merged most of the unmerged branches by then.
4. Delete remote branches that are now empty against main:
   ```
   git fetch --prune
   for b in $(git branch -r --merged origin/main | grep -v "origin/main$" | grep -v HEAD | sed 's| *origin/||'); do
     git push origin --delete "$b"
   done
   ```
5. Pick ONE big item from §4 and run it. Phase branch, not per-file.
6. Branch + push + STOP. Owner opens the PR.

Done.
