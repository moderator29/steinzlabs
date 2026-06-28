-- CRITICAL: claim_copy_trade (added this session) is SECURITY DEFINER and was
-- still anon/authenticated-executable via the default PUBLIC grant — anyone
-- could /rest/v1/rpc/claim_copy_trade and insert a pending copy trade for ANY
-- user_id. Revoke from PUBLIC and grant only service_role.
REVOKE EXECUTE ON FUNCTION public.claim_copy_trade(uuid,numeric,numeric,text,text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_copy_trade(uuid,numeric,numeric,text,text,text,text,text,text,integer) TO service_role;

-- Harden the earlier #42 revokes against the PUBLIC default.
REVOKE EXECUTE ON FUNCTION public.populate_whale_score(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_smart_money_convergence(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_cluster_label_votes(uuid) FROM PUBLIC;

-- social_block_analytics is admin-facing analytics — lock to service_role.
REVOKE EXECUTE ON FUNCTION public.social_block_analytics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_block_analytics(integer) TO service_role;
