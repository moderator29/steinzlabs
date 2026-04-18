import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

// FIX 5A.1 / Phase 4: 7-day price sparkline for the wallet coin list.
// Backed by CoinGecko market_chart. Cached edge-side to stay under free-tier rate limits.

export const runtime = 'nodejs';

const CACHE_TTL_SEC = 300;
type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const key = `sparkline:${id}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_SEC * 1000) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=7`,
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-pro-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: CACHE_TTL_SEC },
      },
    );
    if (!res.ok) throw new Error(`cg ${res.status}`);
    const raw = (await res.json()) as { prices: Array<[number, number]> };
    // Downsample to ~48 points to keep the sparkline cheap.
    const prices = raw.prices.map((p) => p[1]);
    const step = Math.max(1, Math.floor(prices.length / 48));
    const points = prices.filter((_, i) => i % step === 0);
    const first = points[0] ?? 0;
    const last = points[points.length - 1] ?? 0;
    const changePct = first ? ((last - first) / first) * 100 : 0;
    const data = { points, changePct };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    });
  } catch {
    return NextResponse.json({ points: [], changePct: 0 }, { status: 200 });
  }
}
