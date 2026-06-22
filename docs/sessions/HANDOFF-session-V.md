# SESSION V — HANDOFF

> Auto-begin doc. Read this top-to-bottom, then start executing the
> next pending branch in §4. Owner mode: no questions, no pausing, just
> execute. Locked rules in §1 apply on every action. **Supersedes
> Session U.**

---

## §0 Bootstrap (first 2 minutes)

```bash
git fetch origin --prune
git checkout main && git pull --ff-only
git config user.name       # MUST print: moderator29
git config user.email      # MUST print: 101205446+moderator29@users.noreply.github.com

# Open branches from session U / mid-V (review/merge order in §3):
git branch -r --no-merged origin/main
```

If owner's first message is a slash command or a fresh bug report →
drop this doc, serve them. Otherwise → resume §4.

---

## §1 LOCKED rules — never violate

### Identity & commits
- Identity: `moderator29 <101205446+moderator29@users.noreply.github.com>` exactly
- **No AI attribution anywhere** — no `Co-Authored-By: Claude`, no "Generated with Claude", no robot footer, no emoji-credit. Owner has caught this and is firm.
- **Never commit to `main`** — owner is the only one who merges (Vercel auto-deploys from main)
- **Never amend** an existing commit — always create a new commit on top
- **Never `--no-verify`** or any hook-skip flag
- **Conventional Commits** — `feat:` `fix:` `refactor:` `chore:` `docs:` `test:` `perf:` `security:` `a11y:`. Message body explains *why* not *what* (diff shows what)
- **Audit BEFORE every commit**:
  1. `git diff --stat` — confirm only intended files
  2. `npx tsc --noEmit` — must be clean
  3. Scan: no `console.log` in prod, no empty `try/catch {}`, no TODO without tracking, no hardcoded secrets/test addresses, no commented-out code
  4. For UI: think loading/error/empty/unauthenticated/mobile failure modes

### Scope & process
- **No mock data ever.** UI missing real data → build the server pipeline in the SAME branch (Supabase / Alchemy / Helius / CoinGecko / Dune / GoPlus / DexScreener / Anthropic).
- **3–5 phase-branches max** per multi-section prompt. Don't ship 20 micro-branches.
- **Branch naming**: `feat/<slug>`, `fix/<slug>`, `perf/<slug>`, `security/<slug>`, `chore/<slug>`, `refactor/<slug>`, `docs/<slug>`, `a11y/<slug>`. **Never** `claude/`, `ai/`, `claude-code/`.
- **Todo list = full backlog in plain English** then owner picks. Don't collapse multi-section asks to bullet headlines.
- **Autonomous mode**: keep going, confirm only for destructive / migration ops.
- **Overnight mode**: when owner says "going to bed / wake up still working", never stop, never ask, never opine. Parallelize via sub-agents.
- **No false "fixed" claims** — only after prod verification. If you can't reach prod, say "attempted fix, pending production verification" and hand owner the URL.

### Brand & UX
- Casual tone with owner; MEVX / Nansen-grade UX bar
- WCAG **AAA** contrast minimums (7:1 normal, 4.5:1 large)
- Picture-perfect UX before raw functionality where they conflict at user-visible surfaces

