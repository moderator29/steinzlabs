import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Leaderboard persisted in Supabase (public.game_scores). Was an in-memory Map
// — per-instance on serverless and wiped on every cold start, so the
// leaderboard was effectively empty/random for users.

interface Row {
  id: string;
  username: string;
  score: number;
  coins: number;
  distance: number;
  games_played: number;
  best_streak: number;
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('game_scores')
      .select('id, username, score, coins, distance, games_played, best_streak')
      .order('score', { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Row[];
    const { count } = await admin.from('game_scores').select('id', { count: 'exact', head: true });
    return NextResponse.json({
      leaderboard: rows.map((r) => ({
        id: r.id, username: r.username, score: r.score, coins: r.coins,
        distance: r.distance, gamesPlayed: r.games_played, bestStreak: r.best_streak,
      })),
      totalPlayers: count ?? rows.length,
      highestScore: rows[0]?.score ?? 0,
      topPlayer: rows[0]?.username ?? 'N/A',
    });
  } catch {
    return NextResponse.json({ leaderboard: [], totalPlayers: 0, highestScore: 0, topPlayer: 'N/A' });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, score, coins, distance } = body;
    // typeof NaN/Infinity is 'number', so the old guard accepted score: Infinity
    // / NaN — which then poisoned Math.max(existing.score, score) and the
    // ORDER BY forever. Require a finite, non-negative score.
    if (!username || !Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: 'Username and a valid score required' }, { status: 400 });
    }
    const safeCoins = Number.isFinite(coins) && coins >= 0 ? coins : 0;
    const safeDistance = Number.isFinite(distance) && distance >= 0 ? distance : 0;
    const cleanName = String(username).trim().slice(0, 20);
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!id) return NextResponse.json({ error: 'Invalid username' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('game_scores')
      .select('score, coins, distance, games_played, best_streak')
      .eq('id', id)
      .maybeSingle<Omit<Row, 'id' | 'username'>>();

    const nextScore = existing ? Math.max(existing.score, score) : score;
    const nextCoins = existing ? (score > existing.score ? safeCoins : existing.coins) : safeCoins;
    const nextDistance = existing ? (score > existing.score ? safeDistance : existing.distance) : safeDistance;
    const nextGames = (existing?.games_played ?? 0) + 1;
    const nextStreak = Math.max(existing?.best_streak ?? 0, safeDistance);

    await admin.from('game_scores').upsert({
      id,
      username: cleanName,
      score: nextScore,
      coins: nextCoins,
      distance: nextDistance,
      games_played: nextGames,
      best_streak: nextStreak,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Rank = number of players with a strictly higher score, +1.
    const { count: higher } = await admin
      .from('game_scores')
      .select('id', { count: 'exact', head: true })
      .gt('score', nextScore);
    const { count: total } = await admin.from('game_scores').select('id', { count: 'exact', head: true });

    return NextResponse.json({
      rank: (higher ?? 0) + 1,
      totalPlayers: total ?? 1,
      personalBest: nextScore,
      gamesPlayed: nextGames,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  // Admin-only — requires Authorization: Bearer <ADMIN_BEARER_TOKEN>.
  const expected = process.env.ADMIN_BEARER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Admin auth not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    await admin.from('game_scores').delete().eq('id', id);
  } else {
    await admin.from('game_scores').delete().neq('id', '');
  }
  return NextResponse.json({ success: true });
}
