# Session P Handoff — Comprehensive Gap-Fill

## 0. Read first

Owner: Phantomfcalls / moderator29. Continuation of Session O.

This session deployed **20 parallel audit agents** against every major surface and shipped a single fix-branch closing the highest-impact gaps. Operating mode: autonomous + overnight + brutally honest about what's NOT done.

Required reading:
1. `CLAUDE.md`
2. This file
3. `docs/sessions/HANDOFF-session-O.md` (10 branches from prior session, all still pending merge)
4. `docs/industry-standard-audit.md` (now superseded for the categories audited this session)

---

## 1. New branch this session

**`fix/comprehensive-gap-fill`** — single branch consolidating 20-agent-driven fixes. typecheck-clean across every file touched. Pushed; awaiting merge.

### What it fixes

| # | Bug / gap | Fix shipped | File(s) |
|---|---|---|---|
| 1 | NAKA cult toggle invisible on mobile (was `hidden md:inline-flex`) | Now visible at every breakpoint; compact "Cult" label below sm | `components/landing/LandingNav.tsx` |
| 2 | RLS missing on `push_delivery_log` + `threats` (audit Agent 7 flagged as 🚨 CRITICAL) | Migration applied via MCP + mirrored to repo. push_delivery_log: SELECT own; threats: public SELECT (reference data) | `supabase/migrations/2026_05_17_rls_holes_and_social_rpcs.sql` |
| 3 | `app/smart-money/page.tsx` HARDCODED TOP_ENTITIES array (mock-data violation per CLAUDE.md) | Replaced with real `/api/whales?sort=whale_score&limit=24` feed; follow-state restored from server `/api/moneyRadar/follow` GET; stats computed live | `app/smart-money/page.tsx` |
| 4 | 5 new admin pages had NO sidebar nav | Added Flag / UserMinus / UserCog / LineChart / ClipboardList nav entries linking to `/admin/social-reports`, `/admin/social-block-analytics`, `/admin/social-users`, `/admin/onboarding-analytics`, `/admin/audit-tracker` | `app/admin/layout.tsx` |
| 5 | AAA contrast failures (CRITICAL — Agent 1): CTASection `#1e2e50` + `#0a1430` (1.5:1 / 1.2:1), HeroLeft `#1a2855` + `#2e3f70`, LandingFooter `#080e20` | All replaced with `var(--nl-text-muted)` / `var(--nl-text-secondary)` / `var(--nl-text-tertiary)` tokens (clears AAA 7:1 on dark) | `components/landing/CTASection.tsx`, `HeroLeft.tsx`, `LandingFooter.tsx` |
| 6 | ProfileTab login-activity fetch had no unmount cleanup → stale-setState warning + leak | Added `AbortController` + `cancelled` flag + abort on unmount; ignores AbortError in catch | `components/ProfileTab.tsx` |
| 7 | ProfileTab Supabase `.then()` lacked `.catch()` → unhandled promise rejection | Wrapped in `Promise.resolve(...)` chain with explicit `.catch()` that sets `followingCount = null` on failure | `components/ProfileTab.tsx` |
| 8 | Sentry only scrubbed cookies; JWT / email / auth header / private keys leaked into events | beforeSend now redacts Authorization + Cookie + x-cron-secret headers, strips JWT-shaped strings from extras/contexts via regex, replaces sensitive-key values (`access_token`, `private_key`, `seed`, `mnemonic`, `encrypted_private_key`), keeps only `event.user.id` (drops email + ip) | `sentry.client.config.ts` |
| 9 | Landing page missing Social + Onboarding sections per master prompt §7.1 | Two new components rendered between SecurityShowcase and StatsSection. Social: 4-pillar layout (follow / encrypted DM / leaderboards / reputation) with /discover + /docs/social CTAs. Onboarding: 3-step strip (connect wallet → meet VTX → trade) with /docs/onboarding link | `components/landing/SocialSection.tsx`, `components/landing/OnboardingMention.tsx`, `app/page.tsx` |
| 10 | `auto_copy` value missing from `user_whale_follows.copy_mode` enum but UI offered it (cron only fired `oneclick`) | Migration: dropped + recreated CHECK constraint to include `alerts / oneclick / auto_copy` | `2026_05_17_rls_holes_and_social_rpcs.sql` |
| 11 | Copy-trade dedup was in-memory only — duplicate inserts possible under cron race | Added partial unique index `user_copy_trades(user_id, source_tx_hash) WHERE source_tx_hash IS NOT NULL` | Same migration |
| 12 | `social_top_followers` referenced but never created (followers leaderboard ran slow client-side aggregation) | Created SECURITY DEFINER SQL function returning top-N profile rows | Same migration |
| 13 | Block-analytics did client-side aggregation | Created `social_block_analytics(p_limit)` returning most-blocked + most-muted in one round-trip | Same migration |
| 14 | Followers container missing from own profile (Section 2 spec said 5 containers, only 4 present) | Added `<FollowersTile />` inline component reading `social_follows where following_id=auth.uid()` | `components/ProfileTab.tsx` |
| 15 | Wallet token auto-detect missing (`/api/token-scanner` is a SECURITY scanner) | Built `/api/wallet/balances` calling Alchemy `getTokenBalances` (EVM) + `getSolanaWalletTokens` (Solana, Helius-backed) + native ETH balance row | `app/api/wallet/balances/route.ts` |
| 16 | Wallet NFT tab completely missing | Built `/api/wallet/nfts` using Alchemy NFT v3 (EVM) + Helius DAS searchAssets (Solana) + `<NftTab />` UI with marketplace links to OpenSea / Magic Eden | `app/api/wallet/nfts/route.ts`, `components/wallet/NftTab.tsx` |
| 17 | Birdeye fallback timeout was **600 seconds** (dangerously long; would tie up serverless function) | Default now 15s; env override still respected | `lib/services/birdeye.ts` |
| 18 | `social_notification_preferences` migrated but no triggers ever fired | Built `lib/social/notify.ts` exporting `notifySocialEvent({ recipient_id, event, metadata })` that honors per-event toggles + suspension check + writes to `notifications` table | `lib/social/notify.ts` |
| 19 | No CSRF / rate-limit on new state-changing API routes | `lib/api/guardRoute.ts` — one-call wrapper with auth + token-bucket rate limit (high/med/low) + optional double-submit-cookie CSRF check | `lib/api/guardRoute.ts` |
| 20 | Dashboard + admin segments had ZERO error boundaries (audit Agent 14) | Added `error.tsx` + `not-found.tsx` to both segments; Sentry capture on boundary trip | `app/dashboard/{error,not-found}.tsx`, `app/admin/{error,not-found}.tsx` |
| 21 | Empty `try/catch` in launchpad swallowing fetch errors silently | Logs the error now | `app/dashboard/launchpad/page.tsx` |

