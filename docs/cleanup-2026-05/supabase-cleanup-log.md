# Supabase Advisor Cleanup Log — 2026-05-02

Per-issue resolution table for the §3 Supabase advisor cleanup. Live
DB went from **36 advisor findings to 3** after this round.

Migration files in `supabase/migrations/`:
- `2026_05_02_session_d_rls_advisor_cleanup.sql` (RLS, SECURITY DEFINER, search_path)
- `2026_05_02_session_d_auth_tokens.sql` (auth_tokens table for §1 fix #11)

Live DB migrations applied via Supabase MCP (multiple parts due to a
transient fetch failure on the first batched apply):
- `session_d_part1_helpers_and_admin`
- `session_d_part2_user_scoped_rls`
- `session_d_part3_public_read_and_fix_always_true`
- `session_d_auth_tokens`

## RLS Disabled in Public — 26 findings

All resolved by enabling RLS and adding policies that match the
codebase convention (service_role catch-all + scoped policy per
table category).

| Table | Category | Policies added |
|---|---|---|
| `admin_notes` | admin-only | service_role_all + admin_all |
| `settings_audit_log` | admin-only | service_role_all + admin_select |
| `broadcast_templates` | admin-only | service_role_all + admin_all |
| `wallet_labels` | admin-curated public-read | service_role_all + public_select + admin_write |
| `api_logs` | admin-only | service_role_all + admin_select |
| `bubblemap_conversations` | user-scoped | service_role_all + users_own (auth.uid()=user_id) |
| `copy_trades` | user-scoped | service_role_all + users_own_select |
| `smart_money_follows` | user-scoped | service_role_all + users_own |
| `support_tickets` | user-scoped + admin | service_role_all + users_own_select/insert + admin_all |
| `trend_alerts` | user-scoped | service_role_all + users_own |
| `vtx_query_logs` | user-scoped | service_role_all + users_own_select |
| `whale_tracking` | user-scoped | service_role_all + users_own |
| `search_logs` | user-scoped | service_role_all + users_own_select |
| `feature_usage` | user-scoped | service_role_all + users_own_select |
| `activity_log` | user-scoped + admin | service_role_all + users_own_select + admin_select |
| `research_views` | user-scoped | service_role_all + users_own_select/insert |
| `bubblemap_cache` | public-read computed | service_role_all + public_select |
| `naka_trust_scores` | public-read computed | service_role_all + public_select |
| `trend_metrics_cache` | public-read computed | service_role_all + public_select |
| `smart_money_convergence` | public-read computed | service_role_all + public_select |
| `convergence_events` | public-read computed | service_role_all + public_select |
| `whale_wallets` | public-read computed | service_role_all + public_select |
| `whale_transactions` | public-read computed | service_role_all + public_select |
| `whale_ai_summaries` | public-read computed | service_role_all + public_select |
| `wallet_cluster_connections` | public-read computed | service_role_all + public_select |

## RLS Enabled No Policy — 1 finding

| Table | Resolution |
|---|---|
| `admin_audit_log` | Added service_role_all + admin_select. RLS was already enabled per Session-C fix; this round added the missing policies. |

## Security Definer View — 1 finding

| Object | Resolution |
|---|---|
| `pending_trades_active` view | Rebuilt with `SET (security_invoker = true)`. Now evaluates RLS in the caller's context instead of the view-creator's, closing the bypass path on the underlying `pending_trades` table. |

## Function Search Path Mutable — 1 finding

| Function | Resolution |
|---|---|
| `public.set_updated_at` | `ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;` |

## SECURITY DEFINER Function Executable by anon/authenticated — 4 findings

| Function | Resolution |
|---|---|
| `handle_new_user` (anon) | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated;` — function is an AFTER INSERT trigger on auth.users; nothing should call it directly. |
| `handle_new_user` (authenticated) | Same revoke. |
| `handle_new_user_notification_settings` (anon) | Same revoke. |
| `handle_new_user_notification_settings` (authenticated) | Same revoke. |

## RLS Policy Always True — 2 findings

| Policy | Resolution |
|---|---|
| `engagement.engagement_insert_any` | Dropped. Replaced with `engagement_users_own_insert FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)`. |
| `waitlist.waitlist_insert_anyone` | Dropped. Replaced with `waitlist_insert_validated FOR INSERT TO anon, authenticated WITH CHECK (email matches RFC-shape regex AND length(email) <= 320 AND length(feature) <= 100)`. Public insert intent preserved (anon can still join the waitlist) but the WITH CHECK enforces shape. Added admin_select policy for admin readback. |

## New Helper Function

| Function | Purpose |
|---|---|
| `public.is_admin()` | Returns boolean: true if `auth.uid()` has `profiles.role = 'admin'`. SECURITY DEFINER with locked search_path; service_role + authenticated can EXECUTE; anon revoked. Used inside RLS policies on admin-readable tables. Self-introduces an advisor warning (`authenticated_security_definer_function_executable`) which is acceptable — the function returns a boolean about the caller, not arbitrary user data, so exposing it via `/rest/v1/rpc/is_admin` only lets a signed-in user check whether THEY are admin. |

## Deferred — documented in SECURITY_BACKLOG.md

| Finding | Reason |
|---|---|
| `pg_trgm` extension in public schema | Move requires app-wide search_path audit and migration of dependent indexes. See SECURITY_BACKLOG #4. |
| `auth_leaked_password_protection` disabled | Supabase Dashboard config, not SQL. See SECURITY_BACKLOG #3. |

## Final advisor state

```
Before: 36 findings (1 INFO, 4 WARN, 31 ERROR-level, 0 FATAL)
After:   3 findings (3 WARN, 0 ERROR, 0 FATAL)
  - extension_in_public (pg_trgm) — deferred, BACKLOG #4
  - authenticated_security_definer_function_executable (is_admin) — accepted
  - auth_leaked_password_protection — deferred, BACKLOG #3
```

## Verification

```sql
-- Run any time to confirm RLS posture:
SELECT schemaname, tablename, rowsecurity, count(*) FILTER (WHERE p.policyname IS NOT NULL) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p USING (schemaname, tablename)
WHERE schemaname = 'public'
GROUP BY 1, 2, 3
HAVING NOT rowsecurity OR count(p.policyname) = 0
ORDER BY 2;
```
Expected: empty result (every public table has RLS + at least one policy).