### Schema gotchas (verified live against Supabase, NOT migration files)
- `whales.label` (NOT `name`)
- `whales.archetype` (text) — written by `whale-backfill-pnl` cron, read by feed badges
- `whales.avg_hold_hours` (numeric) — FIFO-matched weighted mean, written by same cron
- `price_alerts.price` (NOT `target_price`)
- `user_wallets_v2.wallets` is JSONB; addresses live INSIDE the JSON, `default_address` is separate
- `profiles` SELECT RLS allows public read via `profiles_select_public_safe`; also `profiles_select_own` for full-row owner access
- `profiles.tier_source` + `tier_updated_at` — `tier_source IN ('naka_balance','stripe','admin','legacy', NULL)`
- `alerts` table real schema is `id, user_id, alert_type, label, condition jsonb, triggered, active, created_at` (NOT `token_address`/`chain`/`target_price`)
- `cluster_labels` has BOTH `cluster_key` (legacy) and `cluster_id` (canonical) with a trigger syncing them — code should write `cluster_id`
- `composite_alerts` (id, user_id, name, expression jsonb, cooldown_seconds, last_triggered_at)
- `claude_api_usage` (caller, model, prompt_tokens, completion_tokens, cost_usd, cluster_id, user_id, duration_ms, ok, error)
- `admin_roles` (user_id PK, role enum, granted_by, totp_secret, totp_enrolled) — 5 roles: super_admin/support/moderator/finance/read_only
- `admin_audit_log` extended (target_type, before_state, after_state, ip_address, user_agent) — every admin mutation goes here via `lib/admin/auditLog.logAdminAction()`
- `feature_flags` (key PK, enabled, description, rollout_pct, updated_by, updated_at)
- `admin_impersonation_tokens` (admin_id, target_id, jti, expires_at, revoked_at, reason)
- `idempotency_keys` (user_id, key PK composite, endpoint, request_hash, status_code, response_body jsonb, created_at)
- `pending_telegram_messages` / `pending_discord_messages` / `pending_sms_messages` (id, attempts, next_retry_at, last_error, delivered_at)
- `wallet_alpha_reports.authenticated_reads_alpha` RLS was REPLACED with `wallet_alpha_reports_select_own` (owner-only) on 2026-05-25
- `user_preferences.preferences` JSONB holds `muted_feed_sources: string[]` (Branch 19) + `dashboard_widgets: string[]` (Branch 20)
- `platform_settings.telegram_paused` boolean — TG4 kill switch
- Before any DDL: `mcp__supabase__list_tables` first to verify column state; migration files lie

---

## §2 Owner's locked API/provider decisions — do NOT re-evaluate

| Capability | Provider | Env |
|---|---|---|
| Cross-chain bridge + cross-chain swap | LiFi | `LIFI_API_KEY` |
| EVM aggregator | 0x | `ZEROX_API_KEY` |
| EVM multi-aggregator | 1inch + KyberSwap + OpenOcean | their keys |
| Solana swap | Jupiter | `JUPITER_*` |
| EVM private mempool | Flashbots Protect RPC | `FLASHBOTS_PROTECT_RPC` |
| BSC private mempool | BloxRoute | `BLOXROUTE_BSC_URL` + `BLOXROUTE_AUTH` |
| Solana private mempool | Jito bundles | `JITO_BLOCK_ENGINE_URL` |
| EVM RPC + indexing | Alchemy | `ALCHEMY_API_KEY` |
| Solana RPC + indexing | Helius | `HELIUS_API_KEY` |
| Market data | CoinGecko (primary), DexScreener (DEX), GeckoTerminal (fallback) | `COINGECKO_API_KEY` |
| Token security | GoPlus (primary) + Honeypot.is + De.Fi + RugCheck triangulation | `GOPLUS_API_KEY` |
| Social signals | LunarCrush | `LUNARCRUSH_API_KEY` |
| Bot protection | Cloudflare Turnstile | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` |
| Onchain SQL | Dune Analytics | `DUNE_API_KEY` (+ 11 query IDs from Session U §6) |
| Realtime wallet API | Sim by Dune | `SIM_API_KEY` |
| LLM | Anthropic Claude (Sonnet 4.6 executor + Opus 4.6 advisor) | `ANTHROPIC_API_KEY` |
| Database + auth | Supabase | standard |
| Push | VAPID Web Push | `VAPID_*` |
| Telegram | Telegram Bot API | `TELEGRAM_BOT_TOKEN` |
| ERC-4337 paymaster (Branch 17 TOTP unrelated) | Pimlico | `PIMLICO_API_KEY` |
| Twilio SMS (notifications) | Twilio | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` |
| Hosting | Vercel | — |

