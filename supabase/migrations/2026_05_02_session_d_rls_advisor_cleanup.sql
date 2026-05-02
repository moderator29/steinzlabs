-- =============================================================================
-- Session D — Supabase Advisor Cleanup (RLS, SECURITY DEFINER, search_path)
-- 2026-05-02
--
-- Resolves 36 advisor issues:
--   * 26 rls_disabled_in_public ERROR-level (tables exposed via PostgREST without RLS)
--   * 1  rls_enabled_no_policy   INFO  (admin_audit_log)
--   * 1  security_definer_view   ERROR (pending_trades_active)
--   * 1  function_search_path_mutable WARN (set_updated_at)
--   * 4  *_security_definer_function_executable WARN (handle_new_user*, anon+auth)
--   * 2  rls_policy_always_true  WARN (engagement_insert_any, waitlist_insert_anyone)
--   * 1  extension_in_public      WARN (pg_trgm) — DEFERRED, requires search_path audit
--   * 1  auth_leaked_password_protection — DEFERRED, dashboard config not SQL
--
-- Policy pattern:
--   service_role_<table>     ALL  (true)                    — backend writers
--   <table>_users_own_*      SEL/INS/UPD/DEL  user_id check — user-scoped tables
--   <table>_admin_*          SEL/ALL          is_admin()    — admin-only tables
--   <table>_public_select    SEL  (true)                    — global computed reference
--
-- All policies match the existing codebase convention (see §13 audit fix commits).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. is_admin() helper — SECURITY DEFINER, locked search_path
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. set_updated_at: lock search_path (advisor: function_search_path_mutable)
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 2. handle_new_user / _notification_settings: revoke direct EXECUTE
--    These are AFTER INSERT triggers on auth.users; nothing should rpc() them.
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_notification_settings()   FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. pending_trades_active view: rebuild as SECURITY INVOKER (Postgres 15+)
--    Was SECURITY DEFINER — bypassed RLS of underlying pending_trades.
-- -----------------------------------------------------------------------------

ALTER VIEW public.pending_trades_active SET (security_invoker = true);

-- =============================================================================
-- 4. ADMIN-ONLY TABLES — admin select/all + service_role all
-- =============================================================================

-- admin_audit_log: RLS already enabled, just needs policies
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_admin_audit_log ON public.admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_admin_select ON public.admin_audit_log;
CREATE POLICY service_role_admin_audit_log ON public.admin_audit_log FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY admin_audit_log_admin_select  ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_admin_notes ON public.admin_notes;
DROP POLICY IF EXISTS admin_notes_admin_all    ON public.admin_notes;
CREATE POLICY service_role_admin_notes ON public.admin_notes FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY admin_notes_admin_all    ON public.admin_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_settings_audit_log    ON public.settings_audit_log;
DROP POLICY IF EXISTS settings_audit_log_admin_select    ON public.settings_audit_log;
CREATE POLICY service_role_settings_audit_log ON public.settings_audit_log FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY settings_audit_log_admin_select ON public.settings_audit_log FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.broadcast_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_broadcast_templates  ON public.broadcast_templates;
DROP POLICY IF EXISTS broadcast_templates_admin_all     ON public.broadcast_templates;
CREATE POLICY service_role_broadcast_templates ON public.broadcast_templates FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY broadcast_templates_admin_all    ON public.broadcast_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- wallet_labels: admin-curated reference data, public read
ALTER TABLE public.wallet_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_wallet_labels   ON public.wallet_labels;
DROP POLICY IF EXISTS wallet_labels_public_select  ON public.wallet_labels;
DROP POLICY IF EXISTS wallet_labels_admin_write    ON public.wallet_labels;
CREATE POLICY service_role_wallet_labels  ON public.wallet_labels FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY wallet_labels_public_select ON public.wallet_labels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY wallet_labels_admin_write   ON public.wallet_labels FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 5. USER-SCOPED TABLES — auth.uid() = user_id
-- =============================================================================

