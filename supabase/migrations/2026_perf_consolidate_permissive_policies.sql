-- §11 deferral: drop redundant PERMISSIVE policies flagged by advisor
-- lint 0006. Only removing policies whose access semantics are
-- DEMONSTRABLY covered by a sibling policy on the same table+command.
-- Service-role + authenticated pairs are LEFT IN PLACE because they
-- target different roles and consolidating them safely needs per-table
-- analysis (a separate PR can take that on).
--
-- All DROPs are IF EXISTS; idempotent.

-- ─── Category A: identical-purpose service-role duplicates ───────────────
DROP POLICY IF EXISTS holder_snapshots_service ON public.holder_snapshots;
DROP POLICY IF EXISTS login_activity_service ON public.login_activity;
DROP POLICY IF EXISTS push_delivery_log_service ON public.push_delivery_log;
DROP POLICY IF EXISTS revenue_records_service ON public.revenue_records;
DROP POLICY IF EXISTS smart_money_wallets_service ON public.smart_money_wallets;
DROP POLICY IF EXISTS threats_service ON public.threats;
DROP POLICY IF EXISTS wallet_cluster_members_service ON public.wallet_cluster_members;
DROP POLICY IF EXISTS wallet_clusters_service ON public.wallet_clusters;
DROP POLICY IF EXISTS wallet_profiles_service ON public.wallet_profiles;

-- ─── Category B: drop {authenticated} duplicates of {public} policies ───
-- The {public} pgrole covers BOTH anon AND authenticated, so
-- {authenticated}-targeted siblings with the same qual are pure
-- duplicate work for every authenticated query.
DROP POLICY IF EXISTS users_own_alerts ON public.alerts;
DROP POLICY IF EXISTS users_own_dca ON public.dca_configs;
DROP POLICY IF EXISTS users_own_followed ON public.followed_entities;
DROP POLICY IF EXISTS users_own_notif_settings ON public.notification_settings;
DROP POLICY IF EXISTS users_own_positions ON public.positions;
DROP POLICY IF EXISTS users_read_own_profile ON public.profiles;
DROP POLICY IF EXISTS users_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS users_own_push_subs ON public.push_subscriptions;
DROP POLICY IF EXISTS users_own_take_profit ON public.take_profit_orders;
DROP POLICY IF EXISTS users_own_approvals ON public.token_approvals;
DROP POLICY IF EXISTS users_own_tx_history ON public.transaction_history;
DROP POLICY IF EXISTS users_own_wallet_accounts ON public.wallet_accounts;
DROP POLICY IF EXISTS users_own_whale_watchlist ON public.whale_watchlist;

-- price_alerts has two {public} policies with identical qual; keep
-- the snake_case one consistent with the rest of the schema.
DROP POLICY IF EXISTS "Users own alerts" ON public.price_alerts;

-- ─── Category C: targeted singletons ────────────────────────────────────
-- broadcasts_service_write {public} already gates on `auth.role() =
-- 'service_role'`, so a separate {service_role} policy is redundant.
DROP POLICY IF EXISTS service_role_broadcasts ON public.broadcasts;
DROP POLICY IF EXISTS service_role_platform_settings ON public.platform_settings;
-- platform_settings has both {public} and {authenticated} read policies;
-- {public} covers both. Drop the {authenticated} dupe.
DROP POLICY IF EXISTS anyone_reads_platform_settings ON public.platform_settings;
-- user_reputation: anyone_reads is broader (all rows) than users_read_own
-- (only own row). The narrower policy adds nothing if the broader one
-- permits the same query.
DROP POLICY IF EXISTS users_read_own_reputation ON public.user_reputation;
-- Admins manage whales {public} already covers the service_role path
-- via auth.role() check; drop the {service_role}-only mirror.
DROP POLICY IF EXISTS whale_addresses_service ON public.whale_addresses;
