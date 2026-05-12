# Session G handoff — Phase F (Chosen exclusives) + cleanup sweep + STUB CRONS

**For**: the next session (fresh context). Read this top-to-bottom before touching anything.
**From**: session F continuation, 2026‑05‑12. **Revision 3** — 5-agent deep audit findings folded in.
**User**: Phantomfcalls (founder/CEO Naka Labs, brand: Naka Labs / nakalabs.xyz, GitHub: moderator29).

## ★ Top-of-mind callouts (most important things you must not miss)

1. **9 cron jobs are STUBS** that return success without doing any work, burning Vercel cron credits hourly. Listed in §4m. Either implement or remove from `vercel.json`.
2. **Sniper bot has a silent data gap**: `sniper-monitor` writes `security_score: null` to every match because DexScreener doesn't provide it; any user criteria with `min_security_score > 0` will NEVER match a new pair. GoPlus enrichment happens only at execute-time. Listed in §4n risk #1.
3. **Most "open" branches are already merged** — 16 of 24 feature branches show `0 ahead, X behind` because they shipped via PRs that didn't delete the branch. Run the delete-merged-branches sweep in §4o.
4. **Only 2 branches actually have new work**: `fix/wagmi-tempo-build-failure` (4 commits ahead, the CI unblocker — MERGE FIRST) and `docs/handoff-session-g` (this file). Everything else listed earlier as "ready to merge" was either already merged or is a Dependabot bump.
5. **Public-facing branding gap is real** — 30+ pages outside `/dashboard/*` and `/vault/*` have no W aurora. Crimson `#DC143C` only appears in 12 files, almost all inside vault. Quantified in §4b.
6. **`docs/slash-commands-pricing` has 5 file conflicts and is 124 commits behind main** — user explicitly excluded it from scope. Don't touch, but document it.
7. **3 Chosen-exclusive (Phase F) features are not started**: Oracle next-day-seal write-access for Chosen, Sanctum playlist curation UI for Chosen, public-surface Chosen badge in dashboard identity strip. Conclave's 2x vote weight + Vault Chosen badge are already done.
8. **`@wagmi/connectors` and `lightweight-charts` are pinned** via `package.json` overrides (6.1.4 and ^5.2.0 respectively, see §3). Dependabot may try to bump these — verify any future bump doesn't reintroduce `tempoWallet` or v4-API breakage.

---

## 0 · Who you are working with — non‑negotiables

Phantomfcalls runs a tight, opinionated workflow. Match it exactly.

1. **Always audit your own work before claiming done.** Re-grep, re-tsc, re-build. Session F shipped a chart-migration fix that "passed tsc" but missed two dynamic-import files (`CandlestickChart.tsx`, `SparklineChart.tsx`) that would have blown up at runtime — the audit caught them. Don't ship without auditing.
2. **One branch per task. Never push to main directly. He merges every PR himself in the GitHub UI.** This is fast — he'll merge a lot, often back-to-back. Your job is to keep PRs green and conflict-free.
3. **Every commit author = `moderator29` only. Zero AI attribution** (no "Co-Authored-By: Claude", no Generated-with footer). Git is already configured this way; just don't add author trailers.
4. **Casual tone, picture-perfect bar.** Code quality is "top 1% MEVX/Nansen-grade." No mock data anywhere — real APIs only.
5. **WCAG AAA on the UI.** Don't ship colour pairs that fail contrast.
6. **Force-push is denied by sandbox.** Don't try `git push --force` / `--force-with-lease`. If you need to re-do a commit, make a new commit on top instead of amending+force.
7. **Ask permission before destructive git ops** (reset --hard on remote, branch -D, rm -rf node_modules without reason).
8. **TODO list = full backlog in plain English, then he picks.** When he says "todo list" he means the whole remaining surface, not just the current branch.

Memory file index: `C:\Users\DELL LATITUDE 5320\.claude\projects\c--Users-DELL-LATITUDE-5320-Downloads\memory\MEMORY.md` — has more user/feedback memories. Load them.

---

## 1 · Required MCP servers for this session

**You must have all three connected before doing anything substantive:**

| MCP | Why | If missing |
|---|---|---|
| **Supabase** (project `phvewrldcdxupsnakddx`) | Schema lookups, applying migrations, granting tier upgrades, debugging RLS, pulling logs | Ask user to connect via `/mcp` → Supabase → Authenticate |
| **Vercel** | Reading build/runtime errors from production, checking deployment status | Ask user to re-auth and **grant personal-account scope** (not just team) — current token is team-scoped and 403s on personal projects. The team ID is `team_YiyNREYxlCCmV9Zx9JQmFbCU` |
| **GitHub via `gh` CLI** | PR/issue management, CI status — this is via Bash not MCP, already works | n/a |

If Vercel MCP keeps 403‑ing, ask the user to paste deployment URL + error directly — much faster than fighting auth.

---

## 2 · Current repo state (as of session G start)

### Branches still open (local + remote)

Run `git fetch --prune && git branch -r | grep -v 'origin/HEAD'` to confirm. As of handoff:

**Mergeable, waiting for user to click merge in GitHub UI:**
- `fix/wagmi-tempo-build-failure` — CRITICAL, MERGE FIRST. Unblocks every other PR's CI.
- `fix/sniper-real-functionality-and-branding` — DexScreener fix + brand pass on sniper page
- `feat/expand-icons-2` — 23 new brand icons + lifted AuroraBackground to dashboard layout (visual ascension B+C+D+E in one shot)
- `feat/ascension-phase-a-dashboard` — dashboard + sidebar adopt brand layer (was: cult layer)
- `feat/oracle-foundation` — Daily Seal chamber
- `feat/sanctum-foundation` — music/memory chamber
- `feat/conclave-hardening` — proposals + voting hardening
- `feat/naka-cult-landing` — landing for Cult tier
- `feat/onchain-resolver` — on-chain holdings resolver + verify-membership cron
- `feat/ascension-B-market` / `C-wallet-settings` / `D-trading` / `E-longtail` — first-wave icon swaps. **These are partially superseded by `feat/expand-icons-2`'s aurora lift; user may want to cherry-pick or close them.** Ask before merging.
- `feat/brand-foundation` / `feat/icons-expansion` — foundation that's likely already in main; check `git cherry origin/main origin/<branch>` before merging.
- `fix/sniper-tier-gate-naka-cult` — **already merged into main** via PR #171 (commit `751bfc1`). Branch can be deleted.