-- bubblemap_conversations
ALTER TABLE public.bubblemap_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_bubblemap_conversations  ON public.bubblemap_conversations;
DROP POLICY IF EXISTS bubblemap_conversations_users_own     ON public.bubblemap_conversations;
CREATE POLICY service_role_bubblemap_conversations ON public.bubblemap_conversations FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY bubblemap_conversations_users_own    ON public.bubblemap_conversations FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- copy_trades
ALTER TABLE public.copy_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_copy_trades   ON public.copy_trades;
DROP POLICY IF EXISTS copy_trades_users_own_select ON public.copy_trades;
CREATE POLICY service_role_copy_trades    ON public.copy_trades FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY copy_trades_users_own_select ON public.copy_trades FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- smart_money_follows
ALTER TABLE public.smart_money_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_smart_money_follows  ON public.smart_money_follows;
DROP POLICY IF EXISTS smart_money_follows_users_own     ON public.smart_money_follows;
CREATE POLICY service_role_smart_money_follows ON public.smart_money_follows FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY smart_money_follows_users_own    ON public.smart_money_follows FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_support_tickets       ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_users_own_select   ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_users_own_insert   ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_admin_all          ON public.support_tickets;
CREATE POLICY service_role_support_tickets       ON public.support_tickets FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY support_tickets_users_own_select   ON public.support_tickets FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY support_tickets_users_own_insert   ON public.support_tickets FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY support_tickets_admin_all          ON public.support_tickets FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- trend_alerts
ALTER TABLE public.trend_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_trend_alerts ON public.trend_alerts;
DROP POLICY IF EXISTS trend_alerts_users_own    ON public.trend_alerts;
CREATE POLICY service_role_trend_alerts ON public.trend_alerts FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY trend_alerts_users_own    ON public.trend_alerts FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- vtx_query_logs (user reads own usage; backend writes)
ALTER TABLE public.vtx_query_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_vtx_query_logs        ON public.vtx_query_logs;
DROP POLICY IF EXISTS vtx_query_logs_users_own_select    ON public.vtx_query_logs;
CREATE POLICY service_role_vtx_query_logs     ON public.vtx_query_logs FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY vtx_query_logs_users_own_select ON public.vtx_query_logs FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- whale_tracking
ALTER TABLE public.whale_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_whale_tracking ON public.whale_tracking;
DROP POLICY IF EXISTS whale_tracking_users_own    ON public.whale_tracking;
CREATE POLICY service_role_whale_tracking ON public.whale_tracking FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY whale_tracking_users_own    ON public.whale_tracking FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- search_logs (user reads own; backend writes; anon searches go via service role)
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_search_logs        ON public.search_logs;
DROP POLICY IF EXISTS search_logs_users_own_select    ON public.search_logs;
CREATE POLICY service_role_search_logs     ON public.search_logs FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY search_logs_users_own_select ON public.search_logs FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- feature_usage (user reads own; backend writes)
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_feature_usage         ON public.feature_usage;
DROP POLICY IF EXISTS feature_usage_users_own_select     ON public.feature_usage;
CREATE POLICY service_role_feature_usage     ON public.feature_usage FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY feature_usage_users_own_select ON public.feature_usage FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- activity_log (user reads own; backend writes; admin reads all)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_activity_log        ON public.activity_log;
DROP POLICY IF EXISTS activity_log_users_own_select    ON public.activity_log;
DROP POLICY IF EXISTS activity_log_admin_select        ON public.activity_log;
CREATE POLICY service_role_activity_log     ON public.activity_log FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY activity_log_users_own_select ON public.activity_log FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY activity_log_admin_select     ON public.activity_log FOR SELECT TO authenticated USING (public.is_admin());

-- api_logs (admin only — has user_id but content is internal)
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_api_logs       ON public.api_logs;
DROP POLICY IF EXISTS api_logs_admin_select       ON public.api_logs;
CREATE POLICY service_role_api_logs ON public.api_logs FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY api_logs_admin_select ON public.api_logs FOR SELECT TO authenticated USING (public.is_admin());

-- research_views (count-only; user inserts own view, reads own)
ALTER TABLE public.research_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_research_views        ON public.research_views;
DROP POLICY IF EXISTS research_views_users_own_select    ON public.research_views;
DROP POLICY IF EXISTS research_views_users_own_insert    ON public.research_views;
CREATE POLICY service_role_research_views     ON public.research_views FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY research_views_users_own_select ON public.research_views FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY research_views_users_own_insert ON public.research_views FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- 6. PUBLIC-READ COMPUTED REFERENCE TABLES (writes via backend / service_role)
-- =============================================================================

