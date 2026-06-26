# Naka Labs — Handoff (2026-06-26): NakaCult revamp · cron scheduler · remaining work

**For the next session. Read top-to-bottom before touching anything.**
**Owner:** Phantomfcalls (founder/CEO · brand Naka Labs / nakalabs.xyz · GitHub `moderator29`).
**Repo:** `C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs` (Next.js 16, Supabase, Vercel auto-deploys `main`).
**Live Supabase project:** `phvewrldcdxupsnakddx` (ACTIVE_HEALTHY). Verify schema against the LIVE DB via MCP — migration files can be stale.

---

## 0 · NON-NEGOTIABLE RULES (load every commit)

### The 3 MOST IMPORTANT (the owner repeated these):
1. **BE BRUTALLY HONEST. Never claim a fix/feature you did not actually verify.** Distinguish clearly between: tsc-clean, runtime-tested-in-the-live-app, and "rendered an isolated harness." If you couldn't run the real app, SAY SO. The owner is done with "claimed fixed/done" that wasn't. **Audit your own work before every commit.**
2. **Author = `moderator29 <101205446+moderator29@users.noreply.github.com>` ONLY. ZERO AI attribution** anywhere (no `Co-Authored-By: Claude`, no "Generated with Claude Code", no "AI-assisted") — not in commits, PRs, code, comments, docs. HEREDOC commits; strip the default trailer.
3. **VERIFY UI BY ACTUALLY RUNNING THE APP** — no "claimed fixed". The real app needs the prod Supabase + WalletConnect env (gitignored, not available locally), so the truthful place to verify UI is the **Vercel preview deploy** of the branch, or a full local run with the owner's env. Isolated CSS harnesses prove a mechanism, NOT the live page.

### All other rules:
- Branch prefixes `feat/ fix/ chore/ docs/ refactor/ security/`. **Never** `claude/ ai/`. **One branch per set of work, cut from `main`.** Push and STOP at the PR — owner merges in the GitHub UI. Group related work; don't over-branch.
- Conventional Commits. **Never commit to `main`. Never `--no-verify`/`--no-gpg-sign`. Never force-push.**
- **NO mock/fake/demo/synthetic data — real APIs only** (CoinGecko, DexScreener, Alchemy, Helius, GoPlus, Jupiter, 0x, Anthropic, Supabase). Unavailable data → honest empty state, never a fabricated number.
- `lib/utils/addressNormalize.ts` for ALL address comparisons. Never `.toLowerCase()` a wallet/token address directly (Solana is case-sensitive; EVM-guarded lowercasing is tolerated but route it through the helper).
- No `any` (undocumented), no `console.log` in prod, no empty try/catch, no dead/commented-out code. WCAG AAA text contrast.
- Real-money path = non-custodial only. Never server-sign trades; signing flows through the browser.
- **Swap fee is 0.5%** (50 bps), single source `lib/trading/swapLogging.PLATFORM_FEE_BPS`. The 0x default was corrected to `0.005`; confirm `NEXT_PUBLIC_STEINZ_FEE_PERCENT` is `0.005` or unset.
- **The "Chosen" lineage is RETIRED.** Keep the `cult_member` entitlement + vault mechanics; no "Chosen" badge/weight anywhere.
- **Bootstrap:** Node 20+, npm. Windows 11, PowerShell 5.1 (prefer the Bash tool). `npm ci --legacy-peer-deps && npx tsc --noEmit` must exit 0. Local prod build needs `RESEND_API_KEY=re_dummy_build npm run build`. After switching branches `rm -rf .next` before tsc. Supabase + Vercel MCP are available; use them.

---

## 1 · 🔴 CRITICAL UNBLOCK — the cron scheduler is still dead (do FIRST)

The whole data plane (whale feeds, treasury, daily seal, membership re-verify, ape game, intelligence) depends on crons, and **they have not run since 2026-05-13** (`cron_execution_log` max `started_at` is unchanged; `cron_runs_last_30min = 0`). **Flipping `CRONS_PAUSED=false` did NOT fix it** — that env only no-ops an *invoked* cron; it does not control whether Vercel's scheduler *invokes* them.

**Root cause:** `vercel.json` had **53 cron jobs**, which exceeds Vercel's per-plan ceiling (Hobby = 2 daily-only, Pro = 40). When the count crosses the ceiling (or the plan reverts to Hobby — which would explain the hard stop on a specific date), Vercel stops scheduling all of them.

