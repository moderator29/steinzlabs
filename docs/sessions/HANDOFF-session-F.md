# HANDOFF — Session F (Chosen exclusives → end of backlog)

> Read this file FIRST and in full before touching anything. Then read
> `MEMORY.md` in `~/.claude/projects/.../memory/` for the user profile
> + rules. This handoff is the source of truth for what's left.

---

## 1. Who you're working with

- **User**: Phantomfcalls (founder/CEO, sole admin of Naka Labs / Steinz Labs).
- **Email**: Phantomfcalls@gmail.com (admin). The only other elevated account is `nmcfface@gmail.com` (MAX tier, NOT admin — SQL was already run by user to grant `tier='max'`).
- **Brand**: Public-facing name is **Naka Labs**. Repo / legacy is `steinzlabs`. Don't rename the repo.
- **Tone**: Casual. No corporate filler. No "as an AI…", no apologizing for everything. Short sentences. He skims.
- **Bar**: Top-1% UX — MEVX, Nansen, Phantom grade. Picture-perfect or don't ship. WCAG AAA where possible.
- **He notices everything visually.** If something looks off, he calls it out within seconds.

## 2. THE RULES (non-negotiable — violate these and he'll catch it)

1. **NO mock data, NO placeholder values, NO TODO comments shipped.** Real APIs (DexScreener, GoPlus, Helius, Birdeye, Alchemy, CoinGecko, etc.) or skip the feature.
2. **NEVER skip git hooks** (`--no-verify`, `--no-gpg-sign`, etc.). If a hook fails, fix the underlying issue.
3. **Always work on a branch.** NEVER push to `main` directly. Branch naming: `feat/...`, `fix/...`, `chore/...`, `docs/...`. He will open the PR himself in the GitHub UI and merge it.
4. **He merges, not you.** Push branches. Do NOT run `gh pr merge`, do NOT merge locally. Output the PR URL and stop.
5. **Audit every section before saying "done".** After every meaningful chunk: re-read what you changed, grep for stragglers, run `npx tsc --noEmit`, check for empty files, verify the user-visible result. Then report what you found.
6. **Commit messages have ZERO AI attribution.** No "Generated with Claude", no Co-Authored-By Claude lines, no emoji robot. Author shows as `moderator29`. The repo history was rewritten once to scrub this — don't reintroduce it.
7. **Commits in heredoc style, plain English, "why" not "what".** See past commits on `main` for the voice.
8. **He will merge A LOT.** Expect 5-15 PRs per session merged rapid-fire. Keep branches small enough to review in <5 min each. If a change touches >200 files, split it or document the scope clearly in the commit body.
9. **Don't ask before doing mechanical work.** Just do it and report. Ask only when the path forks meaningfully.
10. **Auto mode is on.** Execute, don't deliberate.
11. **Brand naming**: `.nl-*` = platform-wide (Naka Labs); `.vault-*` = Naka Cult chamber overlay only. Don't mix.
12. **The W "REDEFINING THE WEB3 SPACE" image is a COLOR/style reference, not a logo.** The 3 glowing icons (rocket / helmet / pentagon) ARE the new platform icon style and map to the Conclave / Oracle / Sanctum chamber portals.
13. **When user says "todo list"** he means the FULL backlog in plain English. He picks. Don't pre-filter.
14. **Supabase schema gotchas** (these column names do not match the obvious naming):
    - `whales.label` (not `name`)
    - `price_alerts.price` (not `target_price` or `threshold`)
    - `user_wallets_v2` stores wallet data as JSONB
    - Profiles table: `tier` enum is `free | mini | pro | max | naka_cult` (5 tiers; `naka_cult` is above max, NFT/holding-gated)

## 3. MCP servers — VERIFY THESE ARE ON BEFORE STARTING

Before any work, confirm both Supabase MCP and Vercel MCP are surfaced in your tool inventory. Use `ToolSearch` with `"supabase"` and `"vercel"`. If either is missing, **stop and ask the user to reconnect them in Claude Code settings.**

The previous session (E) hit a wall when Supabase MCP dropped mid-task and the user had to run SQL manually. Don't repeat that — confirm up front.

- **Supabase project**: `phvewrldcdxupsnakddx` (production)
- **Production URL**: nakalabs.xyz (Vercel auto-deploys from `main`)
- **Repo**: github.com/moderator29/steinzlabs

The `.env.local` has SUPABASE_SERVICE_ROLE_KEY — **never echo it into terminal/transcript**. Always go through MCP for prod data ops.

