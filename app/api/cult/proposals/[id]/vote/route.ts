import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const VoteBody = z.object({
  choice: z.enum(['yes', 'no', 'abstain']),
});

/**
 * POST /api/cult/proposals/:id/vote — cast or change a vote.
 *
 * Vote weight is the user's claimed $NAKA holdings. Until the on-chain
 * resolver lands, every voter weighs 1 (the spec calls for sqrt-scaled
 * weight by holdings to avoid whales dominating; we'll fold that in
 * once `wallet_identities` + on-chain balance reads are wired).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: proposalId } = await ctx.params;
  if (!proposalId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const parsed = VoteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { choice } = parsed.data;

  const admin = getSupabaseAdmin();

  // Confirm the proposal is active and not past its window.
  const { data: proposal } = await admin
    .from('cult_proposals')
    .select('status, ends_at')
    .eq('id', proposalId)
    .maybeSingle<{ status: string; ends_at: string }>();
  if (!proposal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (proposal.status !== 'active') {
    return NextResponse.json({ error: 'closed', status: proposal.status }, { status: 409 });
  }
  if (new Date(proposal.ends_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 409 });
  }

  // Until the on-chain holdings read lands, weight is 1 per cultist
  // and 2 per Chosen (per the spec's Elder-Decree double-weight rule).
  const weight = access.isChosen ? 2 : 1;

  // Upsert the vote (allows changing your mind while active).
  const { error: upsertErr } = await admin
    .from('cult_proposal_votes')
    .upsert(
      {
        proposal_id: proposalId,
        voter_id: access.userId,
        choice,
        weight,
        is_chosen: access.isChosen,
      },
      { onConflict: 'proposal_id,voter_id' },
    );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Recompute aggregate weights from the votes table — atomic-correct
  // even on rapid changes, no drift from incremental adjustments.
  const { data: agg } = await admin
    .from('cult_proposal_votes')
    .select('choice, weight')
    .eq('proposal_id', proposalId);

  const totals = (agg ?? []).reduce(
    (acc, v: { choice: string; weight: number }) => {
      if (v.choice === 'yes')      acc.yes += Number(v.weight);
      else if (v.choice === 'no')  acc.no += Number(v.weight);
      else                         acc.abstain += Number(v.weight);
      return acc;
    },
    { yes: 0, no: 0, abstain: 0 },
  );

  await admin
    .from('cult_proposals')
    .update({
      yes_weight: totals.yes,
      no_weight: totals.no,
      abstain_weight: totals.abstain,
      voter_count: agg?.length ?? 0,
    })
    .eq('id', proposalId);

  return NextResponse.json({ ok: true, totals });
}