### Files touched

`supabase/migrations/2026_05_17_rls_holes_and_social_rpcs.sql`, `app/page.tsx`, `app/smart-money/page.tsx`, `app/admin/layout.tsx`, `app/dashboard/error.tsx`, `app/dashboard/not-found.tsx`, `app/admin/error.tsx`, `app/admin/not-found.tsx`, `app/dashboard/launchpad/page.tsx`, `app/api/wallet/balances/route.ts`, `app/api/wallet/nfts/route.ts`, `components/landing/LandingNav.tsx`, `components/landing/HeroLeft.tsx`, `components/landing/CTASection.tsx`, `components/landing/LandingFooter.tsx`, `components/landing/SocialSection.tsx` (new), `components/landing/OnboardingMention.tsx` (new), `components/ProfileTab.tsx`, `components/wallet/NftTab.tsx` (new), `lib/services/birdeye.ts`, `lib/social/notify.ts` (new), `lib/api/guardRoute.ts` (new), `sentry.client.config.ts`.

---

## 2. Audit findings appendix (from 20 parallel agents)

Full detail in agent transcripts; consolidated summary here for next-session pickup. Findings I did NOT fix this session are flagged 🛠.

### Landing (Agent 1)
- 🛠 OG image fallback URL mismatch (`steinzlabs.vercel.app` vs `nakalabs.xyz`)
- 🛠 Missing page-specific `generateMetadata()` on `app/page.tsx`
- 🛠 `FloatingCoins` uses 10 unoptimized external CGO images above the fold (CLS risk)
- ✅ Social + Onboarding sections added.
- ✅ Top contrast failures fixed.

