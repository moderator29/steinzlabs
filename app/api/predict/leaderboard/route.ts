import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StatRow {
  user_id: string;
  points: number;
  wins: number;
  best_streak: number;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * GET /api/predict/leaderboard
 * -> { leaders: { userId, username, displayName, avatarUrl, points, wins, bestStreak }[] }
 * Top ~25 players by Naka Points.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    const { data: statRows, error: sErr } = await admin
      .from('predict_user_stats')
      .select('user_id, points, wins, best_streak')
      .order('points', { ascending: false })
      .limit(25);
    if (sErr) throw sErr;

    const stats = (statRows ?? []) as StatRow[];
    const userIds = stats.map((s) => s.user_id);

    const profileById = new Map<string, ProfileRow>();
    if (userIds.length) {
      const { data: profiles, error: pErr } = await admin
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      if (pErr) throw pErr;
      for (const p of (profiles ?? []) as ProfileRow[]) profileById.set(p.id, p);
    }

    const leaders = stats.map((s) => {
      const p = profileById.get(s.user_id);
      return {
        userId: s.user_id,
        username: p?.username ?? null,
        displayName: p?.display_name ?? p?.username ?? 'Anonymous',
        avatarUrl: p?.avatar_url ?? null,
        points: Number(s.points ?? 0),
        wins: Number(s.wins ?? 0),
        bestStreak: Number(s.best_streak ?? 0),
      };
    });

    return NextResponse.json(
      { leaders },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ leaders: [], error: msg }, { status: 500 });
  }
}
