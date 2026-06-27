-- Schema consolidation (audit #17/#18/#19): drop pure-orphan tables — all
-- verified 0 rows AND 0 code references against the live DB. Before this,
-- lib/jobs/cluster-detection.ts + app/api/wallet-clusters/route.ts were
-- repointed from smart_money_wallets (0 rows → degraded clustering) to the
-- canonical `whales` table.
--
-- Drop order follows the FK chain so RESTRICT holds with no surprise cascade:
--   copy_trades -> whale_transactions -> whale_wallets
--   whale_tracking -> whale_wallets
--
-- Canonical kept set: whales, whale_activity, user_whale_follows,
-- user_copy_trades, user_copy_rules, whale_submissions, social_follows.
DROP TABLE IF EXISTS public.copy_trades RESTRICT;
DROP TABLE IF EXISTS public.whale_transactions RESTRICT;
DROP TABLE IF EXISTS public.whale_tracking RESTRICT;
DROP TABLE IF EXISTS public.whale_wallets RESTRICT;
DROP TABLE IF EXISTS public.smart_money_follows RESTRICT;
DROP TABLE IF EXISTS public.smart_money_rankings RESTRICT;
DROP TABLE IF EXISTS public.entity_cache RESTRICT;
DROP TABLE IF EXISTS public.smart_money_wallets RESTRICT;
