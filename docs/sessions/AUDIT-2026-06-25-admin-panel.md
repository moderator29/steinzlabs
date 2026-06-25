# Admin Panel Audit (2026-06-25)

Read-only audit, every finding verified against the live Supabase DB
(`phvewrldcdxupsnakddx`). DB ground truth: last cron run `2026-05-13` (**43 days
stale**); `profiles.email` and `profiles.status` columns **do not exist**;
tables `flagged_tokens`, `ticket_replies`, `feature_events`, `security_scans`
**do not exist**; `admin_roles` = 0 rows.

## Security
- **FIXED in this branch — `/api/analytics/admin` returned revenue data
  UNAUTHENTICATED.** Auth ran only `if (authHeader)`, so no header → no check →
  full revenue data. Now gated with the canonical mandatory `verifyAdminContext`.
- **Static `ADMIN_BEARER_TOKEN` = super_admin** and bypasses audit logging
  (`lib/auth/adminAuth.ts:77-80,149`). With `admin_roles` empty, this (or legacy
  `profiles.role='admin'`) is the ONLY working auth path — the RBAC matrix is
  currently theater. (Human-gated: rotate the static token; seed `admin_roles`.)
- `run-migrations` guarded only by static `ADMIN_MIGRATION_SECRET`, no role/audit
  (runs 3 fixed repo files, not caller SQL — not RCE, but no trail).

## Broken / dead controls (real bugs)
1. **Phantom `profiles.email` breaks 3 features** — `app/api/admin/stats:22`,
   `broadcast:31`, `newsletter:41` all `.select('email')` from `profiles` (no
   such column): dashboard recent-signups dead, **broadcast 500s before sending**,
   newsletter 500s. Fix: source email from `auth.users` via `listUsers()` (the
   `users` route already does this correctly).
2. **Treasury reads a non-existent schema** — `admin/treasury:81-85` queries
   `platform_settings.select('value').eq('key','treasury_wallets')`; live
   `platform_settings` is a singleton with no `key`/`value`. USD hardcoded 0.
3. **Sniper per-job pause/resume is a dead button** — `sniper-oversight:85-87`
   mutates only React state, no fetch.
4. **Search Logs page** fetches `/api/admin/search-logs` which **does not exist**;
   404 swallowed → permanently empty.
5. **Security Analytics** is a flagged-tokens UI hitting `/api/admin/flagged-tokens`
   whose table `flagged_tokens` **does not exist**.
6. **Support reply** — list reads `support_tickets`; `support-tickets/route.ts`
   reads/writes missing `ticket_replies`; `reply/route.ts` writes a *different*
   table `support_conversations`. Replies 500.
7. **Audit-tracker** is a static hardcoded array despite "live tracker" docstring.
8. **Dashboard charts + revenue** hardcoded zeros (`dashboard/page.tsx:38-42,94`).
9. **Announcements type enum mismatch** — UI offers `maintenance|feature`, API zod
   accepts `info|warning|success|critical` → 400.

## Unconnected pipelines
1. **Cron fleet dark ~43 days** (53 crons in vercel.json; `cron_execution_log` max
   `2026-05-13`). The monitor only queries the last 24h, so it renders blank and
   **can't even tell the operator the fleet is dead**. Fix: surface last-run age +
   a "fleet stale" banner. (Root unblock = the §2.5 cron-cost audit + flip
   CRONS_PAUSED.)
2. **Feature flags drive almost nothing** — only `passkey_unlock` is read by app
   code (and it's false); `copy_trading`/`lifi_bridge`/`sniper`/`vtx.streaming`
   and `rollout_pct` are never consumed.
3. **Revenue tables dead** — `revenue_records`/`fee_revenue`/`platform_fees` all 0
   rows, never read; revenue derives from live 0x Trade Analytics instead.
4. **Featured tokens display nowhere** — `featured_tokens` written by admin CRUD,
   read by no surface.
5. **Audit log never populates** — `admin_audit_log` = 0; failures swallowed;
   static-bearer actions skipped.

## Missing admin tools the platform needs (prioritized)
1. **Cult membership / tier override** — none; membership is purely cron-derived
   and the crons are dead, so cult state is frozen with no manual override.
2. **Real cron health + manual trigger** — health view can't show staleness.
3. **On-chain entitlement / tier-source viewer** — inspect why a user has a tier.
4. **Working content moderation** — flagged-tokens/security + support broken.
5. **Admin role-management UI** — `admin_roles` empty, no UI → RBAC unreachable.

## What works (for the record)
users (tier/ban/delete persist), api-health (real pings), research (publish
reaches public), vtx-analytics (155), onboarding-analytics (80),
watchlist-insights (4), announcements/email-templates CRUD, settings (writes
feature_flags). `feature_usage` (69 rows) is populated but the feature-usage page
ignores it and queries missing tables instead.
