# Session H handoff — Phase F partial ship + sniper hardening + cron cleanup

**For**: the next session (fresh context). Read this top-to-bottom before touching anything.
**From**: session H, 2026-05-12. **Revision 1**.
**User**: Phantomfcalls (founder/CEO Naka Labs, GitHub: moderator29).

This continues from `docs/sessions/HANDOFF-session-G.md`. Most of session G's "merge sweep" already shipped before H started — `origin/main` is at PR #181 (handoff-G merged), wagmi pin + Oracle/Sanctum/Conclave foundation are all in main.

---

## ★ Top-of-mind callouts

1. **5 PRs are open on GitHub right now waiting for your merge click.** None can be merged by an agent — CLAUDE.md is explicit that you merge in the GitHub UI. Order them in the sequence below to avoid rebase pain.
2. **Two new Supabase migrations were applied in this session.** `cult_daily_seal_drafts` and `cult_sanctum_curation` are LIVE on production Supabase (project `phvewrldcdxupsnakddx`). The PRs that reference them must merge or the code paths break at runtime when env reaches production. Migration files are also committed to the repo for parity.
3. **alert-monitor cron was unscheduled.** AlertMonitorProvider + `/dashboard/alerts` are now silently inert. Either implement the evaluator or ship an "alerts in beta" disclaimer — the UI still implies it works.
4. **8 stub route files remain on disk** (`app/api/cron/{context-feed-poll,smart-money-ranking,network-metrics,trends-aggregator,narrative-detection,fear-greed-index,alert-monitor,whale-ranking-refresh}/route.ts`). Unscheduled, not deleted — file deletion was blocked by sandbox classifier because the handoff itself flags "stub crons fate" as an ask-first item. Decide: delete the directories or implement.
5. **One handoff factual error**: §4m listed `cluster-analysis` as a stub. It isn't — it runs real edge detection via `lib/clusters/detection.ts`. It stays scheduled.
6. **§5.13 questions handled as defaults** (override if needed): Stripe deferred (manual SQL), light theme not started, no test suite, stub crons unscheduled-not-deleted, WGM Runner untouched, `/api/trades/confirm` not verified (open), Sentry slugs left as placeholders.

---

## 0 · Working rules (unchanged from session G — re-read §0.1–0.7 in HANDOFF-session-G.md)

All session G rules apply verbatim. The most important ones for the next agent:
- **Zero AI attribution in commits / PRs / code / branches** (HEREDOC commits, strip the default `Co-Authored-By` and 🤖 footer)
- **Owner merges every PR in the GitHub UI.** Push the branch and stop. Do not open PRs via `gh`.
- **No mock data, real APIs only. WCAG AAA. Top-1% Nansen-grade.**
- **One branch per task. Never push to main.**
- **Non-custodial only.** All signing flows through `pending_trades`.

PowerShell 5.1 quirks (§0.7 in session G) still apply on Windows. Prefer Bash for code-editing sweeps.

---

## 0.5 · Bootstrap on a fresh session (works as-is)

```bash
# Repo lives at C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs
cd "C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs"
git fetch --prune origin
git checkout main && git pull --ff-only
npm ci --legacy-peer-deps   # already done; redo only on dep change
npx tsc --noEmit            # must exit 0
git config user.name "moderator29"
git config user.email "101205446+moderator29@users.noreply.github.com"
```

GitHub Desktop credentials carry through. `gh` CLI not installed, not needed.

---

## 1 · What shipped this session (5 PRs)

All branches pushed to `origin`. Merge in this order to minimize rebase risk.

### 1.1 — `feat/chosen-badge-dashboard`
**5 files / +104 / -9.** Surfaces the Chosen marker (gold trim on the crimson cult sigil) anywhere `TierBadge` renders for a `naka_cult` user.

- New `GET /api/cult/me` returns `{ tier, isChosen }` from `getCultAccess()`.
- New `useChosenStatus()` hook in `lib/hooks/useChosenStatus.ts` round-trips once on mount, defaults safe on error.
- `components/ui/TierBadge.tsx` gains an `isChosen?: boolean` prop and a `chosen` variant (gold outline + crimson glow).
- `PersonalizedHome.tsx` greeting and `ProfileTab.tsx` header pass `isChosen` through.

