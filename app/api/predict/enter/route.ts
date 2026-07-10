import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpot } from '@/lib/predict/priceFeed';
import { computeOdds } from '@/lib/predict/market';
import { multiplierFor } from '@/lib/predict/odds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_STAKE = 1;
const MAX_STAKE = 100000;

/**
 * POST /api/predict/enter  { marketId, side, stake }
 * -> { ok, pointsLeft, entry:{ side, stake, multiplier } } | { ok:false, error }
 *
 * The multiplier is computed SERVER-SIDE from the live price + realized vol at
 * the moment of entry. The client's price/odds are never trusted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      marketId?: string;
      side?: string;
      stake?: number | string;
    };

    const marketId = String(body.marketId ?? '').trim();
    const side = String(body.side ?? '').toLowerCase();
    if (!marketId) return NextResponse.json({ ok: false, error: 'marketId required' }, { status: 400 });
    if (side !== 'yes' && side !== 'no') {
      return NextResponse.json({ ok: false, error: 'side must be yes or no' }, { status: 400 });
    }

    // Cap + floor the stake to a sane integer.
    const rawStake = Number(body.stake);
    if (!Number.isFinite(rawStake) || rawStake < MIN_STAKE) {
      return NextResponse.json({ ok: false, error: 'stake out of range' }, { status: 400 });
    }
    const stake = Math.min(MAX_STAKE, Math.max(MIN_STAKE, Math.floor(rawStake)));

    const admin = getSupabaseAdmin();

    // Verify the market is open and load pricing inputs.
    const { data: market, error: mErr } = await admin
      .from('predict_markets')
      .select('id, symbol, direction, target_price, open_price, closes_at, status')
      .eq('id', marketId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!market) return NextResponse.json({ ok: false, error: 'Market not found' }, { status: 404 });
    if (market.status !== 'open') {
      return NextResponse.json({ ok: false, error: 'Market is not open' }, { status: 409 });
    }
    if (new Date(market.closes_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: 'Market has closed' }, { status: 409 });
    }

    // Live price + vol -> model odds -> multiplier for the chosen side.
    const symbol = String(market.symbol).toUpperCase();
    const [spot] = await getSpot([symbol]);
    const price = spot?.price && spot.price > 0 ? spot.price : Number(market.open_price);
    const odds = computeOdds({
      price,
      target: Number(market.target_price),
      direction: market.direction as 'above' | 'below',
      closesAt: market.closes_at,
      spot,
    });
    const sideProb = side === 'yes' ? odds.probYes : 1 - odds.probYes;
    const multiplier = multiplierFor(sideProb);

    // Place the entry atomically via the service-role RPC (debits points,
    // enforces one entry per market, bumps stakes/counters).
    const { data, error: rpcErr } = await admin.rpc('place_predict_entry', {
      p_user_id: user.id,
      p_market_id: marketId,
      p_side: side,
      p_stake: stake,
      p_multiplier: multiplier,
    });
    if (rpcErr) throw rpcErr;

    const result = (data ?? {}) as { ok?: boolean; points_left?: number; error?: string };
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? 'Entry rejected' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      pointsLeft: result.points_left ?? null,
      entry: { side, stake, multiplier },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
