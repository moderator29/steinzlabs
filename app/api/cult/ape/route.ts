import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';

interface VotePayload { choice?: unknown }

/**
 * GET /api/cult/ape — the current "Ape or Nope" round: the token, live cult
 * sentiment, the caller's vote + points/streak, the last resolved result, and
 * the points leaderboard. Any cult member may read.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();

  const { data: round } = await admin
    .from('cult_ape_rounds')
    .select('id, symbol, name, image_url, entry_price_usd, opened_at, resolves_at, status')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sentiment = { ape: 0, nope: 0, total: 0 };
  let myVote: string | null = null;
  if (round) {
    const { data: votes } = await admin
      .from('cult_ape_votes')
      .select('user_id, choice')
      .eq('round_id', round.id);
    for (const v of votes ?? []) {
      if (v.choice === 'ape') sentiment.ape += 1;
      else if (v.choice === 'nope') sentiment.nope += 1;
      if (v.user_id === access.userId) myVote = v.choice as string;
    }
    sentiment.total = sentiment.ape + sentiment.nope;
  }

  const votingOpen = !!round && new Date(round.resolves_at).getTime() > Date.now();

  const { data: me } = await admin
    .from('profiles')
    .select('cult_points, cult_streak, cult_best_streak')
    .eq('id', access.userId)
    .maybeSingle<{ cult_points: number | null; cult_streak: number | null; cult_best_streak: number | null }>();

  const { data: last } = await admin
    .from('cult_ape_rounds')
    .select('symbol, name, outcome, move_pct, resolved_at')
    .eq('status', 'resolved')
    .order('resolved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: top } = await admin
    .from('profiles')
    .select('id, username, display_name, is_chosen, cult_points, cult_streak')
    .gt('cult_points', 0)
    .order('cult_points', { ascending: false })
    .limit(10);

  return NextResponse.json({
    round: round ? { ...round, votingOpen } : null,
    sentiment,
    myVote,
    me: {
      points: me?.cult_points ?? 0,
      streak: me?.cult_streak ?? 0,
      bestStreak: me?.cult_best_streak ?? 0,
    },
    last: last ?? null,
    leaderboard: (top ?? []).map((p) => ({
      name: (p.display_name as string) || (p.username as string) || 'Cultist',
      isChosen: !!p.is_chosen,
      points: p.cult_points ?? 0,
      streak: p.cult_streak ?? 0,
      mine: p.id === access.userId,
    })),
  });
}

/**
 * POST /api/cult/ape — cast your call on the open round. One vote per round
 * (DB unique); locked once the round's 24h window passes. Rate-limited.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rl = await rateLimit(`cult:ape:${access.userId}`, { interval: 5_000, maxRequests: 5 });
  if (!rl.success) return rateLimitResponse(rl);

  let payload: VotePayload;
  try {
    payload = (await req.json()) as VotePayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const choice = payload.choice === 'ape' ? 'ape' : payload.choice === 'nope' ? 'nope' : null;
  if (!choice) return NextResponse.json({ error: 'invalid_choice' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: round } = await admin
    .from('cult_ape_rounds')
    .select('id, resolves_at, status')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; resolves_at: string; status: string }>();

  if (!round) return NextResponse.json({ error: 'no_open_round' }, { status: 409 });
  if (new Date(round.resolves_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'voting_closed' }, { status: 409 });
  }

  const { error } = await admin
    .from('cult_ape_votes')
    .insert({ round_id: round.id, user_id: access.userId, choice });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'already_voted' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, choice }, { status: 201 });
}