Foundation for the other two Chosen PRs — merge first.

### 1.2 — `feat/chosen-oracle-write`  *(based on chosen-badge-dashboard)*
**5 files / +414 / -0.** Chosen members can author tomorrow's Daily Seal.

- **Migration `2026_05_12_cult_daily_seal_drafts.sql` — applied live.** Table `cult_daily_seal_drafts(id, seal_date, author_id, title 6..140, body 60..4000, status IN ('pending','accepted','rejected','superseded'), created_at, reviewed_at, reviewed_by)`. RLS: every cult member reads, only Chosen inserts, author updates while pending.
- `POST /api/cult/oracle/daily-seal/draft` — Chosen-only, validates length, refuses past dates.
- `GET` of the same route returns `{ targetDate, isChosen, next, mine }`.
- `components/vault/oracle/ChosenSealDraftPanel.tsx` — mounts inside `OracleHubClient` only when `/api/cult/me` confirms `isChosen`.
- **Cron change**: `cult-generate-daily-seal/route.ts` now checks for a pending draft for today's `seal_date` before calling Anthropic. If found, the draft becomes the seal (`model='chosen'`, `context_json.source='chosen_draft'`, `author_id` recorded), and the cron marks the chosen draft `accepted` while superseding any siblings.

Merge after #1.1.

### 1.3 — `feat/chosen-sanctum-curation`  *(based on chosen-badge-dashboard)*
**5 files / +320 / -0.** Chosen members can reorder and soft-delete tracks in the Sanctum Library.

- **Migration `2026_05_12_cult_sanctum_curation.sql` — applied live.** Adds RLS policy `cult_ambient_chosen_update` (Chosen-only UPDATE on `cult_ambient_tracks`) and audit columns `curated_by uuid, curated_at timestamptz`.
- `PATCH /api/cult/sanctum/library/reorder` — body `{ order: [trackId, ...] }`, assigns `display_order = index` per row, ignores unknown ids.
- `DELETE /api/cult/sanctum/library/[id]` — soft-delete (`is_active = false`); hard-delete remains admin-only.
- `components/vault/sanctum/ChosenLibraryCurator.tsx` — up/down arrows + remove button (keyboard + screen-reader navigable). API contract supports any order so a future drag-drop swap is pure UI.

Merge after #1.1.

### 1.4 — `chore/remove-stub-crons`
**1 file / -8 lines.** Unschedules 8 no-op cron routes from `vercel.json` to stop Vercel cron-invocation credit drain.

Unscheduled: `context-feed-poll, smart-money-ranking, network-metrics, trends-aggregator, narrative-detection, fear-greed-index, alert-monitor, whale-ranking-refresh`.

**Route files NOT deleted** — they remain on disk. Next session can decide implement-or-delete per route. `cluster-analysis` was flagged in session G's audit as a stub but it isn't (real edge detection); kept on schedule.

Merge any time. Independent of all other PRs.

### 1.5 — `fix/sniper-hardening`
**3 files / +52 / -4.** Four of the five §4n production risks resolved.

- **Risk #2 (daily-spend race)**: `sniper-monitor` tracks running spend per criteria during the tick and re-checks the cap before each event push. Prevents the $450/$500 → +5×$100 overshoot.
- **Risk #3 (CRON_SECRET dev bypass)**: `_shared.ts` now only allows the missing-secret path when `NODE_ENV === 'development'`. Preview/staging deploys returning 500 instead of silently accepting unauthenticated cron calls.
- **Risk #4 (TON guard)**: `sniper-autosell` short-circuits TON positions with `reason: "ton price feed unsupported"` before calling the price feed. Operators see the unsupported-chain reason in logs immediately.
- **Risk #5 (per-user concurrency cap)**: `sniper-monitor` caps each user to 10 criteria per tick. Remaining criteria run next tick — stable id ordering means no starvation.

Risk #1 (`security_score: null` GoPlus enrichment) is **not in this PR**. It needs a new `sniper-enrich-security` cron + GoPlus integration; sized for its own session.

Merge any time, independent of Phase F.

---

## 2 · Suggested merge order