**Dependabot:**
- `dependabot/npm_and_yarn/supabase-ad8f279af5`
- `dependabot/npm_and_yarn/zod-4.4.3`

**Docs / pricing:**
- `docs/handoff-session-f` — old handoff
- `docs/slash-commands-pricing` — pricing-related slash command docs (user said: **don't touch**)
- `docs/vault-v2-session-handoff`

### Order to merge (if no conflicts)
1. `fix/wagmi-tempo-build-failure` ← unblocks CI for everything else
2. `feat/expand-icons-2` ← aurora is now in dashboard layout, foundation for visual ascension
3. The cult chambers in any order: `oracle-foundation`, `sanctum-foundation`, `conclave-hardening`, `naka-cult-landing`, `onchain-resolver`
4. `fix/sniper-real-functionality-and-branding`
5. `feat/ascension-phase-a-dashboard`
6. The B/C/D/E ascensions (or close them if expand-icons-2 covered them — ask user)

After each merge, the next branch may need a rebase from main if it conflicts. Pattern: `git checkout <branch> && git reset --hard origin/<branch> && git merge origin/main` and resolve.

---

## 3 · Recent platform-wide fixes (so you don't redo them)

### `fix/wagmi-tempo-build-failure` (4 commits, must merge first)

Two upstream version drifts were breaking every PR:

1. **`@wagmi/connectors` resolved to 8.0.13 on Vercel** via peer-dep expansion through `@reown/appkit-adapter-wagmi`'s loose `wagmi: >=2.19.5` peer. The 8.x line ships `export { tempoWallet } from '@wagmi/core/tempo'` but our pinned `@wagmi/core@2.22.1` doesn't expose `./tempo` (only @wagmi/core@3.x does). Vercel build failed with `Module not found: Package path ./tempo is not exported from @wagmi/core`.
   - **Fix**: pinned direct dep to `@wagmi/connectors: 6.1.4` + npm `overrides` block (top-level + nested under `wagmi`) so the transitive can't drift on a clean install. Both 6.1.4 and 6.2.0 are runtime-equivalent for our usage; neither imports tempoWallet.
   - **Files**: `package.json`, `package-lock.json`.

2. **`lightweight-charts` was bumped to `^5.2.0`** (Dependabot merge) but v5 removed `addAreaSeries / addLineSeries / addCandlestickSeries / addBarSeries / addHistogramSeries`. Six chart files still used the v4 API → 7 type errors that failed `npx tsc --noEmit` on every PR.
   - **Fix**: kept `^5.2.0` (not a downgrade — user explicitly said "v4 is not professional"), migrated all 6 files to the v5 `chart.addSeries(SeriesType, options)` API. Added named imports `AreaSeries`, `BarSeries`, `CandlestickSeries`, `HistogramSeries`, `LineSeries` from `'lightweight-charts'`.
   - **Files migrated**: `app/dashboard/portfolio/page.tsx`, `components/intelligence/BubbleMapTimelineChart.tsx`, `components/whales/WhaleActivityChart.tsx`, `components/trading/AdvancedChart.tsx`, `components/market/CandlestickChart.tsx`, `components/market/SparklineChart.tsx`. The last two used dynamic imports + `any` so tsc didn't catch them — found via grep audit.

**Verified**: `npm ci --legacy-peer-deps && npx tsc --noEmit` → exit 0. **Do NOT revert this branch.**

### Visual ascension already lifted to layout

`app/dashboard/layout.tsx` now wraps children in `<AuroraBackground fullHeight>`. **Don't add per-page `<AuroraBackground>` wrappers** — they're redundant and cause merge conflicts. Per-page `bg-[#07090f]` / `bg-[#0A0E1A]` / `bg-[#0B0F1A]` solid backgrounds were stripped via sed in 237 files so the aurora actually shows through. 14 files still use `bg-[#0A0E1A]` inside cards/modals — that's intentional, leave them.

### Brand class library (already on main)

Defined in `app/globals-brand.css`:
- `.nl-aurora-bg` — used by `AuroraBackground` component
- `.nl-card` — replaces `bg-white/[0.03] border border-white/10` patterns
- `.nl-button` — replaces `bg-gradient-to-r from-blue-600 to-blue-800` patterns
- `.nl-button--ghost` — outline variant

Brand icons live at `@/components/icons/brand` (~80 icons after expand-icons-2 merges). Same prop API as lucide-react so `import { Wallet } from 'lucide-react'` → `import { Wallet } from '@/components/icons/brand'` is mechanical. Specialty icons not yet in brand library (Dna, Trophy, Network, Radio, Bot, FlaskConical, etc.) fall back to lucide via the **hybrid-import pattern** already used in dashboard/page.tsx and SidebarMenu.tsx. Don't fight this — when an icon isn't in brand, just import from lucide.

### Cult icons retired

`components/icons/cult/index.tsx` was deleted on commit `9bb5478` and folded into `@/components/icons/brand`. Any branch that still imports from `@/components/icons/cult` needs the path rewritten.

---

## 4 · The remaining backlog — every single thing

Plain English, prioritized. User picks the order; this is the universe.

### 4a · Phase F (Chosen exclusives) — the gated work

**Status**: gated until all current PRs merge cleanly. Per user, "do them all then audit them then after that you can then begin f". Now that the wagmi+charts fix unblocks CI, this can start once the merge sweep is done.

What "Phase F" means: features only the 3 Chosen Cult accounts can see. Cult tier (`profiles.tier = 'naka_cult'` AND `profiles.is_chosen = true`) is the 5th tier above MAX. Server-side gate at `getCultAccess()`.

Concrete sub-features Phase F should ship:
1. **Chosen Vault** — extra chamber inside `/vault` only chosen members reach. Glassmorphic, gold accents (already in `vault.css` under `.vault-identity--chosen`).
2. **Chosen Conclave privileges** — weighted votes, ability to escalate proposals, see proposer identity early.
3. **Chosen Oracle** — write access to next day's seal (currently auto-generated by Anthropic Opus cron).
4. **Chosen Sanctum** — curate the public Spotify playlist (storage_path: `spotify:playlist:4ZjnNBKs9x7XdHPLQJmsiK`).
5. **Chosen badge** in identity strip everywhere user appears (already partially implemented in `vault-identity__rank` styling; verify).

Server-side: every Chosen-only API route MUST check `getCultAccess(req)` before returning data. Don't trust client.

### 4b · Pending UX / branding work — be honest, lots is undone

The W image branding (deep navy `#050816` canvas + crimson `#DC143C` + electric blue `#0066FF`/`#00C8FF` aurora ribbons + 3 glowing icons rocket/helmet/pentagon) is what user means by "platform-wide branding." Status:

**What IS branded (W look-and-feel applied):**
- `/dashboard/*` — every dashboard page inherits aurora via `app/dashboard/layout.tsx` lift ✅
- `/vault/*` (Cult chambers) — gold + crimson + blue aurora live in `app/vault/vault.css` ✅
- `/brand` preview page ✅
- Brand tokens defined in `app/globals-brand.css` (`--nl-canvas-base: #050816`, `--nl-blue: #0066FF`, `--nl-crimson: #DC143C`, etc.) and `lib/brand/tokens.ts` ✅
- Brand icon library at `@/components/icons/brand` (~80 icons, with the 3 W glowing styles: rocket/helmet/pentagon variants) ✅
- `.nl-aurora-bg`, `.nl-card`, `.nl-button` CSS classes defined ✅

**What is NOT branded yet — significant gap, 30+ public pages:**

The PUBLIC-facing pages — what visitors see BEFORE logging in — still use plain solid backgrounds, no W aurora, no crimson accents. **This is the gap user asked about** when he said "have platform wide branding been changed to the w logo branding color with that maybe red" — answer: NO for the public surface area. The W crimson `#DC143C` is barely visible outside the cult chamber.

| Page | Current state | What's needed |
|---|---|---|
| `app/page.tsx` (root marketing/landing) | inline `style={{ background: '#07090f' }}`, no aurora | Wrap in `<AuroraBackground fullHeight>`, strip solid bg, use crimson+blue gradient on hero CTA |
| `app/login/page.tsx` | `naka-auth-page` (theme-flip class only, no aurora) | Aurora + W gradient buttons |
| `app/signup/page.tsx` | same | same |
| `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` | unbranded | aurora + brand pass |
| `app/research/page.tsx` | `bg-[#080C18]`, hand-rolled `bg-[#0A1EFF]` button | aurora + nl-button |
| `app/market/page.tsx`, `prices/`, `watchlist/`, `orders/` | unbranded | aurora |
| `app/portfolio/page.tsx` | unbranded | aurora |
| `app/security-center/page.tsx` | unbranded | aurora |
| `app/dna-analyzer/page.tsx` | unbranded | aurora |
| `app/docs/page.tsx` | unbranded | aurora |
| `app/contact/page.tsx`, `app/privacy/page.tsx` | unbranded | aurora |
| `app/alerts/page.tsx` | unbranded | aurora |
| `app/intelligence/[token]/page.tsx` | unbranded | aurora |
| `app/naka-cult/page.tsx` | partial (custom CSS at `app/naka-cult/landing.css`) | verify W brand alignment |
| `app/s/[id]/page.tsx` (share previews) | unbranded — public OG cards, may need lighter treatment | UX call |
| `app/auth/page.tsx`, `app/auth/callback/page.tsx`, `app/auth/clear/page.tsx` | transient flows, may not need full aurora | UX call |

**Recommended fix pattern (per page):**
1. Import `AuroraBackground` from `@/components/brand/AuroraBackground`
2. Wrap the outer return in `<AuroraBackground fullHeight>...</AuroraBackground>`
3. Strip `bg-[#07090f]` / `bg-[#080C18]` / inline `style={{ background }}` from the inner container
4. Replace `bg-gradient-to-r from-blue-XXX to-blue-XXX` CTAs with `nl-button`
5. Replace `rounded-xl border border-white/10 bg-white/[0.03]` cards with `nl-card`

**Quantitative gaps:**
- **26 files** still use raw `bg-white/[0.03] border border-white/10` card pattern instead of `nl-card`
- **Only 12 files** currently use W crimson colors (`DC143C` / `FF1744` / `FF3DCB`) — almost all inside the cult/vault chamber. The platform feels "generic dark blue," not "Naka Labs W identity."
- **Public homepage has zero crimson accents and no aurora** — first impression doesn't sell the brand

**Sub-component icon swaps (Step 2 from session F)**: deferred. Lucide imports remain in many sub-components across `components/market/`, `components/smart-money/`, `components/whales/`, `components/intelligence/`, `components/security/`, `components/trading/`, `components/settings/`. A sed sweep can't safely do this — needs per-file judgment because specialty names collide. Pick a cluster, swap mechanically, ship. Pattern in `app/dashboard/sniper/page.tsx` is the canonical template (hybrid lucide+brand import).

**Mobile sidebar visual pass**: `SidebarMenu.tsx` hasn't had brand pass — uses lucide icons + raw bg.

**Light theme**: `[data-theme="light"]` handling exists in `app/globals.css` for `naka-auth-page` only. If user wants light theme platform-wide, that's a separate workstream.

**Hero / homepage motion**: W image has implied motion from aurora ribbons. `.nl-aurora-bg::after` has a 30s `vault-drift` keyframe scoped to `/vault`. The dashboard aurora is static. If user wants cinematic motion everywhere, lift `vault-drift` keyframes to the global aurora.

### 4c · Schema / Supabase pending

Run `git log --all --oneline -- supabase/migrations/` to see what's recently shipped. Recent additions on main include:
- `2026_05_04_cult_daily_seals.sql`
- `2026_05_04_cult_proposals_resolution_columns.sql`
- (more — check `supabase/migrations/` directory)

**User upgrade still pending verification**: `nmcfface@gmail.com` should have MAX tier (full access, not admin). Only `phantomfcalls@gmail.com` is admin. User said "i did it on supabase" but verify with:
```sql
SELECT id, email, tier, is_chosen FROM profiles WHERE email IN ('nmcfface@gmail.com', 'phantomfcalls@gmail.com');
```
via Supabase MCP `execute_sql`.

### 4d · Empty / merged branch cleanup

User asked to "delete all empty branches that have nothing to merge." Do this via `gh`:
```bash
# List branches with no commits ahead of main
for b in $(git branch -r | grep -v 'HEAD\|main'); do
  ahead=$(git rev-list --count origin/main..$b 2>/dev/null)
  [ "$ahead" = "0" ] && echo "MERGED/EMPTY: $b"
done
```
Confirmed safe-to-delete: `fix/sniper-tier-gate-naka-cult` (already in main as PR #171). Anything else with `0 ahead` and `git cherry origin/main origin/<branch>` returning empty.

### 4e · Sniper bot follow-ups

`fix/sniper-real-functionality-and-branding` resolves the *matcher* (cron now reads DexScreener live, defaults `max_age_hours=24` when null, treats null-enriched fields as "allow"). What's still TODO post-merge:
- **GoPlus enrichment at execute-time**: matcher writes events with `security_score: null`, etc. Real scoring + honeypot block needs a separate `/api/sniper` POST step that calls GoPlus before firing the trade.
- **Price-target trigger**: `trigger_type = 'price_target'` is wired in the schema but the cron only emits empty events; needs price feed integration.
- **Auto-execute path**: events with `decision = 'sniped_pending'` need a separate executor cron (`/api/cron/sniper-auto-execute` exists in vercel.json, verify implementation).

### 4f · CI / dependency hygiene

- 36 GitHub Dependabot vulnerabilities (12 high / 19 mod / 5 low) — see https://github.com/moderator29/steinzlabs/security/dependabot. Triage when not in active feature work.
- `npm audit --audit-level=high` is informational in CI and currently fails (not blocking). Worth a clean-up pass.
- `lightweight-charts ^5.2.0` is now correctly migrated. If Dependabot opens further bumps, run `npx tsc --noEmit` after merging — major wagmi/viem/lightweight-charts bumps are the usual offenders.

### 4g · Open vulnerabilities at OS/repo level

GitHub flagged **36 vulns on default branch** as of last push. Check `Security` tab on the repo, prioritize criticals/highs.

### 4h · Sniper cron implementation gaps

`vercel.json` schedules 40+ crons. The sniper-related ones to verify on next session:
- `/api/cron/sniper-monitor` — fixed on `fix/sniper-real-functionality-and-branding` (matcher now reads DexScreener)
- `/api/cron/sniper-auto-execute` — route file exists at `app/api/cron/sniper-auto-execute/route.ts`. Verify it actually consumes `decision: 'sniped_pending'` events and executes the buy via signer.
- `/api/cron/sniper-autosell` — route file exists. Verify TP/SL/trailing-stop logic actually fires on open positions.
- `/api/cron/limit-order-monitor`, `/api/cron/stop-loss-monitor` — verify same.
- `/api/cron/dca-executor` — DCA path.

For each: run a quick smoke (curl the route locally with `Authorization: Bearer ${CRON_SECRET}`) and check it doesn't 500. Production health is monitored via `/api/cron/health-watch`.

### 4i · Product features the user has explicitly named but aren't in the handoff yet

From session F handoff + memory:
- **VTX AI inline commands**: the `/dashboard/vtx-ai` agent supports inline cards (rocket/helmet/pentagon triggers per memory). Verify all commands wired.
- **Smart-money clustering**: `lib/cult/holdings.ts` deletion appeared in many ascension branches' diffs — was it intentional or a stale merge? Check `git log -- lib/cult/holdings.ts` to see when/why it was removed.
- **Whale Tracker submit / directory flows**: `/dashboard/whale-tracker/submit`, `/dashboard/whale-tracker/directory` — verify the public submission flow has anti-spam (rate-limit, captcha).
- **WGM Runner** (`/dashboard/wgm-runner`) — large file (1300+ lines), unknown state, ask user if it's actively maintained or dead-code candidate.
- **Notifications**: `FloatingNotificationBell`, `AlertMonitorProvider`, `PendingTradesBanner`, `PlatformEventMonitor` — all mounted in dashboard layout. Verify each connects to a live event source.
- **Telegram bot** integration: per memory, "Telegram Bot" tier-based commands + automatic notifications. Verify env wiring + cron `/api/cron/telegram-heartbeat`.
- **Cult Conclave proposals / voting / resolution** — proposals table has a resolution_columns migration; verify the resolver cron `/api/cron/cult-resolve-proposals` actually closes votes correctly.
- **Daily Seal** — Anthropic Opus call in `/api/cron/cult-generate-daily-seal`. Verify token usage doesn't blow budget; check error handling.

### 4j · Build & deploy infra checks the user may want addressed

- **Vercel project ID**: not stored locally — user has it. The team ID from a 403 error was `team_YiyNREYxlCCmV9Zx9JQmFbCU` but `list_projects` 403'd, meaning the OAuth scope was wrong. Either ask user to grant personal scope or paste deployment URL directly.
- **Vercel env vars**: CI build uses placeholders (see `.github/workflows/ci.yml`). Real values are only in Vercel. If runtime breaks but local works, check Vercel env vs `.env.local`.
- **`maxDuration` on serverless routes**: most cron routes have `export const maxDuration = 60`. Anthropic/DexScreener-heavy routes may need 300. Check timeouts in Vercel function logs.
- **Domain**: production = `nakalabs.xyz` per memory. Verify `NEXT_PUBLIC_SITE_URL` matches.
- **Next.js 16**: package.json pins `next: "^16.2.4"`. Next 16 is recent — watch for breaking changes when Dependabot bumps it.
- **Webpack vs Turbopack**: build script uses `next build --webpack` explicitly. Don't switch to Turbopack without testing — lightweight-charts dynamic imports might break.

### 4k · Brand consistency audit — small but visible

- **`SteinzLogo` component**: appears in nav + sidebar. Verify it renders the W mark correctly + uses brand tokens, not hardcoded colors.
- **Favicon / OG images / Twitter cards**: check `app/icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `public/`. Should match W brand (deep navy + crimson + blue).
- **Empty states**: every "no data yet" UI throughout the platform should use brand voice + crimson `nl-no` warning color (where appropriate) instead of generic gray.
- **Loading skeletons**: many components use raw gray skeletons. Brand-aligned version uses subtle blue/crimson shimmer.
- **Error pages**: `app/not-found.tsx`, error boundaries — verify they look like Naka Labs, not Next.js defaults.

### 4l · Things explicitly OFF-LIMITS (don't touch in session G)

- `docs/slash-commands-pricing` — user said "expect command pricing" during conflict resolution. Branch is 124 commits behind main with 5 file conflicts; leave it stale.
- Direct merges to `main` (always via PR)
- `git config` changes
- Force-push to any branch (sandbox blocks anyway)
- Skipping CI hooks (`--no-verify`)

### 4m · STUB CRONS — burning Vercel credits for nothing

The deep audit found **9 cron routes** scheduled in `vercel.json` that exist as files but return `cronResponse("...", startedAt)` immediately without doing work. These fire on schedule and consume Vercel cron-invocation quota.

| Cron path | Schedule | Status |
|---|---|---|
| `/api/cron/context-feed-poll` | `*/10 * * * *` | STUB — line 7-11 of route.ts is just `return cronResponse(...)` |
| `/api/cron/smart-money-ranking` | `0 */6 * * *` | STUB |
| `/api/cron/cluster-analysis` | `0 */6 * * *` | STUB |
| `/api/cron/network-metrics` | `*/30 * * * *` | STUB |
| `/api/cron/trends-aggregator` | `*/30 * * * *` | STUB |
| `/api/cron/narrative-detection` | `0 */2 * * *` | STUB |
| `/api/cron/fear-greed-index` | `0 * * * *` | STUB |
| `/api/cron/alert-monitor` | `*/5 * * * *` | STUB — surprising, this is referenced everywhere as if it works |
| `/api/cron/whale-ranking-refresh` | `0 */6 * * *` | STUB |

**Action**: For each, decide IMPLEMENT or REMOVE. `alert-monitor` being a stub is the biggest problem — the alerts UI (`/dashboard/alerts`) and `AlertMonitorProvider` mounted in the dashboard layout suggest a fully wired alerts pipeline, but there's no actual evaluator. Either build it or stop pretending it exists.

**Working crons that ARE implemented** (do NOT touch): sniper-monitor, sniper-auto-execute, sniper-autosell, limit-order-monitor, stop-loss-monitor, dca-executor, copy-trade-monitor, pending-trades-cleanup, receipt-reconciliation, security-monitor, whale-activity-poll, whale-backfill-pnl, whale-logo-backfill, market-stats-snapshot, daily-digest, token-popularity-aggregator, watchlist-refresh, notification-digest, expired-nonces-cleanup, stale-cache-cleanup, login-activity-prune, telegram-heartbeat, vtx-usage-reset, price-cache-refresh, health-watch, publish-scheduled-research, cult-generate-daily-seal, cult-verify-membership, cult-refresh-treasury, cult-resolve-proposals.

### 4n · Sniper bot — production risks (must address before next sales pitch)

| # | Risk | Severity | Fix |
|---|---|---|---|
| 1 | `sniper-monitor` writes `security_score: null` for every new-pair match because DexScreener doesn't provide GoPlus data. Criteria with `min_security_score > 0` (the default modal value is 60!) will reject all candidates indefinitely. | 🔴 HIGH | Option A: call GoPlus inline during sniper-monitor (adds 1–2s latency per token). Option B: new `sniper-enrich-security` cron that backfills matches with `security_score: null`. Do B — cheaper. |
| 2 | Daily spend cap has a race condition: cron tick reads "$450 spent / $500 cap" then matches 5 tokens × $100 in same tick → writes $500 overage. No atomic check-and-set. | 🟡 MED | DB-level CHECK constraint or wrap match-loop in transaction with row-level lock on criteria. |
| 3 | `verifyCron()` warns "CRON_SECRET not set, allowing (dev mode)" and lets unauthenticated crons run. If a non-prod deploy forgets to set `CRON_SECRET`, anyone can spam-trigger cron endpoints. | 🟡 MED | In `app/api/cron/_shared.ts`, only allow no-secret if `NODE_ENV === 'development'`. |
| 4 | TON chain in `sniper-autosell` returns `null` from price feed → position never triggers. Silently held. | 🟡 MED | Either don't allow TON in sniper, OR add TonAPI / DEX price source. |
| 5 | No per-user concurrency limit. A user with 100 enabled criteria gets all 100 processed every 5 min. Could timeout / OOM. | 🟡 MED | Cap at e.g. 10 criteria per user per tick; round-robin remaining on next tick. |
| 6 | Slippage from criteria gets written into `pending_trades` but is NOT re-validated at confirm time. User signs assuming 1% slippage; market actually moved 5%. | 🟡 MED | Re-quote on confirm, reject if slippage exceeds tolerance. |
| 7 | `POST /api/sniper/criteria` doesn't verify the supplied `wallet_addresses[]` actually belong to the user. | 🟡 MED | Validate each address against `user_wallets_v2` for the requester before insert. |

### 4o · Branch cleanup — most "open" branches are actually merged

Deep git audit ran `git cherry origin/main origin/<branch>` for every remote branch. Findings:

**16 fully-merged branches to delete** (run `git push origin --delete <branch>` for each, or use GitHub UI):
- `feat/ascension-B-market` (0 ahead, 43 behind — merged via PR #160, superseded by expand-icons-2)
- `feat/ascension-C-wallet-settings` (PR #161)
- `feat/ascension-D-trading` (PR #162)
- `feat/ascension-E-longtail` (PR #163)
- `feat/ascension-phase-a-dashboard` (PR #164)
- `feat/brand-foundation`
- `feat/conclave-hardening` (PR #165)
- `feat/expand-icons-2` (PR #166)
- `feat/icons-expansion`
- `feat/naka-cult-landing` (PR #167)
- `feat/onchain-resolver` (PR #168)
- `feat/oracle-foundation` (PR #169)
- `feat/sanctum-foundation` (PR #172)
- `fix/sniper-real-functionality-and-branding` (PR #170)
- `fix/sniper-tier-gate-naka-cult` (PR #171)
- `docs/vault-v2-session-handoff` (57 behind, fully merged)

**2 stale Dependabot branches to delete** (superseded by newer Dependabot PRs):
- `dependabot/npm_and_yarn/supabase-ad8f279af5` (replaced by supabase-cc07b7ee10)
- `dependabot/npm_and_yarn/zod-4.4.3` (47 behind, major bump, has lingered)

**4 fresh Dependabot branches ready to merge** (created 2026-05-11, all clean):
- `dependabot/npm_and_yarn/anthropic-f2f26f87af` — @anthropic-ai/sdk bump
- `dependabot/npm_and_yarn/next-stack-a60a7d7079` — Next + related deps
- `dependabot/npm_and_yarn/supabase-cc07b7ee10` — supabase-js bump
- `dependabot/npm_and_yarn/types-only-e17aa6991a` — @types/node

**Branches with real new work**:
- `fix/wagmi-tempo-build-failure` (4 commits ahead — MUST MERGE FIRST, unblocks all CI; pins @wagmi/connectors 6.1.4 + migrates 6 chart files to lightweight-charts v5)
- `docs/handoff-session-g` (this file, 6 commits ahead)

**Conflict-stuck**:
- `docs/slash-commands-pricing` (1 ahead, 124 behind, 5 conflicting files: `app/api/whales/[address]/ai-summary/route.ts`, `app/api/whales/[address]/logo/route.ts`, `lib/copy/matcher.ts`, `lib/sniper/matcher.ts`, `lib/utils/addressNormalize.ts`). User said OFF-LIMITS.

**Merge order recommendation**:
1. `fix/wagmi-tempo-build-failure` (MUST be first — every other CI run depends on it)
2. The 4 fresh Dependabot PRs
3. `docs/handoff-session-g`
4. Delete the 16 + 2 stale branches in one sweep

### 4p · Cult / Phase F — exact built-vs-not-built table

| Feature | State | Files / Where to extend | Open work |
|---|---|---|---|
| Tier ladder + ranks (`free|mini|pro|max|naka_cult`) | ✅ SHIPPED | `lib/hooks/useAuth.ts:46`, `lib/subscriptions/tierCheck.ts:15-21` | none |
| Server-side cult gate `getCultAccess()` | ✅ SHIPPED | `lib/cult/access.ts` | none |
| Vault layout gate (server-side redirect) | ✅ SHIPPED | `app/vault/layout.tsx` | redirects to `/naka-cult` |
| `/naka-cult` public landing page | ✅ SHIPPED | `app/naka-cult/page.tsx` + `landing.css` | full cinematic dramatic page |
| Vault landing with 3 chamber portals | ✅ SHIPPED | `app/vault/page.tsx`, `components/vault/ChamberPortal.tsx`, sigils | none |
| **Conclave** — proposals, votes, treasury, resolution | ✅ SHIPPED (complete cycle) | `app/vault/conclave/*`, `app/api/cult/proposals/*`, `cult-resolve-proposals` cron | none — fully working |
| Conclave Treasury panel | ✅ SHIPPED | `app/vault/conclave/TreasuryPanel.tsx`; reads latest `cult_treasury_snapshots` row | USD conversion stubbed (`balance_usd` is null) |
| **Oracle Daily Seal** | ✅ SHIPPED | `components/vault/oracle/DailySeal.tsx`, `app/api/cult/oracle/daily-seal/route.ts`, `cult-generate-daily-seal` cron (Claude Opus 4.7) | none — but model is hardcoded, no fallback |
| Oracle 3 sub-chambers (VTX Sage, Whisper Network, Echo Chamber) | ⛔ STUB | `components/vault/oracle/OracleHubClient.tsx` — placeholder cards marked `eta="Next pass"` | All 3 need implementation |
| **Sanctum Library** (music) | ✅ SHIPPED | `components/vault/sanctum/LibraryPlayer.tsx`, `app/api/cult/sanctum/library/route.ts`, `cult_ambient_tracks` table | Spotify embed when all tracks share playlist |
| Sanctum 3 sub-chambers (The Mantle, The Annals, The Forge) | ⛔ STUB | `components/vault/sanctum/SanctumHubClient.tsx` — placeholder cards | All 3 need implementation |
| Vault identity strip with Chosen badge (gold trim) | ✅ SHIPPED | `components/vault/IdentityStrip.tsx`, CSS `.vault-identity--chosen` | only visible inside Vault |
| **Chosen 2x vote weight in Conclave** | ✅ SHIPPED | `app/api/cult/proposals/[id]/vote/route.ts:57` (`weight = access.isChosen ? 2 : 1`) | gold halo on `VoteOrbs.tsx` |
| **Chosen Oracle next-day-seal write access** (Phase F) | ⛔ NOT STARTED | Need: `POST /api/cult/oracle/daily-seal/draft`, migration adding `cult_daily_seal_drafts` (or `author_id, is_draft` cols on `cult_daily_seals`), Chosen-only UI in OracleHubClient | full vertical slice |
| **Chosen Sanctum playlist curation** (Phase F) | 🟡 PARTIAL plumbing | `cult_ambient_tracks` table has `display_order` + `is_active`. Need: `POST /api/cult/sanctum/library/reorder`, `DELETE .../:track_id`, drag-drop UI, RLS update | API + UI + RLS |
| **Chosen badge in dashboard identity strip** (not just Vault) | 🟡 PARTIAL | `components/ui/TierBadge.tsx` shows tier only | Add Chosen marker to dashboard user menu |
| On-chain holdings resolver | ⚙ WIRED but DISABLED | `lib/cult/holdings.ts`, `cult-verify-membership` cron | Awaits `NAKA_TOKEN_CONTRACT` / `NAKA_LOYALTY_GEM_CONTRACT` / `NAKA_DEV_NFT_CONTRACT` envs. Until then, tier is set manually via SQL. |
| Treasury USD enrichment | ⛔ STUBBED null | `cult-refresh-treasury` cron writes `balance_usd: null` | Add price-API lookup in cron |
| Treasury governance execution | ⛔ MANUAL | Treasury motions can be raised + resolved but execution is manual | Future: signer integration |

### 4q · Schema snapshot — what's in Supabase right now

Migration directory: `supabase/migrations/`. Files inventoried (chronological):
- `20260413_auth_rate_limits.sql` — auth rate-limiting
- `20260413_full_schema.sql` — **master schema**, 35+ tables: profiles, users, wallet_accounts, transaction_history, token_approvals, positions, limit_orders, stop_loss_orders, take_profit_orders, dca_configs, sniper_executions, swap_logs, alerts, price_alerts, followed_entities, contacts, watchlist, whale_watchlist, wallet_clusters, wallet_cluster_members, wallet_profiles, smart_money_wallets, holder_snapshots, notifications, notification_settings, push_subscriptions, push_delivery_log, scans, threats, research_posts, broadcasts, engagement, platform_settings, revenue_records, fee_revenue. All have RLS with `auth.uid()` checks; `handle_new_user()` trigger on auth.users.
- `20260419_wave5_schema_heal.sql` — repair pass
- `20260420_platform_stats.sql` — `platform_stats_history`
- `20260420_research_scheduled_at.sql` — scheduled-post column
- Subsequent (cult layer): `2026_05_02_vault_foundation.sql` (cult_ambient_tracks, cult_user_preferences, profiles.is_chosen), `2026_05_02_conclave.sql` (cult_proposals, cult_proposal_votes, cult_proposal_comments, cult_treasury_snapshots), `2026_05_04_cult_daily_seals.sql`, `2026_05_04_cult_proposals_resolution_columns.sql`
- Plus migrations for sniper criteria v2, copy-trading, DCA bots, stop-loss orders (v2), pending_trades, receipt reconciliation columns, whale activity, whale labels, etc.

Tables to remember (schema gotchas already in MEMORY.md): `whales.label` (not `name`), `price_alerts.price` (not `target_price`), `user_wallets_v2` (JSONB shape), `profiles.is_chosen` (boolean — Cult-Chosen flag, NOT in client-side UserProfile type, only fetched server-side via `getCultAccess()`).

Supabase client wiring (verify on next session):
- `lib/supabase.ts` — public client (anon key)
- `lib/supabaseAdmin.ts` — admin client (service_role)
- `lib/supabaseServer.ts` (or via `@supabase/ssr`) — server-side SSR client

Realtime subscriptions — verify on next session by grepping `.channel(` and `.on('postgres_changes'` patterns. Known users: Conclave proposal feed + vote orbs.

Storage buckets — unconfirmed; verify on next session.

User upgrade for `nmcfface@gmail.com` to MAX:
```sql
UPDATE profiles SET tier = 'max', tier_expires_at = NULL WHERE email = 'nmcfface@gmail.com';
SELECT id, email, tier, is_chosen FROM profiles WHERE email = 'nmcfface@gmail.com';
```
User said done via Supabase manually — verify before assuming.

### 4r · Detailed branding gap counts (quantified)

Run these greps to refresh numbers:
```bash
grep -rln "bg-white/\[0.03\] border\|bg-white/\[0\.03\]" app components 2>/dev/null | wc -l
# Currently: 26 files still using raw card pattern instead of .nl-card

grep -rln "DC143C\|FF1744\|#FF3DCB" app components 2>/dev/null | wc -l
# Currently: 12 files — almost all inside cult/vault. W crimson barely visible elsewhere.

grep -rln "from-blue-600 to-blue-800\|from-blue-500 to-purple-600" app components 2>/dev/null | wc -l
# Currently: 1-2 files

grep -rln "bg-\[#07090f\]\|bg-\[#0A0E1A\]\|bg-\[#080C18\]\|bg-\[#0B0F1A\]" app components 2>/dev/null | wc -l
# Currently: ~14 inside cards/modals (intentional); but root landing + 30+ public pages still solid bg
```

**Worst-offender sub-component dirs** (lucide-only, zero brand adoption):
- `components/intelligence/` — 5 files, 0 brand icons, 0 nl-card
- `components/landing/` — 17 files, 0 brand icons, custom inline gradients everywhere
- `components/whales/`, `components/security/`, `components/trading/`, `components/dashboard/` — same pattern
- `components/market/` — 32 files, only 3 use brand icons

**Inline-style anti-patterns** (verified file:line):
- `app/page.tsx:15` — `style={{ background: '#07090f' }}`
- `app/contact/page.tsx:11,21,37,53` — `bg-[#07090f]` + `bg-[#111827]` cards
- `app/privacy/page.tsx:25`, `app/terms/page.tsx:25` — `bg-[#080C18]`
- `app/research/page.tsx:45` — `bg-[#080C18]` + `bg-[#0A1EFF]` button
- `app/error.tsx:23` — `background: '#0A0E1A'` + hand-rolled spinner + hand-rolled `#0A1EFF` button
- `components/landing/LandingNav.tsx:31` — inline scroll-toggle bg
- `components/landing/LandingNav.tsx:53` — `background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)'` (should be `--nl-grad-bluecrimson`)
- `components/landing/HeroSection.tsx:29` — `linear-gradient(160deg,#0A1EFF 0%,#050ea8 20%,#07090f 55%)` (hand-rolled)
- `app/globals.css:26-37` — old `--primary: #0A1EFF` / `--bg-card: #111827` token vars still in use; should migrate to `--nl-*` system

### 4s · Other things found in deep audit — small but real

- **Error boundary** (`app/error.tsx`) uses hand-rolled `#0A1EFF` spinner + button, not `.nl-loader` / `.nl-button`. Branded error UX is a quick win.
- **No `app/not-found.tsx`** — Next.js shows default 404. Add a branded 404 page.
- **Dashboard `TabSpinner`** (in `app/dashboard/page.tsx:33-39`) is hand-rolled. Use `.nl-loader`.
- **`alert-monitor` cron is a stub** but `AlertMonitorProvider` is mounted in dashboard layout and `/dashboard/alerts` exists — the UX implies a wired alerts system. Either implement the cron or ship a "alerts in beta" disclaimer.
- **`copy-trade-monitor` security gate**: if relayer returns `securityBlocked=true`, trade is marked failed but never retried. Consider adding a `failure_reason` UI surface so users know why their copy didn't execute.
- **Telegram bot token** + **Anthropic API key** read directly from `process.env`. No secret rotation policy or secret manager integration. If either leaks, attacker can abuse the bot or rack up Anthropic spend.
- **No `app/api/trades/confirm` route traced** during sniper audit — the non-custodial sniper flow REQUIRES the browser to pull a queued `pending_trade` and sign it. Verify this route + UX exists and works; otherwise sniper auto-execute writes events nobody can finalize.
- **`wgm-runner` page** is 1300+ lines, unclear status. Ask user if it's actively maintained.

---

## 5 · How to start session G — exact opening sequence

```bash
# 1. Sync
cd "c:\Users\DELL LATITUDE 5320\dev\steinzlabs"
git fetch --prune origin
git checkout main && git pull --ff-only

# 2. Confirm CI baseline is green
npm ci --legacy-peer-deps
npx tsc --noEmit                # must exit 0
# (no need to run full next build unless something feels off)

# 3. Verify MCPs
# In Claude Code: try mcp__supabase__list_projects and mcp__vercel__list_teams
# If either errors, ask user to /mcp reconnect before doing real work.

# 4. Read MEMORY.md to load user/feedback context

# 5. Survey branches for conflicts before working on anything new
for b in $(git branch -r | grep -E 'origin/(feat|fix)/' | grep -v HEAD); do
  out=$(git merge-tree --write-tree origin/main $b 2>&1)
  echo "$out" | grep -q "CONFLICT" && echo "CONFLICT: $b" || echo "OK:       $b"
done

# 6. Ask user what they want to tackle. Do NOT assume Phase F right away —
#    he may want the merge sweep + dependabot triage first.
```

---

## 6 · What NOT to do

- ❌ Don't add per-page `<AuroraBackground>` wrappers (layout has it).
- ❌ Don't downgrade `lightweight-charts` back to v4 — user wants modern.
- ❌ Don't sweep-replace lucide imports across all sub-components in one shot — collisions, unsafe.
- ❌ Don't push to main directly. Don't merge your own PRs. Don't `--no-verify`.
- ❌ Don't add AI co-author trailers to commits.
- ❌ Don't write planning/decision/analysis markdown files unless explicitly asked. (This handoff is the exception, requested.)
- ❌ Don't touch `docs/slash-commands-pricing` — user explicitly excluded it from scope.
- ❌ Don't blindly trust merge-tree's "no conflict" output; GitHub UI can still block on CI / branch-protection. Always test with an actual local merge before claiming a branch is clean.
- ❌ Don't burn context on tool auth loops. If MCP is misbehaving, ask user to paste data directly.

---

## 7 · Final state to hand to next session

- All commits authored as `moderator29` ✅ (verify with `git log --format='%an' origin/main | sort -u` — should be only `moderator29`)
- `fix/wagmi-tempo-build-failure` PR open on GitHub, **must merge first** before any other work
- 6 chart files on v5 API ✅ verified clean tsc
- Visual ascension live in dashboard layout ✅
- 23 new brand icons ready ✅
- Memory updated for: user role, feedback rules, schema gotchas, brand/icon style, todo style, prior session handoff pointers (B/C/D/E/F)
- This handoff file at `docs/sessions/HANDOFF-session-G.md`

End of handoff. Good luck — match the bar.