ALTER TABLE public.bubblemap_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_bubblemap_cache  ON public.bubblemap_cache;
DROP POLICY IF EXISTS bubblemap_cache_public_select ON public.bubblemap_cache;
CREATE POLICY service_role_bubblemap_cache  ON public.bubblemap_cache FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY bubblemap_cache_public_select ON public.bubblemap_cache FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.naka_trust_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_naka_trust_scores  ON public.naka_trust_scores;
DROP POLICY IF EXISTS naka_trust_scores_public_select ON public.naka_trust_scores;
CREATE POLICY service_role_naka_trust_scores  ON public.naka_trust_scores FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY naka_trust_scores_public_select ON public.naka_trust_scores FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.trend_metrics_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_trend_metrics_cache  ON public.trend_metrics_cache;
DROP POLICY IF EXISTS trend_metrics_cache_public_select ON public.trend_metrics_cache;
CREATE POLICY service_role_trend_metrics_cache  ON public.trend_metrics_cache FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY trend_metrics_cache_public_select ON public.trend_metrics_cache FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.smart_money_convergence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_smart_money_convergence  ON public.smart_money_convergence;
DROP POLICY IF EXISTS smart_money_convergence_public_select ON public.smart_money_convergence;
CREATE POLICY service_role_smart_money_convergence  ON public.smart_money_convergence FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY smart_money_convergence_public_select ON public.smart_money_convergence FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.convergence_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_convergence_events  ON public.convergence_events;
DROP POLICY IF EXISTS convergence_events_public_select ON public.convergence_events;
CREATE POLICY service_role_convergence_events  ON public.convergence_events FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY convergence_events_public_select ON public.convergence_events FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.whale_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_whale_wallets  ON public.whale_wallets;
DROP POLICY IF EXISTS whale_wallets_public_select ON public.whale_wallets;
CREATE POLICY service_role_whale_wallets  ON public.whale_wallets FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY whale_wallets_public_select ON public.whale_wallets FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.whale_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_whale_transactions  ON public.whale_transactions;
DROP POLICY IF EXISTS whale_transactions_public_select ON public.whale_transactions;
CREATE POLICY service_role_whale_transactions  ON public.whale_transactions FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY whale_transactions_public_select ON public.whale_transactions FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.whale_ai_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_whale_ai_summaries  ON public.whale_ai_summaries;
DROP POLICY IF EXISTS whale_ai_summaries_public_select ON public.whale_ai_summaries;
CREATE POLICY service_role_whale_ai_summaries  ON public.whale_ai_summaries FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY whale_ai_summaries_public_select ON public.whale_ai_summaries FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.wallet_cluster_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_wallet_cluster_connections  ON public.wallet_cluster_connections;
DROP POLICY IF EXISTS wallet_cluster_connections_public_select ON public.wallet_cluster_connections;
CREATE POLICY service_role_wallet_cluster_connections  ON public.wallet_cluster_connections FOR ALL    TO service_role        USING (true) WITH CHECK (true);
CREATE POLICY wallet_cluster_connections_public_select ON public.wallet_cluster_connections FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- 7. FIX always-true policies (advisor: rls_policy_always_true)
-- =============================================================================

-- engagement_insert_any: replace "WITH CHECK (true)" with auth.uid()=user_id
DROP POLICY IF EXISTS engagement_insert_any ON public.engagement;
CREATE POLICY engagement_users_own_insert ON public.engagement
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- waitlist_insert_anyone: keep public-insert intent (anon can join waitlist) but
-- enforce email format to block junk and add admin select.
DROP POLICY IF EXISTS waitlist_insert_anyone ON public.waitlist;
CREATE POLICY waitlist_insert_validated ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 320
    AND length(feature) <= 100
  );

DROP POLICY IF EXISTS waitlist_admin_select ON public.waitlist;
CREATE POLICY waitlist_admin_select ON public.waitlist
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;

-- =============================================================================
-- DEFERRED (NOT applied here, documented in supabase-cleanup-log.md)
--   * pg_trgm in public schema — moving requires app-wide search_path adjustment
--     and migration of dependent indexes. Plan: create `extensions` schema,
--     ALTER EXTENSION pg_trgm SET SCHEMA extensions, audit all callers.
--   * auth_leaked_password_protection — Dashboard → Authentication → Policies →
--     enable "Leaked Password Protection". Cannot be set via SQL.
-- =============================================================================
