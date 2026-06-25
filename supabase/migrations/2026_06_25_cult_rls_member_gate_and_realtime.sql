-- The cult governance/chat RLS read policies gated on the RETIRED tier
-- 'naka_cult' (always 0 rows) instead of the real membership flag cult_member,
-- so legitimate members got zero rows from the anon client — the Conclave,
-- whispers, comments etc. rendered empty for everyone. And cult_signals,
-- cult_hall_messages, cult_ape_rounds, cult_ape_votes had RLS enabled with NO
-- policy at all (fully locked). Plus none of these tables were in the realtime
-- publication, so subscribed channels never received events. Fix both: gate
-- reads on cult_member=true and publish for realtime.

CREATE OR REPLACE FUNCTION public.is_cult_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cult_member = true);
$$;

-- ── Rewrite read/insert policies that gated on tier='naka_cult' ─────────────
DROP POLICY IF EXISTS cult_proposals_read ON public.cult_proposals;
CREATE POLICY cult_proposals_read ON public.cult_proposals FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());

DROP POLICY IF EXISTS cult_votes_read ON public.cult_proposal_votes;
CREATE POLICY cult_votes_read ON public.cult_proposal_votes FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());

DROP POLICY IF EXISTS cult_comments_read ON public.cult_proposal_comments;
CREATE POLICY cult_comments_read ON public.cult_proposal_comments FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_comments_insert ON public.cult_proposal_comments;
CREATE POLICY cult_comments_insert ON public.cult_proposal_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND public.is_cult_member());

DROP POLICY IF EXISTS cult_whispers_read ON public.cult_whispers;
CREATE POLICY cult_whispers_read ON public.cult_whispers FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_whispers_insert ON public.cult_whispers;
CREATE POLICY cult_whispers_insert ON public.cult_whispers FOR INSERT
  WITH CHECK (auth.uid() = author_id AND public.is_cult_member());

DROP POLICY IF EXISTS cult_whisper_votes_read ON public.cult_whisper_votes;
CREATE POLICY cult_whisper_votes_read ON public.cult_whisper_votes FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_whisper_votes_insert ON public.cult_whisper_votes;
CREATE POLICY cult_whisper_votes_insert ON public.cult_whisper_votes FOR INSERT
  WITH CHECK (auth.uid() = voter_id AND public.is_cult_member());

-- ── Add member-read policies to the tables that had RLS on but no policy ────
DROP POLICY IF EXISTS cult_signals_read ON public.cult_signals;
CREATE POLICY cult_signals_read ON public.cult_signals FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_hall_messages_read ON public.cult_hall_messages;
CREATE POLICY cult_hall_messages_read ON public.cult_hall_messages FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_ape_rounds_read ON public.cult_ape_rounds;
CREATE POLICY cult_ape_rounds_read ON public.cult_ape_rounds FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());
DROP POLICY IF EXISTS cult_ape_votes_read ON public.cult_ape_votes;
CREATE POLICY cult_ape_votes_read ON public.cult_ape_votes FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_cult_member());

-- ── Realtime: full row image + add to the supabase_realtime publication ─────
ALTER TABLE public.cult_proposals          REPLICA IDENTITY FULL;
ALTER TABLE public.cult_proposal_votes     REPLICA IDENTITY FULL;
ALTER TABLE public.cult_proposal_comments  REPLICA IDENTITY FULL;
ALTER TABLE public.cult_whispers           REPLICA IDENTITY FULL;
ALTER TABLE public.cult_whisper_votes      REPLICA IDENTITY FULL;
ALTER TABLE public.cult_signals            REPLICA IDENTITY FULL;
ALTER TABLE public.cult_hall_messages      REPLICA IDENTITY FULL;
ALTER TABLE public.cult_ape_rounds         REPLICA IDENTITY FULL;
ALTER TABLE public.cult_ape_votes          REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.cult_proposals, public.cult_proposal_votes, public.cult_proposal_comments,
  public.cult_whispers, public.cult_whisper_votes, public.cult_signals,
  public.cult_hall_messages, public.cult_ape_rounds, public.cult_ape_votes;
