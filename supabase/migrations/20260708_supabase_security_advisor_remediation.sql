-- Supabase security-advisor remediation (applied live via MCP, mirrored here
-- for version control). Strengthens posture only.
--
-- 1) Backend-only SECURITY DEFINER functions were executable by anon /
--    authenticated because they still carried the default EXECUTE grant to the
--    PUBLIC pseudo-role. They are only ever called server-side via the service
--    role (crons) or, for dm_bump_last_message, as a table trigger. Revoke from
--    PUBLIC and re-grant explicitly to service_role.
REVOKE EXECUTE ON FUNCTION public.populate_whale_metrics(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.populate_whale_metrics(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_mev_aggregate_from_events() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_mev_aggregate_from_events() TO service_role;

REVOKE EXECUTE ON FUNCTION public.dm_bump_last_message() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.dm_bump_last_message() TO service_role;

-- 2) The public `avatars` bucket had a broad SELECT policy on storage.objects
--    that let any client enumerate every file in the bucket. Public object URLs
--    (getPublicUrl) do not need it, and the app never calls .list() on avatars.
--    Owner-scoped INSERT/UPDATE/DELETE policies are left intact.
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
