# Session G handoff — Phase F (Chosen exclusives) + cleanup sweep

**For**: the next session (fresh context). Read this top-to-bottom before touching anything.
**From**: session F continuation, 2026‑05‑12.
**User**: Phantomfcalls (founder/CEO Naka Labs, brand: Naka Labs / nakalabs.xyz, GitHub: moderator29).

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

- `docs/slash-commands-pricing` — user said "expect command pricing" during conflict resolution
- Direct merges to `main` (always via PR)
- `git config` changes
- Force-push to any branch (sandbox blocks anyway)
- Skipping CI hooks (`--no-verify`)

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
