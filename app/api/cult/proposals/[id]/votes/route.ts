import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/cult/proposals/:id/votes — list individual votes for orb rendering.
 *
 * Each vote becomes a glowing orb in <VoteOrbs />, sized by sqrt(weight) and
 * colored by choice. We expose only what the orb needs (choice, weight,
 * is_chosen, created_at) — voter identity stays internal until the spec
 * green-lights public voter attribution.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: proposalId } = await ctx.params;
  if (!proposalId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_proposal_votes')
    .select('choice, weight, is_chosen, created_at')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ votes: data ?? [] });
}
