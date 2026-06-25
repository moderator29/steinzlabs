# Naka Labs — Handoff (2026-06-25): NakaCult rebuild · Turnstile · remaining backlog

**For the next session. Read top-to-bottom before touching anything.**
**Owner:** Phantomfcalls (founder/CEO · brand Naka Labs / nakalabs.xyz · GitHub `moderator29`).
**Repo:** `C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs` (Next.js 16, Supabase, Vercel auto-deploys `main`).
**Live Supabase project:** `phvewrldcdxupsnakddx` (ACTIVE_HEALTHY). Verify schema against the LIVE DB via MCP — migration files are stale.

---

## 0 · MANDATE + NON-NEGOTIABLE RULES (load every commit)

Work **fully autonomously** — pick item → do it → **self-audit (re-grep, re-tsc, run/verify)** → commit cleanly → push → next. Do NOT stop to ask "what next". **Be brutally honest** — never claim a fix you didn't verify (the owner is tired of sessions that "claimed fixed" and weren't; the NakaCult scroll bug is the prime example). **Audit your own work before committing.**

- **Author = `moderator29 <101205446+moderator29@users.noreply.github.com>` ONLY.** Git is configured.
- **ZERO AI attribution** anywhere (no `Co-Authored-By: Claude`, no `Generated with Claude Code`, no "AI-assisted") — not in commits, PRs, code, comments, docs. Use HEREDOC commits; strip the default trailer.
- Branch prefixes: `feat/ `fix/ `chore/ `docs/ `refactor/ `security/`. **Never** `claude/ `ai/ `claude-code/`. **One branch per set of work, cut from `main`.** Push and STOP at the PR — owner merges in the GitHub UI. Don't make too many branches — group related work.
- Conventional Commits. **Never commit to `main`. Never `--no-verify`/`--no-gpg-sign`. Never force-push.**
- **NO mock/fake/demo/synthetic data — real APIs only** (CoinGecko, DexScreener, Alchemy, Helius, GoPlus, Jupiter, 0x, Anthropic, Supabase). Unavailable data → honest empty state, never a fabricated number.
- `lib/utils/addressNormalize.ts` for ALL address comparisons. Never `.toLowerCase()` a wallet/token address (Solana is case-sensitive).
- No `any` (unless documented), no `console.log` in prod, no empty try/catch, no commented-out/dead code. WCAG AAA text contrast.
- Real-money path = non-custodial only. Never server-sign trades; signing flows through the browser.
- **Swap fee is 0.5%** (50 bps) to the treasury wallet on every buy and sell (single source = `lib/trading/swapLogging.PLATFORM_FEE_BPS`). Treasury wallet env unchanged. NOTE: `NEXT_PUBLIC_STEINZ_FEE_PERCENT` env, if set, overrides 0x's fee — must be `0.005` or unset.
- **The Chosen badge/lineage is retired** — keep the `naka_cult` tier badge + vault mechanics, but no "Chosen" badge anywhere.

**Bootstrap:** Node 20+, npm. Windows 11, PowerShell 5.1 (prefer the **Bash** tool for sweeps). `npm ci --legacy-peer-deps && npx tsc --noEmit` must exit 0. Local prod build needs `RESEND_API_KEY=re_dummy_build npm run build`. After switching branches `rm -rf .next` before tsc.
- **Supabase MCP ✅ connected** — run **any** Supabase work or reads you need to hammer things out: `list_tables`/`execute_sql` to verify schema against the LIVE DB (migrations are stale), and `apply_migration` (mirror SQL into `supabase/migrations/`) for new/missing tables. Don't guess schema — query it.
- **Vercel MCP** — the **owner will RECONNECT it in this new session before you start.** Load it and USE it: that's how you **run and verify the app** for every UI fix (NakaCult scroll, the wallet-connect entry, the Turnstile widget). Pair with the `/run` and `/verify` skills. **No UI fix is "done" until you've actually loaded the page and seen it work** — the owner is done with unverified "fixed" claims.

---

## 1 · 🔴 PRIORITY 1 — NAKACULT: full rebuild (owner's #1 ask this session). Do FIRST.

The owner wants NakaCult to feel **institutional, 2030, "unbelievable" — worth $300 but it's $27 lifetime.** Dedicate the session to NakaCult end-to-end: landing page **and** every feature inside the vault. Both **frontend (UI/UX)** and **backend (pipelines, realtime, data, filters, all features functional)**.

### 1a. Launch a brutal-honest NakaCult audit FIRST (15 agents) — and DO NOT IDLE while it runs
Before building, fan out **15 read-only audit agents** (Workflow tool, in the background) across the entire NakaCult surface — **backend AND frontend** — instructed to be **brutally honest, no lies, verify against the live DB**, and benchmark vs best-in-class institutional/members-only product design.

**While those 15 agents run, you do NOT wait idle — work the §4 remaining-backlog items the whole time.** The moment the NakaCult audit returns, **immediately commit its report (every issue, every fix, the full upgrade plan) to `docs/sessions/`, then automatically start fixing it** — no pausing to ask "what next". **Work fully autonomously start-to-finish: never stop until EVERY item in this session (NakaCult rebuild + Turnstile + the backlog) is done.** Acknowledge and obey every rule in §0. Quality bar: brutal, clean, verified work — no fake "fixed" claims. Cover: the landing (`app/naka-cult/page.tsx` + `app/naka-cult/landing.css`), the Vault and all chambers — **Conclave** (governance: Decrees, Whispers, treasury panel, weighted voting — `app/vault/conclave`, `app/api/cult/proposals/*`, `app/api/cult/conviction`), **Oracle** (Daily Seal, the Sage AI, Whisper Network E2E DMs, Echo Chamber — `app/vault/oracle`, `app/api/cult/oracle/*`), **Sanctum** (Mantle, Annals, the Library/**Ddergo player**, the Forge — `app/vault/sanctum`, `app/api/cult/sanctum/*`), **Ape/Hall/Conviction** panels (`components/vault/commons/*`, `app/api/cult/ape|hall|conviction`), access/membership (`lib/cult/access.ts`, `lib/cult/holdings.ts`, `app/api/cult/me`, cron `cult-verify-membership`). For each: which filters/toggles are dead, which data is real vs stale/empty vs fabricated, which pipelines aren't connected, what's not realtime, what to BUILD for a 2030 feel. Then fix everything they surface.

### 1b. Three confirmed bugs (must-fix)
1. **No wallet-connect "Enter NakaCult" entry.** Today `app/naka-cult/page.tsx` lines **54, 234, 236** render `<Link href="/vault">Enter the Vault →</Link>` and `<Link href="/dashboard/pricing">See the path →</Link>` — i.e. they route into the platform/login. **WRONG.** NakaCult must NOT be coupled to platform login. The CTA should be a **Connect-Wallet button** ("Enter NakaCult") that: connects the wallet (AppKit `useAppKit().open()` / WalletConnect — same stack the swap card uses), reads on-chain holdings, and **unlocks the Vault iff the wallet holds the NIPPO NFT OR ≥ 1,227,000 $NAKA** (logic already in `lib/cult/access.ts` / `lib/cult/holdings.ts` / `app/api/cult/me`). The only relationship to the platform is that it's built on it — no login redirect.
2. **Scroll bug (long-standing; prior sessions falsely "fixed" it).** Symptom: scrolling down jumps the page back up / inverted scroll. **ROOT CAUSE (identified this session):** `app/naka-cult/landing.css` runs a continuously-animating full-page background (the aurora `::after` with a 38s rotate+scale, plus floating orbs) **inside the scroll flow**; the constant repaints fight the browser's scroll-anchoring. A prior session bolted on `overflow-anchor: none` (landing.css:18) — insufficient. **Correct fix:** rebuild the animated background as a `position: fixed` layer **outside** the scroll container, `pointer-events: none`, `will-change: transform`, GPU-composited, so it can never affect layout/scroll; ensure `overflow-anchor: none` on `html, body`; remove any scale/transform animation on page-sized elements in the scroll flow. **MUST verify by actually running the app** (use the /run or /verify skill) — do NOT claim it fixed without scrolling it yourself.
3. **Branding/design not clean.** Full redesign (see 1c).

### 1c. Full UI/UX redesign brief
Redesign **the entire NakaCult frontend** — landing page through every in-vault feature — to feel like a magnificent, institutional, 2030 members' product:
- **3D icons** throughout, in the **same style as the Nakalabs brand icons** (`components/icons/brand`, `components/SteinzLogo.tsx`, the existing sigils in `components/vault/sigils/*`). Icon containers, chamber tiles, stat cards — all 3D/branded, consistent.
- Cohesive branding: color system, typography/fonts, spacing, container/card design, depth, motion (tasteful — and NON scroll-breaking, see bug #2).
- Real, correct information everywhere — wire every panel/filter/feature to **live** data (no mock/placeholder). Make the **Ddergo Library player** (the in-vault soundtrack) feel premium and actually work.
- Make it lucrative/inspiring/lovely — the "$300 feel for $27 lifetime". Keep the access facts accurate (NIPPO **or** ≥ 1,227,000 $NAKA, checked daily by the resolver). The landing copy/FAQ was already refreshed this session (`feat/nakacult-landing-refresh`, unmerged) — build on it.

---

## 2 · 🔴 PRIORITY 2 — Cloudflare Turnstile (this session's other must-fix)

Symptoms reported by owner: the widget shows **"Verifying…" forever and never presents the clickable checkbox/button** for the user to verify; it claims a network issue but the **same network works for other platforms' Turnstile**; and it's **invisible/not visible on the login & signup pages unless it's in the clickable state** (likely a theme/color problem — the widget background blends into the page so only the "Verify" state is visible).

Investigate deeply and design it the way **industry-standard platforms** implement Turnstile:
- Find every Turnstile usage (`grep -rn "turnstile\|Turnstile\|cf-turnstile\|TURNSTILE\|0x4AAAA" app/ components/ lib/`). Check the widget **render mode** (managed vs non-interactive vs invisible), the **sitekey** (test vs prod), the `theme`/`appearance` options (it should be explicitly `theme: 'dark'` or `'light'` to match the auth page, not `auto` blending invisibly), the `retry`/`refresh-expired` config, and whether the script (`https://challenges.cloudflare.com/turnstile/v0/api.js`) loads before render.
- The "stuck on Verifying, no button" is a classic **render-mode / sitekey-domain / appearance** misconfig (or the widget rendering off-screen / `display:none` until interactive). Fix it to reliably show the interactive widget, with a visible container (bordered card, correct contrast) on both **login and signup**, plus a graceful error/retry state. **Verify by running the app.**

---

## 2.5 · 🔴 PRIORITY 3 — Cron COST audit (do this BEFORE the owner unpauses)

The owner paused the whole cron fleet (`CRONS_PAUSED`) **on purpose, for cost.** The platform has **only a few members**; if you unpause as-is, ~53 crons all start hammering external APIs (Alchemy/Helius/0x/Dune/CoinGecko/Birdeye) + Vercel invocations on a near-empty platform and the bill spikes. **Deep-audit every cron in `app/api/cron/*` for cost** and make each one **cheap-when-idle**:
- Every cron must short-circuit early (return in <100ms, zero external calls) **when there is no real work** — i.e. nobody is using that feature. Use/extend the `cronHasWork(table, filter)` guard in `app/api/cron/_shared.ts` so e.g. copy-trade/sniper/limit/stop-loss/DCA monitors exit instantly when there are 0 active rules/positions, alert-monitor exits when 0 active alerts, etc.
- Per-user/feature work should scale to **actual demand**, not run a full scan every tick. Gate the heavy whale/Dune/intelligence crons (whale-activity-poll/price, dune-refresh, smart-money-convergence, cluster-analysis, first-buyer-performance, insider-wallet-detector, pumpfun-velocity-poll, funding-rates-snapshot) so they only do expensive fetches when there are consumers, and right-size their cadence/batch limits in `vercel.json`.
- Produce a **cost table** per cron (external calls/run × cadence × expected rows) and flag the few that would dominate the bill; cap or defer those. Goal: unpausing is **safe and cheap** because idle features cost ~nothing. **Only after this lands should the owner flip `CRONS_PAUSED`.**

## 3 · WHAT SHIPPED THIS SESSION (don't redo — all on unmerged branches awaiting owner merge)

Two deep audits committed: `docs/sessions/AUDIT-2026-06-24-20agent.md` (20-agent) and `docs/sessions/AUDIT-2026-06-24-v2-wiring-and-frontend.md` (30-agent wiring/frontend/bugs). Raw v2 fix-todos / frontend-build-todos / bug-list JSONs were extracted to the session scratchpad during that session.

**Live DB (applied via MCP, real writes the owner authorized):**
- Applied the **full Dune tier (14 tables)** + `system_alerts` (fixed the invalid `CREATE POLICY IF NOT EXISTS` syntax) + created `funding_rate_snapshots`, `goplus_security_cache`, `user_custom_tokens` (schemas matched to the code). Mirrored into `supabase/migrations/`.
- **Nulled the 8 fabricated whale PnL rows** (`pnl_30d_usd = whale_score × $1M`) — 0 remain.
- Verified `user_copy_trades.status` has **no** live CHECK constraint (audit claim was from a stale migration).

**Unmerged branches (review queue — `git branch -r --no-merged origin/main`):**
`fix/reputation-portfolio-pnl-source` · `feat/whale-tracker-feed-fixes` · `fix/market-honest-live-and-ratio` · `feat/social-search-follow-state` · `fix/dm-realtime-auth` · `chore/remove-chosen-badge` · `chore/remove-dead-orderbook-ratio` · `feat/kill-fabricated-data` · `fix/swap-fee-honesty` (0.5% fee, unified) · `feat/nakacult-landing-refresh` · `docs/changelog-june-2026-fixes` · `chore/apply-dune-and-intel-migrations` · `feat/wire-new-intelligence-tables` (goplus cache writer + custom-token server sync) · `fix/admin-broadcast-audience-and-counts` (broadcast + feature_flags + admin auth keys) · `fix/gdpr-account-deletion-cascade` · `chore/cron-observability` (5 crons log to cron_execution_log) · `fix/copy-trade-monitor-table-name` (table probe + budget unclaim) · `fix/v2-clean-bugs-batch-1` (PnL leaderboard sort, watchlist rollback, sniper kill-switch read) · `fix/sniper-autosell-bugs` (real USDC addr, string amount, race guard) · `docs/audit-2026-06-24-20agent` · `docs/audit-v2-2026-06-24` · (others: `feat/passkey-unlock-full`, `feat/social-notifications` — not this session's).

---

## 4 · REMAINING v2 AUDIT BACKLOG (not done — for a future session AFTER NakaCult+Turnstile)

> **Verified-STALE auditor claims — do NOT "fix" (already correct on main):** whale directory Top-Losers sort (consults `SORT_ASCENDING`); sniper-bot pnl null→NaN (null-checked); portfolio Today-PnL "1000x" (series is unix seconds — correct); matcher.ts daily-cap (already excludes `alert` rows); sniper-oversight admin key (already `admin_token`). The auditors had several stale claims — **always verify before fixing.**

**P0 / money / data-plane (the data plane is dark — most needs `CRONS_PAUSED` flip first):**
- **Slippage is dead end-to-end on Swap** — the user's slippage never reaches `/api/swap/price|quote|routes`; 0x applies a hardcoded 50 bps. Thread slippage through. (Money-correctness.)
- **swap.ts decimal scaling** — `lib/services/swap.ts:105` parses Jupiter `outAmount` without dividing by output decimals; `:142` divides 0x `buyAmount` by hardcoded `1e18` (off by 1e12 for USDC/USDT 6-dec). Resolve destination-token decimals. (Display estimate, not signing — but visibly wrong.)
- **4 genuinely-missing tables** to create + wire: `composite_alerts`, `alert_templates`, `user_notification_channels`, `proof_votes`.
- **Notification delivery is structurally incomplete** even with crons running: **no whale-follow alert evaluator at all**; `fanOutNotification()` has **no Telegram branch**; alert crons ignore per-event toggles + quiet hours; Discord/SMS routing table (`user_notification_channels`) missing. Build the evaluator + channels.
- `lib/preferences/notificationSettings.ts hasExtendedSchema` — unreliable 42703 detection reports quiet-hours/email/telegram columns as "pending apply migration" though they **exist live**. Probe a specific column or `information_schema`.

**P1 / dead filters + bugs (clean, verify each):** wallet "By Change" sort == "By Value"; wallet `recent` sort no-ops; wallet chain pills (7) vs `LIVE_CHAINS` (5) — Fantom/Cronos fetch nothing; wallet hide-small tooltip text reversed; wallet Buy button `()=>{}`; market sortable table headers (static); context-feed `lib/contextFeed/filter.ts FILTER_TYPE_MAP` maps News/New-Coins to types the fetchers never emit → empty feeds; clusters `sort=members|risk_score` both delegate to `whale_score`; `app/api/social/recommendations/route.ts:50` 2nd-hop `.limit(500)` unbounded → slice caller follows to 30 first; `app/api/cron/alert-monitor/route.ts:75` never evaluates cooldown/last_triggered_at → alerts never re-arm; `app/dashboard/proof/page.tsx:89-109` returns a `'TOKEN'` placeholder when pairAddress missing → user could sign a swap into an alias (guard it); proof votes never persist (needs `proof_votes` table); DM tab-visibility resync refetches last 100 without a `before` cursor → gaps.

**Cron observability sweep (started, finish it):** ~17 crons still don't write `cron_execution_log`. Done this session: whale-activity-poll, whale-activity-price, funding-rates-snapshot, recompute-reputation, dune-refresh. Remaining: smart-money-convergence, receipt-reconciliation, sniper-monitor, limit/stop-loss-monitor, dca-executor, cluster-analysis, pumpfun-velocity-poll, whale-score-populator, first-buyer-performance, insider-wallet-detector, reputation-feedback, daily-digest, pending-trades-cleanup, biz-mention-scrape, sybil-clusters.

**Frontend 2030-gen builds (16 in the v2 report):** whale-tracker, sniper, copy-trading, naka-wallet, discovery/portfolio/market, swap/context, global design system, landing/marketing. (Separate from the NakaCult redesign.)

---

## 5 · 🚩 HUMAN-GATED (owner action — flag, don't attempt)

1. **Flip `CRONS_PAUSED` — but ONLY after the §2.5 cron-cost audit lands.** In Vercel → steinzlabs → Settings → Env Vars, **set `CRONS_PAUSED=false`** (or delete the variable entirely — both work; the code only treats the literal string `"true"` as paused) → **Redeploy**. The whole cron fleet is frozen; the Dune tables + funding + whale pricing exist and are wired and fill the moment crons run. **Single biggest unblock — but unpausing before the cost audit will spike the bill on a near-empty platform, which is exactly why it's paused. Make crons cheap-when-idle first (§2.5), then flip.**
2. **Set `DUNE_API_KEY` + the `DUNE_QUERY_*` env vars** + publish the Dune queries so `dune-refresh` populates the tables (owner says these are in env — verify).
3. **Confirm `NEXT_PUBLIC_STEINZ_FEE_PERCENT` is `0.005` or unset** so the 0.5% fee actually applies on 0x.
4. **Real-money swap signing/execute + gasless + MEV routing** — need the owner's wallet to test before merge.
5. **Rotate the static `ADMIN_BEARER_TOKEN`** → Supabase JWT / HttpOnly cookies.
6. `whale_activity.value_usd` backfill (53,929 rows) happens via the pricing cron once unpaused — not a SQL backfill (needs real per-token prices; no fabrication).

---

## 6 · OPENING SEQUENCE FOR NEXT SESSION

```bash
cd "C:\Users\DELL LATITUDE 5320\Downloads\steinzlabs"
git fetch --prune origin && git checkout main && git pull --ff-only
npm ci --legacy-peer-deps && npx tsc --noEmit            # baseline must exit 0
# 1) Confirm the owner has reconnected Vercel MCP; load it (run/verify the app with it + /run /verify skills).
# 2) Launch the 15-agent brutal-honest NakaCult audit (backend+frontend) in the BACKGROUND.
# 3) While it runs, do NOT idle — work the §4 backlog. When the audit returns, immediately commit its
#    report (issues + fixes + upgrade plan) and auto-start fixing it.
# 4) NakaCult: wallet-connect "Enter NakaCult" entry (no login redirect) + scroll-bug root fix + full
#    institutional 2030 redesign (3D branded icons, Ddergo player). VERIFY every UI fix by running the app.
# 5) Turnstile: find every usage, fix render-mode/sitekey/theme so the interactive widget reliably shows +
#    is visible on login/signup. VERIFY by running.
# 6) Cron COST audit (§2.5): make every cron cheap-when-idle so unpausing is safe; THEN tell owner to flip.
# 7) Finish the rest of the §4 backlog. NEVER STOP until everything in this session is done.
# Run any Supabase reads/migrations you need throughout. Work autonomously, brutally honest, audit before commit.
```
