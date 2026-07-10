import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpot, type Spot } from '@/lib/predict/priceFeed';
import { computeOdds } from '@/lib/predict/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/predict/markets
 * -> { markets: Market[], results: ResolvedMarket[] }
 *
 * All probabilities/multipliers are computed server-side per market from the
 * live price + realized vol + seconds left. The client is never trusted to
 * price anything.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    const [openRes, resolvedRes] = await Promise.all([
      admin
        .from('predict_markets')
        .select(
          'id, symbol, coingecko_id, direction, target_price, open_price, horizon_seconds, closes_at, yes_stake, no_stake, entries_count',
        )
        .eq('status', 'open')
        .order('closes_at', { ascending: true })
        .limit(60),
      admin
        .from('predict_markets')
        .select('id, symbol, direction, target_price, resolved_price, outcome, closes_at')
        .eq('status', 'resolved')
        .order('resolved_at', { ascending: false })
        .limit(10),
    ]);

    if (openRes.error) throw openRes.error;
    if (resolvedRes.error) throw resolvedRes.error;

    const openRows = openRes.data ?? [];

    // One live price fetch for every symbol on the board.
    const symbols = Array.from(new Set(openRows.map((r) => String(r.symbol).toUpperCase())));
    const spots = symbols.length ? await getSpot(symbols) : [];
    const spotBySymbol = new Map<string, Spot>();
    for (const s of spots) spotBySymbol.set(s.symbol, s);

    const markets = openRows.map((r) => {
      const symbol = String(r.symbol).toUpperCase();
      const spot = spotBySymbol.get(symbol);
      const price = spot?.price && spot.price > 0 ? spot.price : Number(r.open_price);
      const odds = computeOdds({
        price,
        target: Number(r.target_price),
        direction: r.direction as 'above' | 'below',
        closesAt: r.closes_at,
        spot,
      });
      return {
        id: r.id,
        symbol,
        coingeckoId: r.coingecko_id,
        direction: r.direction as 'above' | 'below',
        target: Number(r.target_price),
        price,
        openPrice: Number(r.open_price),
        closesAt: r.closes_at,
        horizonSeconds: Number(r.horizon_seconds),
        probYes: odds.probYes,
        yesMultiplier: odds.yesMultiplier,
        noMultiplier: odds.noMultiplier,
        volume: Number(r.yes_stake ?? 0) + Number(r.no_stake ?? 0),
        entriesCount: Number(r.entries_count ?? 0),
        series: spot?.series ?? [],
      };
    });

    const results = (resolvedRes.data ?? []).map((r) => ({
      id: r.id,
      symbol: String(r.symbol).toUpperCase(),
      direction: r.direction as 'above' | 'below',
      target: Number(r.target_price),
      resolvedPrice: r.resolved_price === null ? null : Number(r.resolved_price),
      outcome: r.outcome as 'yes' | 'no' | null,
      closesAt: r.closes_at,
    }));

    return NextResponse.json(
      { markets, results },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ markets: [], results: [], error: msg }, { status: 500 });
  }
}
