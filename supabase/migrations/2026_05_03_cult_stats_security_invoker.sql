-- Recreate the cult_stats view with security_invoker=true so RLS is enforced
-- under the querying user's permissions, not the view-creator's. The previous
-- definition (in 2026_05_02_conclave.sql) defaulted to SECURITY DEFINER which
-- triggered Supabase advisor lint 0010_security_definer_view at ERROR level.
--
-- The view body is identical to the conclave-migration version — the only
-- change is the WITH clause flipping it to invoker semantics.

DROP VIEW IF EXISTS public.cult_stats;

CREATE VIEW public.cult_stats
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*)::bigint FROM profiles WHERE tier = 'naka_cult')         AS active_members,
  (SELECT count(*)::bigint FROM profiles WHERE is_chosen = true)            AS chosen_count,
  null::numeric                                                              AS total_naka_held,
  (SELECT count(*)::bigint
     FROM cult_proposals
    WHERE status IN ('passed','executed') AND kind = 'decree')              AS decrees_passed;

GRANT SELECT ON public.cult_stats TO authenticated;
