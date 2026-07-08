import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Narrative Radar — sector rotation. Which crypto NARRATIVES (AI, memes, DeFi,
 * gaming, RWA, DePIN…) capital is rotating into vs out of over 24h. Real data
 * from CoinGecko's /coins/categories (free, no key required): per-category
 * market cap, 24h market-cap change, volume, and the top coins. No fabricated
 * numbers — every ranking is justified by the real metric shown beside it.
 *
 * Ranking is by real 24h market-cap change. Each row also carries a real
 * turnover ratio (24h volume ÷ market cap) so the UI can distinguish genuine
 * capital rotation (a move backed by trading) from a thin, illiquid mcap blip.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CgCategory {
  id: string; name: string;
  market_cap: number | null; market_cap_change_24h: number | null;
  volume_24h: number | null; top_3_coins: string[] | null;
  updated_at?: string;
}

interface Sector {
  id: string; name: string;
  marketCap: number; change24h: number; volume24h: number;
  turnover: number;            // 24h volume ÷ market cap (real liquidity signal)
  topCoins: string[];
}

// Mirror the shared CoinGecko key convention (demo key on the public base; pro
// key on the pro base) so this route benefits from the account's rate limit and
// degrades to the unauthenticated public endpoint on 429 rather than failing.
const CG_KEY = process.env.COINGECKO_API_KEY || '';
const CG_PLAN = (process.env.COINGECKO_PLAN || 'demo').toLowerCase();
const CG_PUBLIC = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';

async function fetchCategories(): Promise<CgCategory[] | null> {
  const path = '/coins/categories?order=market_cap_desc';
  const base = CG_KEY && CG_PLAN === 'pro' ? CG_PRO : CG_PUBLIC;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (CG_KEY) headers[CG_PLAN === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = CG_KEY;

  let res = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(9000), next: { revalidate: 300 } });
  // On 429 (or any non-OK with an authed call), retry once unauthenticated on
  // the public base so a credit blowout degrades instead of going dark.
  if (!res.ok && base !== CG_PUBLIC) {
    res = await fetch(`${CG_PUBLIC}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9000), next: { revalidate: 300 } });
  }
  if (!res.ok) return null;
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? (rows as CgCategory[]) : [];
}

export async function GET() {
  try {
    const rows = await fetchCategories();
    if (rows === null) return NextResponse.json({ sectors: [], rotatingIn: [], rotatingOut: [], total: 0, source: 'coingecko', error: 'upstream_unavailable' }, { status: 200 });

    const sectors: Sector[] = rows
      // Real, tradeable narratives only: a meaningful market cap AND a real 24h
      // change AND actual trading volume. Dropping zero-volume categories stops
      // a stale, illiquid mcap blip from being ranked as "rotation".
      .filter((c) => (c.market_cap ?? 0) > 5_000_000 && c.market_cap_change_24h != null && (c.volume_24h ?? 0) > 0)
      .map((c) => {
        const marketCap = Number(c.market_cap ?? 0);
        const volume24h = Number(c.volume_24h ?? 0);
        return {
          id: c.id,
          name: c.name,
          marketCap,
          change24h: Number(c.market_cap_change_24h ?? 0),
          volume24h,
          turnover: marketCap > 0 ? Math.round((volume24h / marketCap) * 1000) / 1000 : 0,
          topCoins: (c.top_3_coins ?? []).filter(Boolean).slice(0, 3),
        };
      })
      .sort((a, b) => b.change24h - a.change24h);

    // Split into rotation-in (top gainers) and rotation-out (top losers), each
    // ranked by the real 24h market-cap move that justifies its placement.
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
    return NextResponse.json({ sectors: [], rotatingIn: [], rotatingOut: [], total: 0, source: 'coingecko', error: 'fetch_failed' }, { status: 200 });
  }
}
