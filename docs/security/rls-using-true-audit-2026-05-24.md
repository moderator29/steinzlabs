# RLS `USING (true)` Audit — Session U / Branch 24 / D.1

Run date: 2026-05-24
Source: `SELECT … FROM pg_policies WHERE qual='true'` (live prod DB via Supabase MCP)

## TL;DR

~150 policies match `USING (true)`. The vast majority are
`service_role_*` policies (intentional — service role bypasses RLS
anyway; the explicit policy exists so anon/auth roles get nothing) or
SELECT policies on materialised public data (market stats, smart-money
cache, holder snapshots, whale activity) where world-readable is the
intended behaviour.

## Real findings worth follow-up

| Table | Policy | Notes |
|---|---|---|
| `wallet_alpha_reports` | `authenticated_reads_alpha` (SELECT, USING `true`) | Lets any authenticated user read any other user's alpha report. The data is about a *public on-chain wallet*, but the row's `generated_by` field leaks who looked up whom. Low severity. Recommended: tighten to `USING (generated_by = auth.uid())` and add a separate `service_role_alpha` policy (already present) for cron writers. |

Everything else is intentional:

- `*_public_select`, `anyone_reads_*` on cached intelligence: bubble
  map, cluster cache, holder snapshots, market stats history, naka
  trust scores, smart-money rankings, smart-money wallets, threats,
  token risk scores, trade analytics, trend metrics, wallet edges,
  whale activity / addresses / AI summaries / transactions / wallets,
  convergence events, deployer history, security source verdicts,
  social follows.
- `user_reputation.anyone_reads_reputation`: intentional leaderboard
  feed.
- `newsletter_sends.users_read_newsletter`: public broadcast content;
  no user PII in the row.
- `vtx_shared_conversations.anyone_reads_shares`: shareable VTX
  conversations — the policy IS the share mechanism.
- `cluster_label_votes.anyone_reads_cluster_votes` + matching `cluster_labels`
  read: community-curated labels, intended public.
- `feature_flags.feature_flags_public_read`: clients read flags to
  conditionally render UI.

## Recommended single follow-up

Cut `fix/rls-wallet-alpha-reports-narrow-select` later that:

```sql
DROP POLICY IF EXISTS authenticated_reads_alpha ON public.wallet_alpha_reports;
CREATE POLICY wallet_alpha_reports_select_own
  ON public.wallet_alpha_reports FOR SELECT
  TO authenticated
  USING (generated_by = auth.uid());
```

No other rows in this audit need narrowing.
