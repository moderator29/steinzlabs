import { NextRequest, NextResponse } from 'next/server';

// In-memory cache: key = `${coinId}_${days}` → { data, ts }
const cache = new Map<string, { data: [number, number][]; ts: number }>();
const CACHE_TTL: Record<string, number> = {
  '1': 60_000,      // 1 day: 1 min cache
  '7': 5 * 60_000,  // 7 days: 5 min cache
  '30': 15 * 60_000,
  '365': 60 * 60_000,
  'max': 60 * 60_000,
};

function getCached(key: string, ttl: number): [number, number][] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}

function daysForTimeframe(tf: string): string {
  switch (tf) {
    case '1H': case '6H': case '1D': return '1';
    case '1W': return '7';
    case '1M': return '30';
    case '1Y': return '365';
    case 'ALL': return 'max';
    default: return '1';
  }
}

function filterByTimeframe(prices: [number, number][], tf: string): [number, number][] {
  const now = Date.now();
  switch (tf) {
    case '1H':  return prices.filter(([ts]) => now - ts <= 60 * 60 * 1000);
    case '6H':  return prices.filter(([ts]) => now - ts <= 6 * 60 * 60 * 1000);
    default:    return prices;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coinId = searchParams.get('id');
  const timeframe = searchParams.get('tf') || '1D';

  if (!coinId) {
    return NextResponse.json({ error: 'Missing coin id' }, { status: 400 });
  }

  const days = daysForTimeframe(timeframe);
  const cacheKey = `${coinId}_${days}`;
  const ttl = CACHE_TTL[days] ?? 60_000;

  const cached = getCached(cacheKey, ttl);
  if (cached) {
    const filtered = filterByTimeframe(cached, timeframe);
    return NextResponse.json({ prices: filtered, timeframe, coinId }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url, {
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Price data unavailable', prices: [] }, { status: res.status });
    }

    const data = await res.json();
    const prices: [number, number][] = data.prices || [];

    cache.set(cacheKey, { data: prices, ts: Date.now() });

    const filtered = filterByTimeframe(prices, timeframe);
    return NextResponse.json({ prices: filtered, timeframe, coinId }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chart data', prices: [] }, { status: 500 });
  }
}
