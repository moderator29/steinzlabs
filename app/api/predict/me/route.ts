import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildQuestion } from '@/lib/predict/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STARTING_POINTS = 1000;

interface EntryRow {
  id: string;
  market_id: string;
  side: 'yes' | 'no';
  points_staked: number;
  multiplier: number;
  payout: number | null;
  status: 'open' | 'won' | 'lost' | 'void';
  created_at: string;
}

interface MarketRow {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  target_price: number;
  horizon_seconds: number;
  closes_at: string;
  outcome: 'yes' | 'no' | null;
}

/**
 * GET /api/predict/me
 * -> { points, stats:{...}, open: Entry[], history: Entry[] }
 * Seeds a stats row with 1000 points on first read.
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
      .select('points, total_won, total_staked, wins, losses, current_streak, best_streak, markets_played')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sErr) throw sErr;

    if (!stats) {
      const { data: seeded, error: seedErr } = await admin
        .from('predict_user_stats')
        .upsert({ user_id: user.id, points: STARTING_POINTS }, { onConflict: 'user_id' })
        .select('points, total_won, total_staked, wins, losses, current_streak, best_streak, markets_played')
        .maybeSingle();
      if (seedErr) throw seedErr;
      stats = seeded;
    }

    // Load this user's entries.
    const { data: entryRows, error: eErr } = await admin
      .from('predict_entries')
      .select('id, market_id, side, points_staked, multiplier, payout, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (eErr) throw eErr;

    const entries = (entryRows ?? []) as EntryRow[];

    // Load the referenced markets in one query.
    const marketIds = Array.from(new Set(entries.map((e) => e.market_id)));
    const marketById = new Map<string, MarketRow>();
    if (marketIds.length) {
      const { data: mRows, error: mErr } = await admin
        .from('predict_markets')
        .select('id, symbol, direction, target_price, horizon_seconds, closes_at, outcome')
        .in('id', marketIds);
      if (mErr) throw mErr;
      for (const m of (mRows ?? []) as MarketRow[]) marketById.set(m.id, m);
    }

    const shape = (e: EntryRow) => {
      const m = marketById.get(e.market_id);
      const symbol = m ? String(m.symbol).toUpperCase() : '';
      return {
        id: e.id,
        marketId: e.market_id,
        symbol,
        side: e.side,
        stake: Number(e.points_staked),
        multiplier: Number(e.multiplier),
        status: e.status,
        payout: e.payout === null ? null : Number(e.payout),
        market: {
          question: m
            ? buildQuestion(symbol, m.direction, Number(m.target_price), Number(m.horizon_seconds))
            : '',
          closesAt: m?.closes_at ?? null,
          outcome: m?.outcome ?? null,
        },
      };
    };

    const open = entries.filter((e) => e.status === 'open').map(shape);
    const history = entries.filter((e) => e.status !== 'open').map(shape);

    return NextResponse.json(
      {
        points: Number(stats?.points ?? STARTING_POINTS),
        stats: {
          wins: Number(stats?.wins ?? 0),
          losses: Number(stats?.losses ?? 0),
          currentStreak: Number(stats?.current_streak ?? 0),
          bestStreak: Number(stats?.best_streak ?? 0),
          marketsPlayed: Number(stats?.markets_played ?? 0),
          totalWon: Number(stats?.total_won ?? 0),
        },
        open,
        history,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
