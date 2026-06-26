import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { grantAchievement } from '@/lib/cult/achievements';
import { resolveNakaVoteWeight } from '@/lib/cult/entitlements';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const VoteBody = z.object({
  choice: z.enum(['yes', 'no', 'abstain']),
});

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/** Gather a user's EVM addresses across both wallet stores (wallet_identities +
 *  user_wallets_v2) for the holdings read. */
async function gatherEvmAddresses(admin: SupabaseClient, userId: string): Promise<string[]> {
  const out = new Set<string>();
  const [idents, v2] = await Promise.all([
    admin.from('wallet_identities').select('address').eq('user_id', userId),
    admin.from('user_wallets_v2').select('wallets, default_address').eq('user_id', userId),
  ]);
  for (const r of idents.data ?? []) {
    const a = (r as { address?: string }).address;
    if (a && EVM_RE.test(a)) out.add(a.toLowerCase());
  }
  for (const row of v2.data ?? []) {
    const wallets = (row as { wallets?: unknown }).wallets;
    if (Array.isArray(wallets)) {
      for (const w of wallets as Array<{ address?: string }>) {
        if (w?.address && EVM_RE.test(w.address)) out.add(w.address.toLowerCase());
      }
    }
    const def = (row as { default_address?: string }).default_address;
    if (def && EVM_RE.test(def)) out.add(def.toLowerCase());
  }
  return Array.from(out);
}

/**
 * POST /api/cult/proposals/:id/vote — cast or change a vote.
 *
 * Vote weight is sqrt-scaled by the voter's REAL on-chain $NAKA holdings
 * (resolveNakaVoteWeight, summed across their linked wallets) so whales can't
 * dominate and every member weighs at least 1. This replaces the old
 * fabricated `isChosen ? 2 : 1` constant (the Chosen lineage is retired).
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

  // Real holdings-weighted vote: sum the voter's on-chain $NAKA across their
  // linked wallets and sqrt-scale it (>=1 for every member).
  const addresses = await gatherEvmAddresses(admin, access.userId);
  const weight = await resolveNakaVoteWeight(addresses);

  // Upsert the vote (allows changing your mind while active).
  const { error: upsertErr } = await admin
    .from('cult_proposal_votes')
    .upsert(
      {
        proposal_id: proposalId,
        voter_id: access.userId,
        choice,
        weight,
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

  // Earn "Voice of the Cult" for casting a Conclave vote (idempotent).
  await grantAchievement(access.userId, 'conclave_voter');

  return NextResponse.json({ ok: true, totals });
}
