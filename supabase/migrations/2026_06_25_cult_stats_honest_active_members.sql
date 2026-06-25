-- NakaCult honesty: the cult_stats view counted the RETIRED tier='naka_cult'
-- for active_members (always 0 while real members are flagged via
-- profiles.cult_member=true), exposed a retired chosen_count, and hardcoded
-- total_naka_held to NULL. Recompute active_members from the real membership
-- flag and drop the retired chosen_count. total_naka_held stays NULL until the
-- entitlement resolver persists a real per-member on-chain NAKA sum — the UI
-- renders an honest em-dash for NULL rather than a fabricated number.
DROP VIEW IF EXISTS public.cult_stats;
CREATE VIEW public.cult_stats AS
SELECT
  (SELECT count(*) FROM public.profiles WHERE cult_member = true) AS active_members,
  NULL::numeric AS total_naka_held,
  (SELECT count(*) FROM public.cult_proposals
     WHERE status = ANY (ARRAY['passed'::text, 'executed'::text])
       AND kind = 'decree'::text) AS decrees_passed;
