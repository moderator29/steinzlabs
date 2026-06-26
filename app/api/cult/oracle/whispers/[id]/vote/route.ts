import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { grantAchievement } from '@/lib/cult/achievements';

export const runtime = 'nodejs';

interface VotePayload {
  vote?: unknown;
}

// Threshold: 5 echoes promotes to 'echoed', 3 silences kills as 'silenced'.
// Held intentionally low so a small cohort can resolve a whisper inside a day
// without coordinated voting; raise once the cult scales.
const ECHO_REQUIRED = 5;
const SILENCE_REQUIRED = 3;

/**
 * POST /api/cult/oracle/whispers/[id]/vote — body { vote: 'echo'|'silence' }
 *
 * One vote per cult member per whisper (PK on cult_whisper_votes). Self-vote
 * is blocked here because RLS can't peek at the whisper's author_id without
 * a SECURITY DEFINER function. After insert we tally and transition status
 * when a threshold is hit; the resolved_at column carries the transition
 * timestamp.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: VotePayload;
  try {
    payload = (await req.json()) as VotePayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const vote = payload.vote === 'echo' || payload.vote === 'silence' ? payload.vote : null;
  if (!vote) return NextResponse.json({ error: 'vote_must_be_echo_or_silence' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Look up the whisper to check status and author for self-vote prevention.
  const { data: whisper, error: readErr } = await admin
    .from('cult_whispers')
    .select('id,author_id,status')
    .eq('id', id)
    .maybeSingle<{ id: string; author_id: string | null; status: string }>();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!whisper) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (whisper.status !== 'pending') {
    return NextResponse.json({ error: 'whisper_resolved', status: whisper.status }, { status: 409 });
  }
  if (whisper.author_id === access.userId) {
    return NextResponse.json({ error: 'self_vote_forbidden' }, { status: 403 });
  }

  const { error: voteErr } = await admin
    .from('cult_whisper_votes')
    .insert({ whisper_id: id, voter_id: access.userId, vote });
  if (voteErr) {
    if ((voteErr as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'already_voted' }, { status: 409 });
    }
    return NextResponse.json({ error: voteErr.message }, { status: 500 });
  }

  // Recount from the votes table so we never trust a stale increment under
  // concurrent voting. Cheap query, single small table.
  const { data: tallies } = await admin
    .from('cult_whisper_votes')
    .select('vote')
    .eq('whisper_id', id);
  const echoes = (tallies ?? []).filter((v) => v.vote === 'echo').length;
  const silences = (tallies ?? []).filter((v) => v.vote === 'silence').length;

  let newStatus: 'pending' | 'echoed' | 'silenced' = 'pending';
  if (echoes >= ECHO_REQUIRED) newStatus = 'echoed';
  else if (silences >= SILENCE_REQUIRED) newStatus = 'silenced';

  const update: Record<string, unknown> = {
    echo_count: echoes,
    silence_count: silences,
  };
  if (newStatus !== 'pending') {
    update.status = newStatus;
    update.resolved_at = new Date().toISOString();
  }

  await admin
    .from('cult_whispers')
    .update(update)
    .eq('id', id)
    .eq('status', 'pending');

  // Earn "Carried Forward" for the whisper's author when it crosses the echo
  // threshold (idempotent; no-op for an anonymous/null author).
  if (newStatus === 'echoed') {
    await grantAchievement(whisper.author_id, 'whisper_echoed');
  }

  return NextResponse.json({
    whisper_id: id,
    echoes,
    silences,
    status: newStatus,
  });
}