**Explicitly REJECTED in Session U:** Nansen (paid for the slice we'd use, outside locked matrix), HaveIBeenPwned (no free tier for breachedaccount, marginal value for wallet-auth platform).

---

## §3 What shipped in Session U + V — open branches awaiting owner merge

Session U shipped 17 branches (Branches 8–24 of the original kickoff
backlog), Session V continued with 4 more focused branches. All pushed
to origin; owner opens PR + merges via GitHub UI.

### Open branches in suggested merge order

1. **`security/critical-rotations-and-patches`** (10 commits) — supply-chain CVE patches, private-key zeroization, fail-closed auth rate-limit, cron sig defense, Sentry PII scrub, DM body sanitizer, account-delete email-confirm, Turnstile fail-closed, OFAC strict mode, webhook rate limiting. **Rebased clean against main on 2026-05-24; previously had a GitHub-flagged conflict** (10 ahead / 62 behind) that was resolved by merging the NW1 Solana signing branch with the zeroize-pkBytes pattern in `lib/wallet/pendingSigner.ts`.
2. **`chore/admin-audit-log-sweep`** (HIGH-6 + D.1) — 20 admin mutation routes now call `logAdminAction()`. Includes migration `2026_05_24_wallet_alpha_reports_select_own.sql` (already applied via Supabase SQL Editor on 2026-05-25).
3. **`a11y/component-sweep`** (A11Y2/3/4/5) — focus traps on 5 modals, aria-labels on 17 icon-only buttons, useReducedMotion wraps on HeroRight + ChamberPortal, tablist keyboard nav on whale-tracker.
4. **`chore/dead-code-purge-2`** (WHALE7 + DEAD1 partial) — 2,282 lines deleted: Predictions feature (4 files), 2 orphan whale components, 2 orphan API routes, customer-service AI prompt cleaned.
5. **`feat/dashboard-widget-reorder`** (OV3 finish) — drag-drop + arrow-key + persist + render-in-saved-order UI for dashboard home tab. Native HTML5 DnD, no `react-beautiful-dnd` dep.

### Migrations applied during Session U + V

Apply via Supabase MCP (`mcp__supabase__apply_migration`) when MCP is
connected, otherwise paste into Supabase SQL Editor. All idempotent.

```
✅ 2026_05_24_alerts_realtime_and_retry.sql          (applied)
✅ 2026_05_24_cluster_unify_and_cost_cap.sql         (applied)
✅ 2026_05_24_user_security_profile.sql              (applied)
✅ 2026_05_24_admin_rbac.sql                         (applied)
✅ 2026_05_24_telegram_paused.sql                    (applied)
✅ 2026_05_24_security_q2.sql                        (idempotency_keys) (applied)
✅ 2026_05_24_wallet_alpha_reports_select_own.sql    (applied 2026-05-25)
```

No pending migrations as of session V.

### Env vars to set / rotate (Vercel project settings)
- `NEXT_PUBLIC_TWITTER_URL` + `NEXT_PUBLIC_DISCORD_URL` (footer socials — Branch 23 fail-inert if absent)
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — newsletter + alert digests
- `DUNE_API_KEY` + `DUNE_PLAN=analyst` — when Dune wiring lands
- `SIM_API_KEY` — when live wallet pages need sub-block freshness
- `PIMLICO_API_KEY` — when ERC-4337 ships (Branch 15 NW3 / future)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` — SMS path
- Verify still set: `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_BEARER_TOKEN`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL` + `_TOKEN`, `NAKA_CULT_THRESHOLD=1227000`, `NEXT_PUBLIC_NAKA_TOKEN_ADDRESS=0x6967b9a8c0b14849CFE8f9E5732B401433fD2898`

### Spot-check checklist after each branch deploys
- **security/critical-rotations-and-patches**: `?password=195656` on `/api/game-scores` returns 401; Sentry breadcrumb URLs no longer contain wallet addrs.
- **chore/admin-audit-log-sweep**: `SELECT COUNT(*) FROM admin_audit_log WHERE created_at > now() - interval '1 hour'` returns > 0 after any admin action.
- **a11y/component-sweep**: Tab into UnlockWalletModal, verify focus ring; press Escape, modal closes; on whale-tracker/[address], arrow-key cycles tabs.
- **chore/dead-code-purge-2**: `/dashboard/predictions` returns 404; customer-service AI no longer mentions Predictions.
- **feat/dashboard-widget-reorder**: click "Customise" on home tab, drag a widget, refresh — order persists.

---

## §4 Pending branches — execute in this order

Each is a self-contained branch from main. Pick the next one, cut, do
audit-before-each-commit, push, report PR URL to owner. **One
in_progress todo at a time.**

### Branch 25 — `feat/security-center-5-tab` (SC5)

The handoff's original Session U §4 SC5 deliverable: consolidate the
existing 7 standalone security pages into a single 5-tab Security Center.

Tabs:
1. **Health** — composite score (already shipped via SC1 / Branch 16),
   2FA enrollment CTA (SC3 / Branch 16), tier breakdown.
2. **Approvals** — token approval risk view (`/dashboard/approvals` content).
3. **Portfolio Risk** — concentration, blacklist matches, deployer band.
4. **Wallet Analysis** — Shadow Guardian scan results (SC4 / Branch 16
   already wired) + alpha report link.
5. **Connected Apps** — AppKit active sessions + revoke buttons
   (Branch 15 NW4 already shipped at `app/dashboard/security/connected-dapps`).

File paths to consolidate:
- `app/dashboard/security/page.tsx` — main scanner, becomes Health tab
- `app/dashboard/approvals/page.tsx` — becomes Approvals tab
- `app/dashboard/security/connected-dapps/page.tsx` — becomes Connected Apps tab
- portfolio-risk + wallet-analysis surfaces — wire from existing components

Implementation pattern:
- New `app/dashboard/security/layout.tsx` with the tab bar + WAI-ARIA tablist (use `hooks/useTabListKeys` from Branch a11y)
- Each tab is its own sub-route or a section toggle — owner preference; default to sub-routes for shareability
- Existing `/dashboard/approvals` redirects to `/dashboard/security?tab=approvals` for one release, then drops

Acceptance: every former security route still reachable via the new tab pattern, no broken links, deep-link `?tab=X` opens the right tab.

### Branch 26 — `feat/context-feed-virtualization` (CF4 finish)

Branch 19 shipped cursor pagination + SSE; the virtualization half is still pending. `components/ContextFeed.tsx` is 919 lines and renders the full event list in a single map. On long sessions the DOM can hit 1k+ nodes.

Pick ONE: `react-window` (4kb, battle-tested) OR `@tanstack/react-virtual` (bigger but already in the dep tree if @tanstack/react-query is in). Survey first:

```bash
grep -l "@tanstack/react-virtual" package.json node_modules/@tanstack/.modules.yaml 2>&1
```

If `@tanstack/react-virtual` is already in the tree, prefer it (one less dep). Otherwise install `react-window` (smaller, simpler API).

Implementation:
- Replace the `events.map(...)` block in `components/ContextFeed.tsx` with a windowed list (250px row height target, dynamic via measureElement if cards have varied height).
- Keep the existing dedup + filter pipeline upstream.
- Keep the existing scroll-to-top "N new" indicator (it should still work — virtual lists support programmatic scrollToIndex).

Acceptance: open Context Feed with 500+ events loaded via SSE; DOM node count under `[role="feed"]` stays bounded (<100 rendered children at any time); scroll perf stays at 60fps on a mid-range laptop.

### Branch 27 — `feat/passkey-unlock-prototype` (NW3)

Behind a `feature_flags.passkey_unlock.enabled` flag (seeded in Branch 17 admin_rbac). Lets users register a WebAuthn credential to unlock the Naka built-in wallet without re-typing the password every 30 minutes.

Implementation:
- Install `@simplewebauthn/browser` + `@simplewebauthn/server` (peer of `@simplewebauthn/types`)
- New `app/api/wallet/passkey/register/route.ts` — POST generates registration options, PUT verifies attestation, stores credential on a new `user_passkeys` table (user_id, credential_id PK, public_key, sign_count, created_at, last_used_at)
- New `app/api/wallet/passkey/authenticate/route.ts` — POST issues challenge, PUT verifies assertion, returns a short-lived JWT that unlocks the wallet session (same shape as `setWalletSessionKey()` in `lib/wallet/walletSession.ts`)
- UI: small "Use passkey" button on UnlockWalletModal that's only visible when the user has a registered credential AND the feature flag is on

Migration `2026_05_2X_user_passkeys.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.user_passkeys (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  text NOT NULL,
  public_key     bytea NOT NULL,
  sign_count     bigint NOT NULL DEFAULT 0,
  transports     text[],
  device_name    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  PRIMARY KEY (user_id, credential_id)
);
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_passkeys_own ON public.user_passkeys
  FOR ALL TO authenticated USING (user_id = auth.uid());
```

Acceptance: register passkey → close tab → reopen → click "Use passkey" → fingerprint/Face ID prompt → wallet unlocked, no password prompt. Falls back to password flow if any step fails.

### Branch 28 — `chore/dead-code-purge-3` (DEAD2/3/4/5 + remaining DEAD1)

The Session U §4 DEAD list called out 30+ orphan API routes + 50+ orphan components. Branch `chore/dead-code-purge-2` (mid-V) deleted 8 files (2,282 lines). The rest of the list needs per-file verification because the original audit was stale (e.g. AlertMonitorProvider / SessionGuardProvider / PlatformEventMonitor were claimed orphan but are actively mounted in `app/dashboard/layout.tsx`).

Workflow per candidate:
```bash
base=$(basename "$f" .tsx)
grep -rE "from ['\"][^'\"]*${base}['\"]|import\(['\"][^'\"]*${base}['\"]\)|lazy\(\(\) => import\(['\"][^'\"]*${base}" \
  --include="*.tsx" --include="*.ts" -l | grep -v "$f"
```
(Note the `lazy(() => import(...))` branch — many dashboard tabs are lazy-imported so a plain `from` regex misses them.)

Confirmed orphan candidates worth re-verifying:
- `app/admin/coingecko-usage`, `app/admin/telegram/diagnose` (already verified missing in §V; double-check)
- old `ContextFeed` variants (the canonical one is `components/ContextFeed.tsx`)
- old `VtxAiTab` variants
- old `SidebarMenu` variants
- aurora FX components used only by the landing page; survey carefully

**DEAD3 (whale endpoint consolidation):** merge `/api/whale-tracker` + `/api/whale-activity/stream` + `/api/whale-tracker/feed` → single endpoint. Each has its own callers — grep + redirect old paths via Next.js rewrites in `next.config.js` for one release before deleting.

**DEAD4:** merge `/api/wallet-intelligence/alerts` into `/api/sniper/state`. Check both routes' contracts first; they may have diverged.

**DEAD5:** consolidate `lib/services/cluster-detection.ts` + `lib/intelligence/holderAnalysis.ts`. Survey what each exports + which is the canonical clustering pipeline.

### Branch 29 — `chore/zod-schema-sweep` (C.5 from Session U)

Zod schema sweep on every route handler that accepts a request body. Currently patchy — some routes use Zod (composite alerts, admin TOTP, idempotency), others trust `request.json()` and destructure.

Domain-by-domain:
1. Admin routes first (highest blast radius if bypassed). Bulk-add `z.object(...).safeParse(body)` with explicit field whitelist.
2. Trading routes (sniper/copy/swap execute already have idempotency; add input validation).
3. Social routes (DM, reports, follows).
4. User-pref routes.

Don't try to do all of it in one branch; ship admin first, get reviewed, then trading.

### Branch 30 — `a11y/component-sweep-2` (remaining A11Y items)

Branch `a11y/component-sweep` shipped focus traps on 5 modals; ~8 modals + dropdowns still need it. Targets:
- `components/security/SecurityGate.tsx`
- `components/onboarding/OnboardingFlow.tsx`
- `components/onboarding/FirstRunTour.tsx`
- `components/dashboard/FirstRunTour.tsx`
- `components/legal/CookieConsent.tsx`
- `components/providers/PwaInstallPrompt.tsx`
- `components/ui/CommandPalette.tsx` (already has Escape + arrows; add proper tablist semantics if applicable)
- Tabs on `VtxSettingsDrawer` (still uses plain buttons; wire `hooks/useTabListKeys`)
- Tabs on `ProfileTab` (5 sub-pages; same hook)
- More aria-label sweep: I shipped 17 in Branch a11y; there are ~15+ remaining (NotificationBell trigger, search overlays, breadcrumb icons, etc.). Grep:
  ```bash
  grep -rEn "<button[^>]*onClick" --include="*.tsx" | grep -v "aria-label\|aria-labelledby" | grep -E ">\s*<(Bell|Search|Filter|Share|Heart|Bookmark|Settings)" | head -30
  ```

### Branch 31 — `fix/cluster-key-drop` (CLUSTER1 finish)

`chore/admin-audit-log-sweep` and `Session U Branch 12` left `cluster_labels.cluster_key` in place alongside the new `cluster_id`, synced via trigger, so legacy code on main keeps compiling during the merge window. Now that Branch 12 is merged, the cluster_key column can be dropped + the trigger removed.

```sql
DROP TRIGGER IF EXISTS cluster_labels_sync_id_key_trg ON public.cluster_labels;
DROP FUNCTION IF EXISTS public.cluster_labels_sync_id_key();
ALTER TABLE public.cluster_labels DROP COLUMN IF EXISTS cluster_key;
DROP INDEX IF EXISTS cluster_labels_cluster_key_idx;
```

Confirm no inbound writer still uses `cluster_key` before running:
```bash
grep -rn "cluster_key" --include="*.ts" --include="*.tsx" | grep -v "sybil_cluster_candidates"
```
(Sybil candidates table has its own unrelated `cluster_key` column — leave that alone.)

### Branch 32 — `feat/ov3-widget-defaults-and-show-hide`

Branch `feat/dashboard-widget-reorder` (mid-V) shipped order persistence + UI. Follow-up:
- Toggle visibility per widget (currently every registered widget is rendered if its slug is in the order array). Add a `hidden` flag inside the JSONB blob: `dashboard_widgets: { order: string[]; hidden: string[] }`.
- Migrate existing user_preferences blobs from `dashboard_widgets: string[]` → `dashboard_widgets: { order, hidden: [] }` on first read (one-time, transparent).
- Update WidgetOrderer modal to add a show/hide eye icon per row.

### Branch 33 — `perf/recharts-removal` (PERF8b)

Session U PERF8b said "recharts is unused" — actually used by 7 dashboards:
- `app/dashboard/portfolio/page.tsx`
- `app/admin/watchlist-insights/page.tsx`
- `app/admin/vtx-analytics/page.tsx`
- `app/admin/search-logs/page.tsx`
- `app/admin/revenue/page.tsx`
- `app/admin/feature-usage/page.tsx`
- `app/admin/dashboard/page.tsx`

Replace with `lightweight-charts` (already in deps + used by whale activity chart) or `@nivo/*` if richer chart types are needed. Per-page migration; do the 6 admin pages first (lower-traffic) before portfolio.

Acceptance: `package.json` no longer lists recharts; `npm install` + `npm run build` succeed; charts on each migrated page render with the same data.

### Branch 34 — `chore/whale-tracker-feed-sse`

Whale tracker page polls `/api/whale-tracker/feed` every 15s currently. The same SSE pattern shipped in Context Feed (Branch 19 `/api/context-feed/events`) can apply here. Pattern:
- New `app/api/whale-tracker/feed/events/route.ts` that wraps the existing feed endpoint behind a 5s server-side poll + EventSource stream.
- `app/dashboard/whale-tracker/page.tsx` swaps the 15s `setInterval` for the SSE subscription.

### Branch 35 — `fix/profile-tab-stale-refs`

`components/ProfileTab.tsx` still has:
- A "Show Predictions" privacy toggle that points at a deleted feature.
- A FAQ chip "How do predictions work?".

Remove both. Also surface the new "Customise dashboard" entry point near the existing "Display preferences" section so users find it without scrolling the home tab.

### Branch 36 — `feat/sc5-deep-link`

Once SC5 (Branch 25) ships, add deep-links from elsewhere on the platform:
- Swap card "View security details" → opens SC5 with Health tab + token prefilled
- Whale-tracker convergence card "Check holders" → SC5 Portfolio Risk
- Wallet-intelligence alpha report → SC5 Wallet Analysis

These are small individual touches but they're the difference between a consolidated UI and a hub nobody discovers.

### Branch 37 — `chore/sentry-source-map-upload`

The Sentry SDK is wired but source maps aren't uploaded by the CI/build script. Symptoms: prod errors show minified stack traces in the Sentry dashboard. Fix per Sentry's Next.js guide:
1. Add `SENTRY_AUTH_TOKEN` to Vercel env
2. Update `next.config.js` to include `withSentryConfig` with `sourcemaps: { disable: false }`
3. Verify via a deliberate throw on a deploy preview

### Branch 38 — `feat/landing-page-redesign-q2`

Owner mentioned wanting a refreshed landing page tied to the Naka Labs brand kit. Out of scope for individual branches above; treat as a multi-day push. Defer until Q2 marketing push timing.

---

## §5 What owner reported as BROKEN — bug verification grid

After branches merge, owner should reproduce each. Items 1-11 from
Session U handoff are unchanged; new items added during Session V:

| Owner-reported bug | Fixed in | Verify by |
|---|---|---|
| (Items 1-11 from Session U HANDOFF-session-U §5 still apply) | | |
| Predictions page rendering after descope | `chore/dead-code-purge-2` | `/dashboard/predictions` returns 404; customer-service AI no longer offers it |
| Admin audit gaps (untraceable changes) | `chore/admin-audit-log-sweep` | After any admin write, `admin_audit_log` has a new row with admin_id + action + details |
| Modal keyboard traps + missing focus rings | `a11y/component-sweep` | Tab + Escape behave correctly on the 5 modals listed in commit body |
| Dashboard widget order doesn't persist | `feat/dashboard-widget-reorder` | Drag a widget, refresh — order persists across reloads |

---

## §6 Dune query IDs (from Session U §6 — unchanged)

```
DUNE_API_KEY=<owner-set>
DUNE_PLAN=free
DUNE_QUERY_HOLDER_CONCENTRATION=7562459
DUNE_QUERY_SMART_MONEY=7562460
DUNE_QUERY_BRIDGE_FLOWS=7562461
DUNE_QUERY_WASH_TRADE=7562462
DUNE_QUERY_DEPLOYER_HISTORY=7562463
DUNE_QUERY_CLUSTER_AGGREGATES=7562465
DUNE_QUERY_TOKEN_AGE_BUYERS=7562466
DUNE_QUERY_SMART_MONEY_FLOW=7562467
DUNE_QUERY_STABLECOIN_PULSE=7562468
DUNE_QUERY_CEX_FLOW=7562469
DUNE_QUERY_MEV_LOSS=7562470
```

(Sequential gap at 7562464 is Dune-side, harmless.)

---

## §7 Removed from scope (do NOT work on)

Owner explicitly de-scoped these features. Do NOT audit, fix, or build:
- ~~Predictions~~ — page + API + component deleted in `chore/dead-code-purge-2`. ProfileTab still has cosmetic references; clean up in Branch 35.
- Launchpad
- Project Discovery (builders / projects)
- WGM Runner
- Leaderboard (as a standalone feature — leaderboards within other surfaces stay)
- Community page (vaporware)
- **Nansen** (paid, outside locked API matrix per Session U decision)
- **HaveIBeenPwned** (no free tier for the relevant API, marginal value for wallet-auth)
- **react-beautiful-dnd** (abandoned, heavy; native HTML5 drag-drop used instead in OV3)

---

## §8 Founder context

- Founder: Phantomfcalls / Seyifunmi (Omojuni Oluwaseyifunmi), email `Phantomfcalls@gmail.com`
- Brand: Naka Labs, NakaCult tier-gated inner ring
- Tone: casual, picture-perfect bar, MEVX / Nansen-grade
- Naka Labs is non-custodial — wallet keys stay client-side
- Founder is repeatedly burned by surface-level patches that don't fix root causes — every fix needs evidence (file:line + agent report) and prod verification
- Brutal honesty over hopium. If the audit was wrong / the fix isn't going to land cleanly / the scope is too big — say so explicitly
- Owner audits before every commit (`git diff --stat` + `npx tsc --noEmit` + diff scan). Standard for this session: never broken.

---

## §9 End-of-session report MUST include

1. Each item with status:
   - ✅ "Fixed and verified in production" — only after spot-check
   - ⚠️ "Fixed but pending production verification"
   - ❌ "Could not fix — [specific reason + what's needed]"
2. Branches pushed with their commit hashes + PR URLs
3. Discovered during work — bugs/opportunities found mid-task
4. Next steps for owner — what they need to do (merge order, env, migration, spot-check)

---

## §10 Quick start commands

```bash
# Pick up the next branch (Branch 25 in §4):
git checkout main && git pull --ff-only
git checkout -b feat/security-center-5-tab

# Audit-before-every-commit ritual:
git diff --stat              # confirm intended files only
npx tsc --noEmit             # must EXIT=0
git status -s | grep -v -E '^\?\? \.dune-'    # only staged + intended untracked

# Standard commit + push:
git add <paths>              # NEVER `git add -A` blindly
git commit -m "feat: <short why>" -m "$(cat <<'EOF'
<full body explaining why; no AI attribution>
EOF
)"
git push -u origin <branch>

# Final conflict check before declaring done:
git fetch origin --prune
git merge-tree --write-tree --merge-base=origin/main origin/main HEAD \
  | grep -E "<<<<<<<|conflict" || echo "CLEAN against main"
```

End of handoff. Session V begins at §4 Branch 25.
