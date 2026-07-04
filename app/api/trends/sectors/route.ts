import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Narrative Radar — sector rotation. Which crypto NARRATIVES (AI, memes, DeFi,
 * gaming, RWA, DePIN…) capital is rotating into vs out of over 24h. Real data
 * from CoinGecko's /coins/categories (free, no key): per-category market cap,
 * 24h market-cap change, volume, and the top coins. No fabricated numbers.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CgCategory {
  id: string; name: string;
  market_cap: number | null; market_cap_change_24h: number | null;
  volume_24h: number | null; top_3_coins: string[] | null;
  updated_at?: string;
}

export async function GET() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/categories?order=market_cap_desc', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ sectors: [], source: 'coingecko', error: `HTTP ${res.status}` }, { status: 200 });
    const rows = (await res.json()) as CgCategory[];

    const sectors = (Array.isArray(rows) ? rows : [])
      .filter((c) => (c.market_cap ?? 0) > 5_000_000 && c.market_cap_change_24h != null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        marketCap: Number(c.market_cap ?? 0),
        change24h: Number(c.market_cap_change_24h ?? 0),
        volume24h: Number(c.volume_24h ?? 0),
        topCoins: (c.top_3_coins ?? []).filter(Boolean).slice(0, 3),
      }))
      .sort((a, b) => b.change24h - a.change24h);

    // Split into rotation-in (top gainers) and rotation-out (top losers).
    const rotatingIn = sectors.slice(0, 12);
    const rotatingOut = [...sectors].sort((a, b) => a.change24h - b.change24h).slice(0, 8);

    return NextResponse.json({
      source: 'coingecko',
      total: sectors.length,
      rotatingIn,
      rotatingOut,
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ sectors: [], source: 'coingecko', error: 'fetch_failed' }, { status: 200 });
  }
}