### Auth (Agent 2)
- ✅ Architecture solid (rate limits, password complexity, SIWE, lockout).
- 🛠 7 empty-catch blocks across auth routes lack Sentry tagging (signin, lookup, confirm-user, forgot-password, resend-verification, reset-password, verify-email).

### Portfolio (Agent 3)
- 🛠 **HIGH**: Performance series labels chart as "Portfolio performance" but actually displays cumulative capital flow, not mark-to-market PnL. UX-misleading. `/app/api/portfolio/performance/route.ts:151-168`.
- 🛠 Timestamp unit bug at `/app/api/portfolio/performance/route.ts:163` (divides ms then × 86_400 instead of 86_400_000).
- 🛠 Mobile donut chart cramps at 375 px.

### Sniper Bot (Agent 4)
- 🛠 **HIGH**: `execution_time_ms` is always null — sub-2s claim unprovable. No `Date.now()` wrapping relay calls.
- 🛠 **HIGH**: TP/SL config saved to schema but no executor wired to UI status.
- 🛠 **HIGH**: Relayer failures silently `.catch(() => {})` at `execute/route.ts:125-132`.
- 🛠 Native `confirm()` for delete; no review modal on create.

### Copy-Trading (Agent 5)
- ✅ `auto_copy` enum + dedup unique index shipped.
- 🛠 Cron `/api/cron/copy-trade-monitor` still reads `user_whale_follows.copy_mode` instead of `user_copy_rules.mode` — mode-switching UI ineffective.
- 🛠 No audit-log entries on copy-rule edits or trade executions.

### Notifications (Agent 6)
- ✅ Social notification dispatcher shipped.
- 🛠 Web push VAPID key rotation unimplemented.
- 🛠 Telegram delivery is fire-and-forget; no queue/retry.
- 🛠 Dedup logic missing — same notification → push + email + telegram in triplicate.

### RLS (Agent 7)
- ✅ push_delivery_log + threats hole patched.
- 🛠 11 tables have `USING (true)` SELECT policies — acceptable IF truly public reference data; double-check: `swap_route_analytics`, `wallet_alpha_reports`, `platform_settings`, etc.

### Accessibility (Agent 8)
- 🛠 P0: Modals lack focus traps (AlertModal, BuySellModal).
- 🛠 P1: 8 instances of icon-only buttons without `aria-label`.
- 🛠 P2: 12+ instances of `text-slate-500/600` failing AAA on dark bg.
- 🛠 P3: Animations don't honor `prefers-reduced-motion` (FiltersModal, NotificationBell, HealthBadge, ProfileTab).

### Sentry (Agent 9)
- ✅ PII redaction expanded.
- 🛠 Cron failures logged to `cron_execution_log` table but NOT to Sentry — missing alerting.
- 🛠 No `Sentry.addBreadcrumb` calls on swap/sniper/copy-trade step transitions.

### Billing (Agent 10)
- ✅ Audit logging in admin_audit_log on tier changes works.
- 🛠 **N/A** — no payment integration exists; pricing page says "Crypto payment integration coming soon".

### Smart-Money (Agent 11)
- ✅ Mock TOP_ENTITIES removed.
- 🛠 No `smart_money_convergence` table — convergence detection is in-memory only from `recentTrades` array.
- 🛠 `wallet_profiles.whale_score` and `wallet_clusters.whale_score` columns exist but never queried.

