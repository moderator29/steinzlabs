import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  computeStreaks,
  levelFromXp,
  utcDayKey,
  xpFromCounts,
} from '@/lib/coins/streaks';

export const dynamic = 'force-dynamic';

/** How far back we look for activity. Bounded so the query stays cheap. */
const WINDOW_DAYS = 365;
const MAX_ROWS = 5000;

export type StreakXpResponse = {
  currentStreak: number;
  bestStreak: number;
  activeDays: number;
  tradeCount: number;
  postCount: number;
  xp: number;
  level: number;
  /** 0..1 progress toward the next level. */
  progress: number;
  xpToNext: number;
  nextFloor: number;
};

const EMPTY: StreakXpResponse = {
  currentStreak: 0,
  bestStreak: 0,
  activeDays: 0,
  tradeCount: 0,
  postCount: 0,
  xp: 0,
  level: 1,
  progress: 0,
  xpToNext: levelFromXp(0).xpToNext,
  nextFloor: levelFromXp(0).nextFloor,
};

/**
 * The caller's real activity streak and derived activity XP.
 *
 * Activity days = distinct UTC days on which the user has a coin_trades row OR a
 * (non-deleted) wire_posts row, within the last WINDOW_DAYS. XP is an honest
 * derived score from those real counts, never a spendable balance. When the user
 * has no activity we return honest zeros.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json(EMPTY);

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const sb = getSupabaseAdmin();

  const [tradesRes, postsRes] = await Promise.all([
    sb
      .from('coin_trades')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    sb
      .from('wire_posts')
      .select('created_at')
      .eq('author_id', user.id)
      .is('deleted_at', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
  ]);

  const tradeRows = (tradesRes.data as { created_at: string }[] | null) ?? [];
  const postRows = (postsRes.data as { created_at: string }[] | null) ?? [];

  const days = new Set<string>();
  for (const r of tradeRows) if (r.created_at) days.add(utcDayKey(r.created_at));
  for (const r of postRows) if (r.created_at) days.add(utcDayKey(r.created_at));

  const tradeCount = tradeRows.length;
  const postCount = postRows.length;

  if (days.size === 0) {
    return NextResponse.json({ ...EMPTY, tradeCount, postCount });
  }

  const { currentStreak, bestStreak } = computeStreaks([...days]);
  const xp = xpFromCounts(tradeCount, postCount);
  const lvl = levelFromXp(xp);

  const body: StreakXpResponse = {
    currentStreak,
    bestStreak,
    activeDays: days.size,
    tradeCount,
    postCount,
    xp,
    level: lvl.level,
    progress: lvl.progress,
    xpToNext: lvl.xpToNext,
    nextFloor: lvl.nextFloor,
  };
  return NextResponse.json(body);
}
