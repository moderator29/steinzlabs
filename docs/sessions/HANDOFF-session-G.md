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

### 4b · Pending UX / branding work not yet done

- **Sub-component icon swaps (Step 2 from session F)**: deferred. Lucide imports remain in many sub-components across market/, smart-money/, whales/, intelligence/, security/, trading/, settings/. A sed sweep can't safely do this — needs per-file judgment because specialty names collide. Pick a cluster, swap mechanically, ship. Pattern in `app/dashboard/sniper/page.tsx` is the canonical template (hybrid lucide+brand import).
- **`nl-card` adoption beyond AuroraBackground lift**: most dashboard pages still hand-roll `rounded-xl border border-white/10 bg-white/[0.03] p-4` cards. Replace with `nl-card` per page when touched.
- **`nl-button` adoption**: same — most CTA buttons still use `bg-gradient-to-r from-blue-600 to-blue-800` hand-rolled. Swap to `nl-button` per page when touched.
- **Mobile sidebar visual pass**: SidebarMenu hasn't had brand pass.

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
