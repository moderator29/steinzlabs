-- Security (#42): SECURITY DEFINER functions were EXECUTABLE by anon + authenticated
-- over PostgREST RPC. These are heavy internal/cron jobs (full-table recompute /
-- aggregation / vote recount), so anon access allowed unauthenticated DoS (CPU/cost
-- amplification) and unauthorized force-rewrite of whale_score / smart_money_convergence.
-- Revoke from anon + authenticated; service_role (cron) retains EXECUTE.
REVOKE EXECUTE ON FUNCTION public.populate_whale_score(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_smart_money_convergence(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_cluster_label_votes(uuid) FROM anon, authenticated;
