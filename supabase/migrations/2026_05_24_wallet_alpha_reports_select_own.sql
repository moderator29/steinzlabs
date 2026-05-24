-- D.1 follow-up from Session U: wallet_alpha_reports.authenticated_reads_alpha
-- let any authenticated user read any other user's alpha report. The data
-- is about a public on-chain wallet, but the row's generated_by field leaked
-- who looked up whom. Narrow to owner-only SELECT.
DROP POLICY IF EXISTS authenticated_reads_alpha ON public.wallet_alpha_reports;
CREATE POLICY wallet_alpha_reports_select_own
  ON public.wallet_alpha_reports FOR SELECT
  TO authenticated
  USING (generated_by = auth.uid());