```
1. fix/sniper-hardening              (no deps, safety critical)
2. chore/remove-stub-crons           (no deps, saves credits immediately)
3. feat/chosen-badge-dashboard       (foundation for chosen UX)
4. feat/chosen-oracle-write          (depends on #3 for hook + /api/cult/me)
5. feat/chosen-sanctum-curation      (depends on #3 for hook + /api/cult/me)
```

After merging, delete the merged branches with `git push origin --delete <branch>` or via GitHub UI. The 16 stale branches from session G §4o are still on remote — clean them too.

---

## 3 · Remaining backlog — every single thing left

Plain English, prioritized. User picks the order; this is the universe.

### 3.1 — Phase F (cult-exclusive) still to do

| Feature | State | Where | Open work |
|---|---|---|---|
| Oracle: VTX Sage sub-chamber | ⛔ STUB placeholder | `OracleHubClient.tsx` → `SubChamberPlaceholder` | Build the chamber: a Sonnet-powered context-aware chat with the cult sigil avatar + ink-writing voice. Probably wants a `cult_vtx_sessions` table separate from regular VTX history because the persona differs. |
| Oracle: Whisper Network | ⛔ STUB placeholder | same | Anonymous intel submission + voting. Needs: `cult_whispers` table (id, author_id NOT exposed, body, created_at, echo_count, status), POST/vote routes, RLS. |
| Oracle: Echo Chamber | ⛔ STUB placeholder | same | 25-slot stealth wallet tracking visible only to cult. Reuses existing whale tracker plumbing but with a private `cult_echo_wallets` table. |
| Sanctum: The Mantle | ⛔ STUB placeholder | `SanctumHubClient.tsx` | Avatar / frame / glow / banner / title / sigil dressing room. Schema work: `cult_member_loadouts(user_id, slot, asset_id)`. UI: a layered cinematic preview. |
| Sanctum: The Annals | ⛔ STUB placeholder | same | Achievement record (bronze/silver/gold/mythic). Schema: `cult_achievements(id, code, tier, criteria_json)` + `cult_member_achievements(user_id, achievement_id, earned_at)`. Trigger evaluation lives in `cult-resolve-proposals`-style cron. |
| Sanctum: The Forge | ⛔ STUB placeholder | same | Auto-detected NFT display with 3D rotation. Needs Alchemy NFT API integration + a 3D viewer component (react-three-fiber or pure CSS transform). |
| Sanctum: replace arrow reorder with drag-drop | 🟡 PARTIAL | `ChosenLibraryCurator.tsx` (shipped in #1.3) | Pure UI swap — API contract already accepts any order. Pick `@dnd-kit/sortable` (lighter than react-beautiful-dnd). |
| Chosen Oracle draft review UI | 🟡 partial | `ChosenSealDraftPanel.tsx` shows pending draft; no review/edit | Add edit-while-pending + reject button for the author. Cron already supersedes siblings, but a non-Chosen cult member can't override a draft they disagree with — out of scope until governance is defined. |
| Conclave Treasury USD enrichment | ⛔ STUBBED null | `cult-refresh-treasury` cron writes `balance_usd: null` | Wire CoinGecko or 0x quote per token, write USD into `cult_treasury_snapshots`. |
| Conclave Treasury motion execution | ⛔ MANUAL | Motions resolve in DB only | Future: signer integration via existing `pending_trades` queue. |
| On-chain holdings resolver | ⚙ WIRED but DISABLED | `lib/cult/holdings.ts`, `cult-verify-membership` cron | Awaits `NAKA_TOKEN_CONTRACT` / `NAKA_LOYALTY_GEM_CONTRACT` / `NAKA_DEV_NFT_CONTRACT` env vars from user. Until then, tier is set manually via SQL. |

### 3.2 — Sniper still to do (after #1.5)

- **Risk #1 — `security_score: null` enrichment cron.** New `/api/cron/sniper-enrich-security` that walks recent `sniper_match_events` with `details.security_score IS NULL`, calls GoPlus per chain, updates the row. Schedule every 2-5 minutes. Until this lands, any criteria with `min_security_score > 0` (the default modal value is 60!) rejects all candidates indefinitely.
- **Risk #6 — slippage re-validation at confirm time.** Today: slippage from criteria gets baked into `pending_trades`. User signs assuming 1% slippage; market may have moved 5%. Fix: re-quote on confirm, reject if slippage exceeds tolerance. Lives in `/api/trades/confirm` (which itself may not exist — see §3.3).
- **Risk #7 — `wallet_addresses[]` ownership check.** `POST /api/sniper/criteria` doesn't verify supplied wallets belong to the user. Validate against `user_wallets_v2` for the caller before insert.
- **Price-target trigger**: schema supports it but the cron only emits empty events for `trigger_type = 'price_target'`. Needs price-feed integration in `sniper-monitor`.
- **Auto-execute path verification**: confirm `/api/cron/sniper-auto-execute` actually consumes `decision = 'sniped_pending'` events and inserts `pending_trades`. The route file exists (still on schedule); needs smoke test.

### 3.3 — Production gaps the audit found but didn't fix

- **`app/api/trades/confirm` route** — handoff §4s flags it as "not traced during sniper audit." If it doesn't exist, sniper auto-execute writes `pending_trades` nobody can finalize. Grep first; build if missing.
- **alert-monitor consequence** — `AlertMonitorProvider` + `/dashboard/alerts` exist and look wired; cron is now unscheduled, so no alerts ever fire. Either implement the evaluator (read `price_alerts.price`, evaluate against latest `price_cache`, emit notification) or ship a UI disclaimer.
- **Telegram bot token + Anthropic key**: no rotation policy, no secret-manager integration. Sentry's `beforeSend` scrubs cookies but doesn't scrub these keys if they ever leak into a log line.
- **Sentry org/project slugs**: CI builds upload source maps using placeholder values. Ask user, set them, then verify next prod build has stack-mapped traces in Sentry.

### 3.4 — Public-facing branding sweep (untouched, still §4b state)

30+ pages outside `/dashboard/*` and `/vault/*` still have no W aurora, no crimson accents. Pattern is mechanical (recipe in session G §4b):

1. Wrap outer return in `<AuroraBackground fullHeight>`
2. Strip `bg-[#07090f]` / `bg-[#080C18]` / inline `style={{ background }}`
3. Replace `bg-gradient-to-r from-blue-XXX...` with `nl-button`
4. Replace `rounded-xl border border-white/10 bg-white/[0.03]` with `nl-card`

Worst-offender pages still un-branded: `app/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/research/page.tsx`, `app/market/*`, `app/portfolio/page.tsx`, `app/security-center/page.tsx`, `app/dna-analyzer/page.tsx`, `app/docs/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/alerts/page.tsx`, `app/intelligence/[token]/page.tsx`, `app/error.tsx`, and `components/landing/*` (17 files, biggest inline-gradient offender).

Quantitative pulse — refresh with the greps in session G §4r:
```bash
grep -rln "bg-white/\[0.03\] border" app components 2>/dev/null | wc -l
grep -rln "DC143C\|FF1744\|#FF3DCB" app components 2>/dev/null | wc -l
```

### 3.5 — Branch / repo hygiene

- **16 stale branches** from session G §4o still on remote (`feat/ascension-B-market`, `feat/conclave-hardening`, `feat/oracle-foundation`, etc — all merged via PRs #160-#172). Delete via GitHub UI or `git push origin --delete <branch>`.
- **`docs/handoff-session-f`** still on remote, can be deleted (it's superseded by g + h).
- **`docs/slash-commands-pricing`** — user explicitly off-limits, leave it.
- 36 GitHub Dependabot vulnerabilities still on default branch. The push response logs "24 vulnerabilities on moderator29/steinzlabs's default branch (6 high, 15 moderate, 3 low)" today (down from 36 — wagmi/lightweight-charts fix knocked some out). Triage when not in active feature work.

### 3.6 — Stub crons — decide implement-or-delete

Route files remaining on disk (unscheduled but `cronResponse(...)` no-op):
- `app/api/cron/context-feed-poll/route.ts`
- `app/api/cron/smart-money-ranking/route.ts`
- `app/api/cron/network-metrics/route.ts`
- `app/api/cron/trends-aggregator/route.ts`
- `app/api/cron/narrative-detection/route.ts`
- `app/api/cron/fear-greed-index/route.ts`
- `app/api/cron/alert-monitor/route.ts`  *(see §3.3 caveat)*
- `app/api/cron/whale-ranking-refresh/route.ts`

Per-route: implement (real work) or `rm -rf` the directory. Bare deletion needs user OK because session G's §5.13 listed this as ask-first.

---

## 4 · Schema state (after this session's two migrations)

New tables in `public`:
- `cult_daily_seal_drafts(id, seal_date, author_id, title, body, status, created_at, reviewed_at, reviewed_by)` — RLS: all cult read, Chosen insert, author update-while-pending
- `cult_ambient_tracks` gained `curated_by uuid REFERENCES profiles(id), curated_at timestamptz` — audit trail when a Chosen reorders or removes a track
- `cult_ambient_tracks` gained policy `cult_ambient_chosen_update` — Chosen-only UPDATE

Schema gotchas from session G memory still apply verbatim:
- `whales.label`, `price_alerts.price`, `user_wallets_v2.wallets` JSONB
- `profiles.is_chosen` server-only — fetch via `/api/cult/me` round-trip, never expose on client `UserProfile`
- `profiles.tier` lowercase only (`free|mini|pro|max|naka_cult`)
- `sniper_match_events.decision` values, `pending_trades.status` values per session G §5.11

Verify with `mcp__claude_ai_Supabase__list_tables` (project `phvewrldcdxupsnakddx`) before any new migration.

---

## 5 · MCP cheatsheet (unchanged from session G)

- **Supabase**: project `phvewrldcdxupsnakddx`. `apply_migration` / `execute_sql` / `list_tables` / `get_advisors` are the main tools. Both migrations in this session shipped via `apply_migration` — files mirrored to `supabase/migrations/` for repo parity.
- **Vercel**: team `team_YiyNREYxlCCmV9Zx9JQmFbCU`. OAuth scope gotcha noted in session G §5.1 — if `list_projects` 403s, reconnect via `/mcp` with personal scope.
- **GitHub**: no MCP. Use git over HTTPS (GitHub Desktop creds carry through). `gh` not installed.

---

## 6 · The §5.13 questions — what I defaulted, what's still open

Session G said "ask before doing" on 7 items. User said "no clarifying questions — make the call" in session H. Calls I made:

| Question | This session's call | If wrong, redirect with… |
|---|---|---|
| Stripe checkout | Deferred (manual SQL only) | "Start Stripe checkout integration as Phase G." |
| Light theme platform-wide | Not started | "Begin light-theme migration after public-page branding." |
| Test suite (Vitest) | Not started | "Set up Vitest + Playwright; tests required going forward." |
| 9 stub crons fate | 8 unscheduled in `vercel.json`; route files on disk pending owner decision | "Delete all 8 stub route directories" or "Implement {x,y}." |
| `/dashboard/wgm-runner` | Untouched | "Either delete WGM Runner or finish it." |
| `/api/trades/confirm` route exists? | Not verified | "Grep the route; if missing, build it before any more sniper work." |
| Sentry org/project slugs for CI | Left as placeholders | "Set SENTRY_ORG=… SENTRY_PROJECT=… in CI env." |

---

## 7 · Quick-start commands for the next session

```bash
cd "C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs"
git fetch --prune origin
git checkout main && git pull --ff-only
npx tsc --noEmit            # baseline

# See what's open
git for-each-ref --format='%(refname:short)' refs/remotes/origin/ \
  | grep -v 'origin/main$\|origin/HEAD'

# Verify the two migrations from session H landed
# (via Supabase MCP)
#   list_tables → cult_daily_seal_drafts must be present
#   list cult_ambient_tracks columns → curated_by + curated_at present

# Brand-adoption pulse (still ≈ session G numbers — no branding work this session)
grep -rln "bg-white/\[0.03\] border" app components 2>/dev/null | wc -l
grep -rln "DC143C\|FF1744\|#FF3DCB" app components 2>/dev/null | wc -l
grep -rln "AuroraBackground\|nl-aurora-bg" app components 2>/dev/null | wc -l
```

End of handoff. Match the bar.
