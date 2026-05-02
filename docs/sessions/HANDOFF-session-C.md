# Steinz Labs — Session C → D Handoff

> **READ THIS BEFORE TYPING CODE.** It's a top-up to `HANDOFF-session-B.md`,
> not a replacement. If you only have time for one section, read §6 of B
> (schema gotchas) and §3 + §6 below (what changed live and what to NOT
> reintroduce).
>
> Session-B doc still applies for: who the user is, the 14 working rules,
> the non-custodial constraint, repo + infra, and most schema gotchas.

---

## 1. The user — Phantomfcalls

Same as Session B (read §1 of B). Notes from Session C that are worth
keeping in muscle memory:

- He says **"deep deep"** when he wants thoroughness, **"picture perfect"**
  for UI, and **"begin"** when he's ready to ship.
- He **merges PRs himself** on GitHub; don't keep telling him to merge.
- He'll often clear local + remote branches between sessions and ask you
  to start clean off `main` — that's intentional, do it.
- He grants **migration permission** explicitly per session ("okay run
  sql"). The Supabase MCP also enforces a hard gate. Don't try to work
  around either.
- When something is genuinely blocked (network down, real-device test
  needed), tell him plainly and don't retry-loop forever. He prefers
  "blocked, here's why" over false progress.
- He explicitly told Session C to **stop saying "merge to main"** — he
  knows. Just push and link the PR.

## 2. What was actually shipped in Session C

Six PRs merged into `main` over the session, in this order:

| PR | Branch | What |
|---|---|---|
| #119 | `feat/perf-deferrals` | `.vercel/` untracked + 35 FK indexes + RLS init-plan rewrite + drop unused indexes + consolidate permissive policies |
| (merged later) | `feat/admin-fixes` (§9 from B) | listUsers bulk + banned_until + a11y |
| (merged later) | `feat/swap-wallet` (§10 from B) | Reown AppKit on swap |
| `feat/perf-pass` (§11 from B) | iframe → lightweight-charts |
| `feat/native-charts` | Whale activity chart + sniper preview chart + Bubble Map concentration timeline (`holder_snapshots` write-on-read) |
| `feat/security-pass` | `<SecurityGate>` HOC on swap + sniper |
| `feat/audit-fixes` | §13 ten-agent audit fixes (Solana case across 4 routes, slippage cap, login a11y, chart leak) |
| `feat/audit-deferred` | VTX prompt caching + server tier check, admin audit log + PII mask, Telegram cb + rate limit, light theme auth, body-text tokens |

**Net code change**: roughly +2.5k LoC, +5 reusable utilities, +6 live
DB migrations.

## 3. Live Supabase changes — applied via MCP

Verify with `SELECT * FROM supabase_migrations.schema_migrations`. Newest
first. **All idempotent.**

| Date (UTC) | Name | What |
|---|---|---|
| 2026-05-02 | `admin_audit_log` | New table for tier/ban/role/delete trail. RLS-locked, service-role only, append-only. FKs ON DELETE SET NULL. |
| 2026-05-02 | `holder_snapshots_uniq_day` | Generated `snap_date date` (UTC, immutable) + UNIQUE(token_address, chain, snap_date) for write-on-read upsert. |
| 2026-05-01 | `perf_consolidate_permissive_policies` | Dropped 25 redundant PERMISSIVE policies (53 dupe groups → 37). Service-role + authenticated pairs kept. |
| 2026-05-01 | `perf_drop_unused_indexes` | Dropped ~55 `idx_scan = 0` indexes via DO block. Excluded freshly-added FK indexes. |
| 2026-05-01 | `perf_rls_init_plan_rewrite` | Rewrote 81 RLS policies' `auth.<fn>()` → `(select auth.<fn>())`. Same semantics, evaluated once per query. |
| 2026-05-01 | `perf_fk_covering_indexes` | 35 covering indexes for FKs flagged by Supabase advisor lint 0001 + dropped `login_activity_user_id_idx` dupe. |

**The Supabase advisor advisor still flags 37 multiple-permissive-policy
groups** — all of the form `service_role_<X> [service_role]` +
`users_own_<X> [authenticated]`. Genuinely targeting different roles;
consolidating safely needs per-table review. Out of scope for now.

## 4. New utilities + components — reuse these, don't reinvent

- **`lib/utils/addressNormalize.ts`** — `normalizeAddress(chain, addr)`
  + `isEvmChain(chain)`. Use everywhere you persist or query a token /
  wallet / contract address keyed by chain. The §13 audit found **four
  routes that lowercased Solana mints** and silently corrupted them
  (handoff §6 of B critical rule). Use this helper from now on; never
  call `.toLowerCase()` on an address without going through it.
- **`lib/utils/detectDevice.ts`** — `isMobile()` / `isIOS()` /
  `isAndroid()` + extension detectors. Replaces 3× duplicated UA regex.
- **`lib/wallet/deeplink.ts`** — MetaMask + Phantom universal-link
  helpers including WalletConnect-URI variants.
- **`lib/wallet/appkit.ts`** — Reown AppKit singleton. `HAS_APPKIT`
  flag for conditional UI; null guards so missing PROJECT_ID degrades
  cleanly rather than crashing.
- **`components/wallet/AppKitBridge.tsx`** — mirrors AppKit's connected
  account into the legacy `localStorage` contract so existing
  `useWallet()` consumers keep working unchanged. One-way sync; AppKit
  is the source of truth.
- **`components/security/SecurityGate.tsx`** — wrap any "Confirm Swap /
  Save Sniper / Copy Now" CTA. Pre-fetches Trust Score; high-risk tokens
  replace the CTA with "Review risk" modal that user must acknowledge.
  Module-level inflight Map dedupes concurrent fetches. Degrades open
  on missing chain/token, degrades to amber-banner on 5xx.
- **`components/whales/WhaleActivityChart.tsx`** — cumulative-USD area
  series fed by `data.activity[]`. Empty-state stub when <2 trades.
- **`components/intelligence/BubbleMapTimelineChart.tsx`** — top-10 %
  + holder count over 90 days from `holder_snapshots`.
- **`/api/intelligence/holders/[token]/timeline`** — read endpoint for
  the Bubble Map chart. **Write happens on every page view** of the
  parent `/api/intelligence/holders/[token]` route — no new cron.

## 5. Architectural patterns to preserve

- **Non-custodial signing is load-bearing.** `lib/trading/builtinSigner.ts`
  still throws on any server-side sign attempt. AppKit only handles
  the CONNECT step. All signing flows through pending_trades. **Don't
  invent server-side signing paths.** Same as B §3.
- **AppKit + legacy direct-extension coexist.** `useWallet()` is the
  canonical hook used by ~30 components. AppKit lives INSIDE the legacy
  `WalletProvider` so consumers don't change. Bridge mirrors AppKit's
  account into localStorage. Don't refactor the 30 consumers in one PR.
- **Module-level inflight Map for repeated API calls.** Used by
  `WhaleAvatar`, `TrustScoreBadge`, `SecurityGate`. When you add a new
  badge / preview component that fetches per-token data, copy this
  pattern.
- **Lazy chart loading.** Every lightweight-charts surface is
  `next/dynamic`-loaded with `ssr: false` and a friendly placeholder.
  ~50KB bundle ships only on routes that actually render a chart.
- **Write-on-read snapshots > new crons.** Bubble Map timeline accrues
  holder snapshots in the parent holders route handler (fire-and-forget,
  de-duped one-per-day per token+chain via the unique idx). No new
  cron entry needed. Use this pattern for any future "I need historical
  data but only have point-in-time API responses" problem.
- **Server-trusted tier.** VTX route used to read `tier` from request
  body (client localStorage). Now reads from `profiles` for the
  authenticated user via `checkTier()`. Anonymous = free. Same pattern
  applies to ANY tier-gated endpoint you add.
- **Admin actions write to `admin_audit_log`.** Fire-and-forget so
  audit failures never block user-visible action; log shape:
  `{admin_id, target_user_id, action, details: jsonb}`.
- **Rate-limit pattern**: in-memory sliding window for
  single-instance Vercel functions (Telegram webhook). Switch to
  Upstash Redis when you go multi-instance.
- **PII masking on list endpoints.** Default mask, opt-in reveal via
  `?reveal=1&id=<uuid>`. Limits blast radius of leaked admin token.

## 6. Schema gotchas — net-new in C, on top of B's §6

- **`holder_snapshots`** — `(token_address, chain, holder_count,
  top10_pct, snapped_at, snap_date)` where `snap_date` is generated
  `((snapped_at AT TIME ZONE 'UTC')::date)` STORED. Required for the
  immutable index Postgres needs. UNIQUE(`token_address, chain,
  snap_date`) is the upsert onConflict target. Don't change the
  generated expression — the AT TIME ZONE 'UTC' is what makes it
  IMMUTABLE.
- **`admin_audit_log`** — RLS-enabled, **no SELECT or INSERT policy**.
  Service-role only. Don't grant any policy to authenticated/anon
  without thinking through the leak risk.
- **RLS policies platform-wide** are now in `(select auth.<fn>())` form,
  case-insensitive. If you ALTER POLICY anything, keep that form or
  the perf advisor flags you again.
- **`profiles`** still has no `email`, `status`, `tier_granted_by`, or
  `tier_granted_reason` columns. Email comes from `auth.users` via
  `auth.admin.listUsers()`. Ban status comes from `auth.users.banned_until`.
  Tier reasons go to `admin_audit_log.details` now.
- **`naka_trust_scores`** + **`whale_ai_summaries.recommended_copy_mode`**
  + **`whales.{logo_url,logo_source,logo_resolved_at}`** all exist live
  even though some migration files don't show them — they were added
  in earlier sessions. Verify with `\d` rather than reading migration
  files. The Session-C audit got tripped up by exactly this.

## 7. Critical Session-C gotchas

- **Solana base58 is case-sensitive.** Use `normalizeAddress()` from
  `lib/utils/addressNormalize.ts`. The §13 audit found 4 silently-broken
  routes; use the helper from day one in any new feature.
- **`@wagmi/connectors`** must be pinned to `^5.x`. AppKit 1.8 declared
  `>=5.9.9` peer dep with no upper bound; npm hoisted v6 (the v3-line
  connectors) which imports `@wagmi/core/tempo` — that path doesn't
  exist in v2 core, breaks the Vercel build. If anyone bumps wagmi
  deps, re-pin this and re-test `next build`.
- **Anthropic prompt caching is wired** in `lib/services/anthropic.ts`.
  System prompt is `[{type:'text', text, cache_control:{type:'ephemeral'}}]`
  and the LAST tool gets `cache_control`. **Don't break the array
  shape** — string-form `system` would silently disable the cache and
  cost a lot.
- **`.vercel/`** keeps slipping back if the Vercel CLI runs locally
  before you commit. The §11 fix untracked the files but the dir
  still exists on disk. If you see `.vercel/README.txt` in `git status`,
  it's because someone ran `vercel link` — `.gitignore` line 134
  catches it as long as nothing's tracked.
- **Telegram rate limit is in-memory**, single-instance only. If we
  ever scale to multi-instance for the webhook, swap for Upstash Redis
  (already in deps via `@upstash/redis`).
- **AppKit modal hooks** (`useAppKit`, `useAppKitAccount`) return inert
  defaults if `PROJECT_ID` is missing. Don't conditionally call hooks
  (rules of hooks) — call them unconditionally and gate the UI on
  `HAS_APPKIT`.

## 8. What's open / not done

Strictly true at end of Session C:

- **§14 E2E real-device testing** — the only deliverable that needs
  Phantomfcalls at the keyboard. Test plan in
  `docs/testing/section-10-wallet-test-plan.md`. Four flows: iOS+MM,
  iOS+Phantom, Android+MM, Android+Phantom. Tiny test balances on each
  chain. **Don't claim §10 done without this.**
- **Multi-permissive policy consolidation (37 remaining)** — all
  `service_role_<X>` + `users_own_<X>` pairs. Genuinely role-segregated;
  needs per-table review of whether merging into one policy with
  `(role = service_role OR user_owns)` qual is safe.
- **Bubble Map snapshots are cold** — table is now correctly indexed
  but rows accrue only as users view tokens. First comparison point
  per token shows ~24h after first view.
- **Sniper auto-sell entry_price_usd / tokens_received** — handoff §13
  audit gap from Session B. The autosell cron filters
  `WHERE entry_price_usd IS NOT NULL` so it's a no-op until the sniper
  execute path writes those columns at confirm time. Find where
  `sniper_executions.status` flips to `'confirmed'` and add the
  entry-price fill there. **Was not addressed in Session C.**
- **Light theme** is now wired for auth pages only. Most dashboard
  surfaces are dark-only. Sweep TBD.
- **VTX `chat_history` server persistence** — currently localStorage
  only. Audit flagged this; not addressed.
- **Approval Manager continuous monitor cron** + revocation flow.
  Audit flagged; not addressed.
- **Signature Insight pre-sign modal** — endpoint exists; UI hook
  not wired into the sign flow.

## 9. Test accounts (still valid)

Same three Max-comp accounts as B; `tier_expires_at = 2125-01-01`.
**Don't delete or downgrade these.**

- `Phantomfcalls@gmail.com` — primary
- `regadapol@gmail.com`
- `nevo.paul@gmail.com`

## 10. How to start Session D

1. `cd C:\Users\DELL LATITUDE 5320\dev\steinzlabs`
2. `git checkout main && git pull`
3. Read this file (Session C handoff) and `HANDOFF-session-B.md` —
   B is still mostly applicable.
4. `npx tsc --noEmit` — should be clean off main.
5. Pick the next item from §8 above. **Do not extend a half-finished
   surface without auditing it first** (Session B + C audit-before-build
   rule still in effect).
6. Branch `feat/<section-name>` per work item. Per-PR ship.
7. Per-section parallel-agent audit after ship. Patch CRITICAL +
   HIGH same-session.

## 11. Working preferences (carry-over from B + C)

- Casual tone. He talks short, you talk short.
- "Deep deep" = thorough, audit-driven. Not just code-and-ship.
- Audit-before-build, audit-after-ship.
- Per-section branch + commit + PR. Don't stack 9 things on one branch.
- Picture-perfect UI. Bloomberg density, dark primary, WCAG AAA.
- Real APIs. No mocks. Ever.
- When blocked, say "blocked, here's why". Don't retry-loop in silence.
- He merges PRs himself. Don't tell him to. Just push + link.