## 4. State of the codebase as of this handoff

### Currently open PRs (user to merge these first — they unblock everything)

1. **`fix/sniper-real-functionality-and-branding`**
   - Sniper-monitor cron rewritten to read live DexScreener (was reading an empty `token_metadata` table → matcher never fired).
   - `max_age_hours` defaults to 24 when null (NewSniperModal doesn't set it → was NaN → rejecting every candidate).
   - Null-enriched fields (buy_tax, holders, security_score, is_honeypot) now treat null as "allow" instead of "reject" on first tick.
   - Sniper page wrapped in `<AuroraBackground>`, `.nl-card`, `.nl-button` swaps.
   - Fixed leftover `isMaxTier` ref → `hasSniperAccess` (Cult-tier rank-aware).

2. **`feat/expand-icons-2`** — two commits stacked:
   - **(a) feat(icons): +23 brand icons** — BookOpen, Tag, SlidersHorizontal, Zap, ArrowRight, ShieldAlert, Users, Database, Globe, Server, Briefcase, FileText, ToggleLeft, ToggleRight, Rocket, History, Power, AtSign, DollarSign, ArrowUpRight, Layers, Target, Crosshair. Same `makeIcon()` factory, same prop API. lucide drop-in.
   - **(b) feat(brand): second-wave visual ascension** — lifted `<AuroraBackground>` to `app/dashboard/layout.tsx` and sed-stripped `bg-[#07090f]`, `bg-[#0A0E1A]`, `bg-[#0B0F1A]` from 237 dashboard files so aurora actually shows through.

### Other open branches the user has NOT pushed/merged

- **`feat/ascension-phase-a-dashboard`** — phase-A dashboard work, still gated on force-push vs merge-commit decision from session D. Ask the user how they want it landed.
- **`feat/ascension-B-market`**, **`feat/ascension-C-wallet-settings`**, **`feat/ascension-D-trading`**, **`feat/ascension-E-longtail`** — first-wave icon-only swaps per cluster. May already be merged by the time you read this. Run `git log --oneline origin/main..origin/<branch>` to check.

### Branches deleted in session E

27 fully-merged-into-main branches were pruned (chore/*, docs/*, finished feat/*, hotfix/*). Don't recreate them.

### Live production schema migrations applied in session C

6 migrations: clusters, intel_scores, whale_activity, sniper_*, alerts_v2, platform_sniper_state, etc. See `supabase/migrations/` and `HANDOFF-session-C.md` §3.

## 5. THE REMAINING BACKLOG — full list, plain English, in priority order

User wants ALL of this done before considering the build "complete". He picks the next item, you execute, audit, push, he merges.

### A. Phase F — Chosen exclusives (the big one — start HERE)

Naka Cult is the 5th tier, NFT/holding-gated, sits above MAX. Three "chamber portals" map to the three glowing brand icons:
- **Conclave** → rocket icon → community/private signal room (real-time chat, alpha drops, gated)
- **Oracle** → helmet icon → AI-only deep research with extended Claude Opus context, history retained
- **Sanctum** → pentagon icon → private vault dashboard (consolidated holdings, on-chain net worth, encrypted notes)

Build approach (suggested — confirm with user before committing to it):
1. `feat/cult-conclave` — real-time chamber w/ Supabase Realtime, gated by `getCultAccess()` server-side, message reactions, pinned alpha. Schema migration for `conclave_messages`, `conclave_pins`.
2. `feat/cult-oracle` — Anthropic Opus integration, persistent research threads, citations, exportable. Schema for `oracle_threads`, `oracle_messages`. Use `claude-opus-4-7` model.
3. `feat/cult-sanctum` — consolidated vault view across all connected wallets, encrypted notes (client-side key derivation), private valuation. Already partially scaffolded in `feat/vault-foundation` — check before rebuilding.

Each chamber gets its own visual treatment: `.vault-*` overlay classes (gold accents, more cinematic), distinct iconography (rocket/helmet/pentagon prominently).

**Gate**: `profiles.tier='naka_cult' AND profiles.is_chosen=true`. There are currently 3 Chosen accounts — verify via Supabase MCP.

### B. Outstanding visual/branding polish

1. **Landing page** (`/`, components in `components/landing/`) — full Naka Labs brand pass. Currently has `LandingNav` w/ icons partially swapped. Hero, features, security, research sections need aurora/`.nl-card`/`.nl-button` treatment.
2. **`/docs`** — DocsSidebar still uses lucide BookOpen/FileText; now that those exist in brand library (session F handoff above), swap them. Docs content pages need brand card treatment.
3. **`/whitepaper`** — verify brand consistency.
4. **`/research`** — public-facing research page parity with `/dashboard/research`.
5. **`/pricing`** — already partially done; verify Cult tier card prominence (gold accent, "by invitation" badge).
6. **`/login`, `/signup`** — already partially done; verify brand button + auroral background.

### C. Build-out features still pending from prior sessions

1. **Sniper enrichment cron** — separate job that GoPlus-enriches `token_metadata` (buy_tax, sell_tax, holders, security_score, is_honeypot) for tokens detected by sniper-monitor. Without this, security_score filtering only works for criteria with `min_security_score=0`. Make this a 2-min cron.
2. **Price target trigger** for sniper — code path stub exists in `sniper-monitor`. Wire to live price feed (Birdeye/CoinGecko).
3. **Sniper execution path** — currently inserts `sniped_pending` events but the actual on-chain execution from `auto_execute=true` snipers isn't wired. Confirm scope w/ user — this is non-custodial so it's a sign-and-submit flow via PendingSignerProvider, not a server-side hot wallet.
4. **Whale tracker submission flow** — `/dashboard/whale-tracker/submit` may need review.
5. **Wallet clusters real backfill** — `scripts/backfill-clusters.ts` exists, verify it's been run for prod data.
6. **VTX AI inline card commands** — see docs section `vtx-triggers`. Implement the slash-command palette inside chat for actions like `/snipe`, `/track`, `/scan`.
7. **Telegram bot** — schema mentions bot_connect, bot_commands, bot_notifications. Verify what's actually built.

### D. Security + infra polish (per repo's 18 dependabot vulnerabilities)

- 4 high, 11 moderate, 3 low at last check. Run `gh api repos/moderator29/steinzlabs/dependabot/alerts` (or browse the security tab) and batch-merge dependabot PRs as `chore/deps-batch-N`.

### E. The merge sweep (do this LAST, only after everything above is in flight)

Once Phase F and the polish items are PR'd, run a final pass:
1. `git fetch --prune origin`
2. For every remote branch: `git rev-list --count origin/main..origin/<branch>` — anything that's 0 is fully merged; delete.
3. For everything still ahead, summarize for user: "branch X is N commits ahead — ready to PR / blocked on Y / abandoned?"

## 6. How to work (the loop)

For every task:
1. **Read this file + relevant code.** Don't guess.
2. **Make a branch.** `git checkout -b feat/<thing>` off `main` (or off a base branch if stacked — say so in the commit body).
3. **Implement.** No mocks, real APIs, real data, real UX.
4. **Audit yourself.** `npx tsc --noEmit`, grep for `TODO`/`FIXME`/`mock`/`placeholder` you just added, check empty files, spot-check the user-visible result.
5. **Commit with plain "why" message, no AI attribution.**
6. **Push the branch.** Output the PR URL.
7. **Stop.** User merges.

If a task fans out (touches >200 files, or has 3+ independent sub-parts), bundle the commit message body to explain scope — he reviews fast and needs the rationale up front.

## 7. Don't do these things

- Don't run `gh pr merge` — user merges in UI.
- Don't push to `main`.
- Don't `--amend` published commits.
- Don't add a CLAUDE.md unless explicitly asked.
- Don't write planning/decision .md files unless explicitly asked.
- Don't add emojis to commit messages, code, or UI unless explicitly asked.
- Don't add multi-line docstrings or planning comments.
- Don't echo the service-role JWT in any shell command.
- Don't ask "should I proceed?" mid-task. Just do the thing and report.
- Don't claim something is done if you haven't visually verified the result (or said you couldn't).

## 8. First message when the new session starts

Open with something like:

> Read HANDOFF-session-F.md. Supabase MCP and Vercel MCP both surfaced? Pending PRs to merge first: `fix/sniper-real-functionality-and-branding` and `feat/expand-icons-2`. After that I'd start Phase F with `feat/cult-conclave` (Conclave chamber, Supabase Realtime, Cult-gated). Sound right or different priority?

Then wait for his call.

---

*Session F handoff — written at end of session E. Brand canvas now lifted to dashboard layout, icon library at 80 brand icons, sniper bot actually fires, Cult tier (rank 4) gates work. Everything below is yours.*