**The fix (code is ready, UNMERGED):**
- Merge **`chore/cron-dispatchers-fit-plan-limit`** — it replaces the 53 entries with **5 dispatcher crons** (`/api/cron/dispatch/{frequent,half-hourly,hourly,six-hourly,daily}`) that self-call the real handlers (all 53 still covered; verified 53/53; tsc-clean). 5 ≪ Pro's 40.
- **CONFIRM the Vercel plan is active Pro.** Sub-daily crons require Pro; Hobby only runs 2 daily. If it reverted to Hobby, upgrade — the 5 dispatchers then run.
- After deploy, verify in the Vercel dashboard → Cron Jobs that the 5 are listed/green, and check `cron_execution_log` gets fresh rows.
- The same branch also removes the `cult-verify-membership` `is_chosen` re-sync (so Chosen can't reappear when crons resume) — **must merge for the Chosen retirement to stay durable.**
- A per-cron cost table lives in `docs/sessions/AUDIT-2026-06-25-cron-cost.md`. The whale crons were demand-gated to followed whales only; everything else short-circuits when idle.

---

## 2 · WHAT SHIPPED THIS SESSION — with HONEST verification status

**Verification legend:** `tsc` = compiles clean; `live-DB` = checked against the live Supabase DB; `harness` = rendered an isolated CSS/HTML repro in real Edge (NOT the live app); `NOT-RUN` = not runtime-tested in the real app (no local prod env).

### Merged to main (16 branches):
- `fix/swap-slippage-threading-and-dead-router` — thread user slippage to 0x; delete dead `lib/services/swap.ts`. `tsc`. NOT-RUN.
- `fix/p1-correctness-batch` — notification-settings extended-schema probe hardening. `tsc`. NOT-RUN.
- `docs/audit-2026-06-25-nakacult-15agent` — the 15-agent NakaCult audit report (the rebuild bible).
- `fix/nakacult-nav-and-data-honesty` — un-break the 3 flagship chamber tiles (were dead `comingSoon`); `cult_stats` view recompute (`active_members` from `cult_member`, drop retired `chosen_count`); Daily Seal freshness guard + valid Anthropic model id + 529 retry. `tsc` + `live-DB` (active_members=3). Vault is gated → nav clickability verified by reading `ChamberPortal`, NOT-RUN.
- `feat/wallet-entitlements-welcome-and-badge` — Enter NakaCult wallet-connect CTA; Founder-Pass→Max grant bug fix (no longer clobbers legacy/admin max); auto gold badge; 3-step first-time Max welcome (DB flag `max_welcomed_at`, backfilled); multi-wallet entitlement resolution; removed legacy `tiers.ts` FREE/PRO/PREMIUM. `tsc` + `live-DB`. NOT-RUN.
- `fix/nakacult-scroll-and-landing-polish` — **scroll bug ROOT fix** (animated bg → `position:fixed` composited layer outside scroll flow; removed the `overflow-anchor` band-aid) + WCAG AAA landing text. `harness` (Edge: monotonic scroll + no self-scroll over 2.5s + bg computes `fixed`). NOT-RUN on the live page.
- `fix/turnstile-widget-robust-load` — robust reusable Turnstile widget (loads api.js, waits for ready, explicit render) + **theme switched to `light`** on login/signup/widget for visibility. `tsc`. NOT-RUN. NOTE: login/signup already used correct sitekey/render-mode; the persistent "stuck Verifying/invisible" is most likely a **Cloudflare sitekey↔domain config** issue (human-gated).
- `feat/nakacult-2030-vault-redesign` — 3D pedestal sigils + brand frame on `.vault-portal`. `harness` only. NOT-RUN.
- `feat/nakacult-2030-chamber-panels` — brand frames + depth on `.oracle-subchamber`/`.sanctum-subchamber` + premium `.vault-stats` cards. `harness` only. NOT-RUN.
- `feat/alert-and-notification-channel-tables` — created `composite_alerts`, `alert_templates` (3 price-starter seeds), `user_notification_channels` (were wired-but-missing). `live-DB` (applied + mirrored).
- `fix/docs-accuracy-and-tier-fee-bugs` — VTX `isPro` now includes `max` (Max was capped at 25/day in the UI); 0x fee default 0.4%→0.5%; doc fixes (Next 14/15→16, Wagmi v5→v2, fee 0.4→0.5). `tsc`. NOT-RUN. Full findings: `docs/sessions/AUDIT-2026-06-25-docs-accuracy.md`.
- `security/admin-analytics-auth` — closed an **unauthenticated revenue-data hole** at `/api/analytics/admin` (auth was skipped when no header present). `tsc`. NOT-RUN.
- `fix/cult-rls-member-gate-and-realtime` — RLS read policies on cult tables now gate on `cult_member` (were the retired `tier='naka_cult'` → silently zeroed reads); added cult tables to the realtime publication. `live-DB`.
- `feat/cult-holdings-weighted-voting` — Conclave vote weight = `max(1, floor(sqrt(nakaBalance/threshold)))` from real on-chain $NAKA (was fabricated `isChosen?2:1`). `tsc`. **NOT-RUN** (can't cast a real vote without prod env; $NAKA confirmed 18-decimals on-chain).
- `refactor/retire-chosen-lineage` + `refactor/retire-chosen-ui-cleanup` — removed `isChosen` from `access.ts` + 12 cult API routes + vote weight; opened the 6 Chosen-only write-gates to all cult members; removed UI badges; deleted `useChosenStatus` + `ChosenSealDraftPanel` + `ChosenLibraryCurator`; de-Chosen'd dashboard. `tsc`. NOT-RUN. **Plus a live `UPDATE profiles SET is_chosen=false` (verified 0 remain).**

### Pushed, UNMERGED (2 branches — owner must merge):
- **`chore/cron-dispatchers-fit-plan-limit`** — the cron fix above (see §1). MERGE THIS FIRST.
- `feat/nakacult-landing-2030-redesign` — landing pillars: 3D pedestal sigils + brand frames. `harness` only. NOT-RUN.

### Brutally honest caveat on the "frontend revamp":
What was delivered is **broad shared-CSS polish** (3D icon pedestals, brand-gradient frames, depth, premium stat cards) applied to existing components across the vault + landing — a genuine visual lift, **verified only in isolated Edge harnesses, never on the live running pages**. It is **NOT** a from-scratch redesign: component structure, page layouts, the typography system, bespoke per-chamber interiors, in-vault menus/profiles, and copy are **unchanged**. Do not represent it as a complete frontend rebuild.

---

## 3 · REMAINING WORK — the full NakaCult rebuild + platform backlog

### 3a. NakaCult frontend (the real, deep redesign the owner wants)
- **Bespoke per-chamber interiors** (not just shared-card polish): the Conclave governance layout (proposal cards, the vote-power panel, quorum meter, conviction bar, countdown), the Oracle hub layout, the Sanctum layout, and each Commons panel (Hall/Conviction/Offering/Pulse/Ape) redesigned to the 2030 spec.
- **3D icons throughout in the Nakalabs brand style** — beyond the CSS pedestals, the actual sigil/icon artwork (`components/vault/sigils/*`, `components/icons/brand`) upgraded to true 3D/branded assets; icon containers/stat cards/menus consistent.
- **In-vault menus, identity strip, profiles** redesigned cohesively.
- **The Ddergo Library player** — BLOCKED on the owner: it must replace the Spotify iframe + 8 fabricated `cult_ambient_tracks` rows with a first-party Web Audio player over **real audio files the owner provides** (Supabase Storage/CDN). Do NOT fabricate tracks. Once assets exist: build the transport (play/pause/seek/queue/keyboard), audio-reactive orb, persistent cross-chamber playback; delete the fabricated rows.
- **VERIFY every UI change on the Vercel preview deploy** (the only place with real env), not isolated harnesses.

### 3b. NakaCult backend / data honesty (mostly unblocks once crons run)
- After crons run: confirm the Daily Seal regenerates, treasury snapshot fills (needs `NAKA_TOKEN_CONTRACT` + `NAKA_TREASURY_WALLET` env), membership re-verifies, the Ape game opens a round, signals/offerings populate. Many cult tables are empty only because the crons were dead.
- **`naka_trust_scores`** still has 4 symbol-keyed fabricated rows (`score*constant`); delete them + reject non-address inputs in the route (from the 15-agent audit).
- **Echo Chamber "E2E encrypted DMs"** is a false security label over plaintext — rename to "Anonymous Signal Board" or build real X25519 sealed-box crypto. (Write-gate already opened to all members.)
- **Sage** is sold as streaming but is a blocking single-shot call — convert to true token streaming (SSE/ReadableStream).
- **Achievements** have no earning pipeline; **loadouts** are write-only; **cosmetics** are CSS dots with `asset_url=NULL` — build the grant hooks + real assets (see audit §"Sanctum").

### 3c. The `profiles.is_chosen` COLUMN drop (deliberately NOT done)
`is_chosen` is still **read by ~25 social files** (`app/api/social/*`, leaderboards, profiles, search, recommendations, `components/social/*`, `app/u/*`, `app/leaderboard/*`, `app/discover`). They all return `false` now (data is zeroed) so nothing renders, but **dropping the column would 500 all of them.** Sequence: purge those reads first, THEN drop `profiles.is_chosen` + `cult_proposal_votes.is_chosen`, then rename the `gold_ring` cosmetic + `chosen_seal_written` achievement.

### 3d. Admin panel (from `AUDIT-2026-06-25` admin agent — VERIFY each, some are stale)
- **VERIFIED STALE — do NOT "fix":** broadcast/newsletter/stats already source email from `auth.users` (the `profiles.email` 500 was fixed by a prior branch). The `/api/analytics/admin` auth hole IS fixed (merged this session).
- **announcements** — REAL but deeper than the audit said: a 3-way `type` mismatch (DB CHECK `banner|modal|sticky` vs API zod `info|warning|success|critical` vs UI `info|warning|maintenance|feature`); the API even defaults `type:'info'` which the DB rejects → creation likely 500s. Needs a data-model decision (is `type` presentation or severity? add a `severity` column?).
- **treasury** — `/api/admin/treasury` queries non-existent `platform_settings.key/value`; USD hardcoded 0.
- **search-logs** page fetches `/api/admin/search-logs` which does not exist.
- **security-analytics** hits `/api/admin/flagged-tokens` → `flagged_tokens` table missing.
- **support reply** wired to missing `ticket_replies` / mismatched `support_conversations`.
- **sniper-oversight** per-job pause/resume is a dead button (local state only).
- **audit-tracker** is a static hardcoded array; **dashboard charts/revenue** hardcoded zeros.
- **feature flags** drive almost nothing (only `passkey_unlock` is read); **admin_roles** is empty → RBAC falls back to static bearer.
- **Missing admin tools:** cult membership/tier override, real cron-health view, on-chain entitlement viewer, admin-role-grant UI.

### 3e. Docs accuracy (product decisions needed)
From `AUDIT-2026-06-25-docs-accuracy.md`: VTX per-tier limits are fabricated (real = free/mini 25/day, pro/max unlimited — Mini has no VTX benefit; product decision: give Mini a real quota or state 25); sniper is Max-gated (docs say Pro) on chains ETH/SOL/BSC/TON/AVAX (docs list Base/Polygon); chain-count chaos (landing "12+" vs DB "9"); whale "1,000+/10 chains" → real 449/9.

### 3f. §4 platform backlog (from the prior handoff, not done)
- Notification delivery: no whale-follow alert evaluator; `fanOutNotification` has no Telegram branch; alert crons ignore per-event toggles + quiet hours.
- `proof_votes` table + proof-vote persistence; proof-page `'TOKEN'` placeholder guard.
- Slippage on the multi-aggregator providers (1inch/Kyber/OpenOcean) — they still use provider defaults.
- Cron observability sweep — ~17 crons still don't write `cron_execution_log`.
- Various P1 dead-filter cleanups (wallet sorts/pills, market sortable headers, context-feed map, clusters sort, social recommendations limit, DM cursor) — VERIFY each (the audits had several stale claims).

---

## 4 · 🚩 HUMAN-GATED (owner action — flag, don't attempt)
1. **Merge `chore/cron-dispatchers-fit-plan-limit` + confirm Vercel plan is Pro** → the single biggest unblock (§1).
2. **Cloudflare Turnstile**: verify the sitekey's domain allowlist includes the live host + it's a prod (not test) sitekey; confirm `TURNSTILE_SECRET_KEY` matches. The widget code is correct; the residual issue is dashboard config.
3. **Ddergo player**: provide real audio files (Supabase Storage) before the first-party player can be built.
4. **Treasury**: set `NAKA_TOKEN_CONTRACT` + `NAKA_TREASURY_WALLET` so the treasury cron fills (or hide the panel until $NAKA mints).
5. **Env name coordination** (see the env inventory the session produced): `$NAKA` contract uses `NEXT_PUBLIC_NAKA_TOKEN_ADDRESS` (client) AND `NAKA_TOKEN_CONTRACT` (server) — set both equal; Supabase service key → set `SUPABASE_SERVICE_ROLE_KEY`.
6. Real-money swap signing/execute + gasless — needs the owner's wallet to test before merge.

---

## 5 · OPENING SEQUENCE FOR NEXT SESSION
```bash
cd "C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs"
git fetch --prune origin && git checkout main && git pull --ff-only
npm ci --legacy-peer-deps && npx tsc --noEmit          # baseline must exit 0
# 1) Confirm the owner merged chore/cron-dispatchers-fit-plan-limit + is on Pro; verify crons fire (cron_execution_log fresh rows).
# 2) NakaCult: bespoke chamber-interior redesign + true 3D icon artwork. VERIFY on the Vercel PREVIEW deploy, not isolated harnesses.
# 3) Backend honesty: naka_trust_scores cleanup, Echo "E2E" relabel, Sage streaming, achievement/loadout/cosmetic pipelines.
# 4) Admin: announcements type model, treasury schema, search-logs route, flagged_tokens/ticket_replies tables.
# 5) is_chosen column drop ONLY after purging the ~25 social reads.
# Be brutally honest: tsc-clean != runtime-verified. Audit your own work before every commit. moderator29 author, zero AI attribution.
```