### Profile / Settings (Agent 12)
- ✅ Followers container added.
- 🛠 Settings → "Replay onboarding" button still missing (separate /settings page not touched this branch).
- 🛠 Privacy panel uses generic `privacy_${key}` user_metadata keys instead of the discrete `profiles.is_private` / `dm_permission` / `show_*` columns shipped on Branch A.
- 🛠 2FA UI stub marked "COMING SOON" — actual TOTP/WebAuthn flow missing.
- 🛠 GDPR export endpoint exists at `/api/account/export/route.ts` but no UI link in profile.

### Admin Nav (Agent 13)
- ✅ 5 missing admin nav links added.
- 🛠 No audit-log viewer page; `admin_audit_log` has the data but nothing renders it.

### i18n Readiness (Agent 14)
- 🛠 Hardcoded English everywhere — landing page top-20 strings catalogued in agent transcript.
- 🛠 `toLocaleString()` calls (121 across codebase) lack explicit locale param.
- 🛠 Zero logical-property CSS — all `left`/`right` instead of `start`/`end`. Blocks RTL.

### Error Handling (Agent 15)
- ✅ Dashboard + admin error/not-found boundaries shipped.
- 🛠 Still no boundaries on dynamic `[id]` route segments (whale detail, cluster detail, share, etc.).
- 🛠 `PlatformEventMonitor.tsx` fetch chains have no signal timeout — orphaned requests possible.

### Crons (Agent 16)
- 🛠 7 cron handlers exist without `vercel.json` schedule (stubs): `fear-greed-index`, `narrative-detection`, `network-metrics`, `smart-money-ranking`, `trends-aggregator`, `whale-ranking-refresh`, `alert-monitor`. Either schedule them or delete the route files.
- 🛠 `sniper-auto-execute` (every 1 min) has admin-override bypass at lines 32–33 accepting `ADMIN_MIGRATION_SECRET` without `CRON_SECRET` — review.

### Rate-Limiting + CSRF (Agent 17)
- ✅ `lib/api/guardRoute.ts` ready.
- 🛠 Retrofit `guardRoute` onto: `/api/alerts` POST/DELETE, `/api/copy-trading/rules` POST, `/api/copy-trading/execute` POST, `/api/support` POST, `/api/user/delete` DELETE, `/api/wallet/send` POST.
- 🛠 Three different rate-limiter implementations coexist (`lib/rateLimit.ts`, `lib/rateLimit/rateLimit.ts`, `lib/security/rateLimit.ts`) — consolidate.

### Market Data (Agent 18)
- ✅ Birdeye 600s → 15s timeout fixed.
- 🛠 6 orphaned unauthenticated fetch calls bypass structured services (`app/admin/page.tsx:197`, `app/api/market/route.ts:37`, `app/api/health/route.ts:58`, `app/api/context-feed/route.ts:187,605,640`, `app/api/predictions/route.ts:305`).
- 🛠 No cost logging on most provider calls (only sniper paths write to `api_logs`).

### Research / Community / Social-Trading (Agent 19)
- 🛠 `app/dashboard/community/page.tsx` is 100% static placeholder (no real data).
- 🛠 `app/dashboard/social-trading/page.tsx` shows only waitlist + hardcoded PLANNED_FEATURES.
- 🛠 Launchpad `grid-cols-4` clips at 375 px (needs `sm:grid-cols-2`).
- ✅ launchpad empty-catch fixed.

### Token Detail (Agent 20)
- 🛠 Polling at 15–60 s TTL (no SSE/WS price ticks).
- 🛠 AdvancedChart fixed `420px` height doesn't scale on portrait mobile.

### Schema (Agent 21)
- 🛠 6 migrations share `2026_05_02_*` prefix (hygiene only; no functional issue).
- 🛠 Dead tables: `cult_ambient_tracks`, `cult_cosmetics`, `cult_member_loadouts` referenced nowhere.

