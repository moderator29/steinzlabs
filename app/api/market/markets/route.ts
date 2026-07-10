import { NextResponse } from 'next/server';
import { getMarketsByIds } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// Fetch live market data for an explicit set of CoinGecko coin ids.
//
// This is the by-ids counterpart to /api/market/prices (which returns a
// ranked page). The Watchlist tab needs it: a user's saved coins are an
// arbitrary set that rarely maps onto any single ranked page, so filtering a
// loaded page by saved ids silently drops every watched coin outside that
// page. Here we ask CoinGecko for exactly the requested ids (the /coins/markets
// `ids=` param, via getMarketsByIds) so each saved coin resolves with real
// price / logo / sparkline regardless of category or rank.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('ids') ?? '';
  // Dedupe + trim; cap at CoinGecko's per-page ceiling so an oversized query
  // can't blow the upstream URL length or per_page limit.
  const ids = Array.from(
    new Set(raw.split(',').map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 250);

  if (ids.length === 0) {
    return NextResponse.json({ tokens: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const rows = await getMarketsByIds(ids, true);
    const tokens = rows.map((coin) => ({
      id:        coin.id,
      symbol:    (coin.symbol ?? '').toUpperCase(),
      name:      coin.name ?? '',
      price:     coin.current_price ?? 0,
      change24h: coin.price_change_percentage_24h ?? 0,
      change7d:  coin.price_change_percentage_7d_in_currency ?? 0,
      volume24h: coin.total_volume ?? 0,
      marketCap: coin.market_cap ?? 0,
      rank:      coin.market_cap_rank ?? null,
      sparkline: coin.sparkline_in_7d?.price ?? [],
      image:     coin.image ?? '',
    }));
    // Real data only: ids CoinGecko can't resolve simply aren't in `tokens`.
    // The client keeps them visible in an honest minimal state instead of us
    // fabricating rows here.
    return NextResponse.json(
      { tokens },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('[market/markets]', err);
    return NextResponse.json({ tokens: [] }, { status: 502 });
  }
}
