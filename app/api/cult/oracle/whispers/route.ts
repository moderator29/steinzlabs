import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface SubmitPayload {
  body?: unknown;
}

interface WhisperRow {
  id: string;
  body: string;
  status: 'pending' | 'echoed' | 'silenced';
  echo_count: number;
  silence_count: number;
  created_at: string;
  resolved_at: string | null;
}

/**
 * GET /api/cult/oracle/whispers — list the network.
 *
 * Returns pending whispers (newest first) and the most recent resolved
 * ones. author_id is NEVER projected — the network is intentionally
 * anonymous and the column is only used server-side for self-vote checks
 * and abuse traceability.
 *
 * Also returns the caller's prior votes so the UI can mark which
 * whispers the user already echoed / silenced.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const [{ data: pending }, { data: resolved }, { data: mineVotes }] = await Promise.all([
    admin
      .from('cult_whispers')
      .select('id,body,status,echo_count,silence_count,created_at,resolved_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('cult_whispers')
      .select('id,body,status,echo_count,silence_count,created_at,resolved_at')
      .in('status', ['echoed', 'silenced'])
      .order('resolved_at', { ascending: false })
      .limit(20),
    admin
      .from('cult_whisper_votes')
      .select('whisper_id,vote')
      .eq('voter_id', access.userId)
      .limit(500),
  ]);

  return NextResponse.json({
    pending: (pending ?? []) as WhisperRow[],
    resolved: (resolved ?? []) as WhisperRow[],
    myVotes: mineVotes ?? [],
  });
}

/**
 * POST — submit a new whisper. Any cult member can post; body length is
 * enforced both server-side here and by the CHECK constraint.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: SubmitPayload;
  try {
    payload = (await req.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (body.length < 12 || body.length > 1200) {
    return NextResponse.json({ error: 'body_length', detail: '12..1200' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_whispers')
    .insert({ author_id: access.userId, body })
    .select('id,body,status,echo_count,silence_count,created_at,resolved_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ whisper: data }, { status: 201 });
}