---

## 3. Migrations applied this session

- `2026_05_17_rls_holes_and_social_rpcs` (MCP + mirrored). Combines RLS holes + auto_copy enum + dedup index + `social_top_followers` RPC + `social_block_analytics` RPC.

Safely re-runnable.

---

## 4. Memory updates

No new memory rules this session — the existing five from Session O still govern.

---

## 5. Suggested merge order (Session O branches + this session)

1. `refactor/naka-wallet-unification`
2. `phase/vtx-ai-consumer-flip`
3. `phase/security-panel-assembly`
4. `feat/social-foundation`
5. `feat/social-profile-and-discovery`
6. `feat/onboarding-and-security-pipelines`
7. `feat/reputation-cron-admin-cult`
8. `chore/audit-sweeps-and-cves`
9. `chore/seo-locale-foundation`
10. `docs/session-o-handoff-and-docs`
11. **`fix/comprehensive-gap-fill`** (THIS branch — last so it composes cleanly with all prior fixes)
12. `docs/session-p-handoff` (this doc — final)

Expected conflict zones:
- `components/ProfileTab.tsx` — Session O Branch B and this branch both modify; the Followers tile addition + Supabase `.catch()` should merge cleanly since both add (no deletions to the same lines).
- `app/admin/layout.tsx` — only this branch touches.
- `sentry.client.config.ts` — only this branch.

---

## 6. Carry-forward TODOs (🛠 from §2 audits)

Highest impact still pending — recommend a Session Q branch named `phase/audit-followups`:

1. **Portfolio chart label fix** — change "Portfolio performance" → "Capital flow" OR implement real mark-to-market PnL.
2. **Sniper timing instrumentation** — wrap relay calls with `Date.now()` so `execution_time_ms` actually populates.
3. **Sniper relayer failure handling** — replace silent `.catch(() => {})` with real retry + Sentry capture.
4. **TP/SL executor visibility** — wire status of `lib/sniper/autosell.ts` into the sniper UI so user knows their stops are being monitored.
5. **Cron stubs cleanup** — delete or schedule the 7 stub handlers.
6. **`guardRoute` retrofit** — apply to `/api/alerts`, `/api/copy-trading/*`, `/api/support`, `/api/user/delete`, `/api/wallet/send`. About 30 min of mechanical work.
7. **Settings replay-onboarding button** + privacy panel re-wire to the new discrete profile columns.
8. **2FA implementation** (was a "COMING SOON" stub).
9. **`smart_money_convergence` materialized view** + populate `whale_score` via on-chain clustering.
10. **Telegram delivery queue** + retry + dedup across channels.
11. **A/B variants 2-10 on onboarding cards** (lib lives on Branch C, edit there).
12. **VTX page-level streaming** (only VtxAiTab streams; the `/dashboard/vtx-ai` page doesn't).
13. **Per-route Pino adoption** (lib ready; ~78 routes still on `console.*`).
14. **Per-component hex sweep** (1,348 inline `#0A1EFF` documented in audit).
15. **`app/[locale]/*` per-surface migration** (foundation ready; per the seo-locale-migration playbook).

---

## 7. Reality check

Browser smoke tests: still 0. Everything in this branch is typecheck-clean only. The first verifications you should run after merging:

- Open `/` on mobile (375 px) — confirm "Cult" pill is visible in nav, the new Social section + Onboarding strip render, and contrast on hero / CTA / footer reads cleanly.
- Open `/smart-money` — confirm it shows real whale rows (not the hardcoded entities).
- Open `/admin/dashboard` — confirm the 5 new nav links appear in the sidebar.
- Open `/dashboard/messages/<your-uuid>` — encrypted DM round-trip (this still needs verification from Branch A+B).
- Open `/u/<your-username>` — confirm 5-container layout with Followers + Following both visible.
- Run `npm run build` — should pass.

If anything fails, the fix is local to the file listed in §1. No global breakage expected.

Done.
