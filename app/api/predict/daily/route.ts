import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STARTING_POINTS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/predict/daily  (auth)
 * -> { canClaim, nextAt, dailyStreak, points }
 *
 * The free daily-points bonus. `canClaim` is true when the user has never
 * claimed (last_daily_at null) or the last claim was more than 24h ago.
 * `nextAt` is when the next claim unlocks (last_daily_at + 24h) while on
 * cooldown, otherwise null. Seeds a 1000-pt stats row on first read.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Load-or-seed the user's stats row.
    let { data: stats, error: sErr } = await admin
      .from('predict_user_stats')
      .select('points, last_daily_at, daily_streak')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sErr) throw sErr;

    if (!stats) {
      const { data: seeded, error: seedErr } = await admin
        .from('predict_user_stats')
        .upsert({ user_id: user.id, points: STARTING_POINTS }, { onConflict: 'user_id' })
        .select('points, last_daily_at, daily_streak')
        .maybeSingle();
      if (seedErr) throw seedErr;
      stats = seeded;
    }

    const lastDailyAt = stats?.last_daily_at ? new Date(stats.last_daily_at).getTime() : null;
    const canClaim = lastDailyAt === null || Date.now() - lastDailyAt >= DAY_MS;
    const nextAt = canClaim || lastDailyAt === null ? null : new Date(lastDailyAt + DAY_MS).toISOString();

    return NextResponse.json(
      {
        canClaim,
        nextAt,
        dailyStreak: Number(stats?.daily_streak ?? 0),
        points: Number(stats?.points ?? STARTING_POINTS),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/predict/daily  (auth)
 * -> { ok, awarded, dailyStreak, points } | { ok:false, error, nextAt }
 *
 * Claims the daily bonus atomically via the service-role RPC
 * `claim_daily_bonus(p_user_id)`, which awards points, bumps the streak and
 * stamps last_daily_at — or refuses with `already_claimed` and the next
 * eligible time when still on cooldown.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data, error } = await admin.rpc('claim_daily_bonus', { p_user_id: user.id });
    if (error) throw error;

    const result = (data ?? {}) as {
      ok?: boolean;
      awarded?: number;
      daily_streak?: number;
      points?: number;
      error?: string;
      next_at?: string;
    };

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error ?? 'claim_failed',
        nextAt: result.next_at ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      awarded: Number(result.awarded ?? 0),
      dailyStreak: Number(result.daily_streak ?? 0),
      points: Number(result.points ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
