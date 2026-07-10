import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Sector Rotation — GET /api/market/sectors
 *
 * Real category/sector performance derived from CoinGecko's category
 * markets. For each sector we pull the top coins by market cap and compute
 * a MARKET-CAP-WEIGHTED average 24h change (so the barometer reflects how
 * the sector's capital actually moved, not an unweighted mean skewed by
 * long-tail micro-caps).
 *
 * Sector → CoinGecko category slug uses the same verified slugs the token
 * list already relies on (see MarketDashboard CAT_API_MAP / the
 * /coins/categories/list endpoint). No invented or paid source — this is
 * the same free CoinGecko markets endpoint the market table uses, just
 * aggregated per category and cached at the edge.
 *
 * Response:
 *   { available: true, asOf, sectors: [{ id, label, change24h, avg7d, topMovers, coins }] }
 *   { available: false, reason }  ← when every upstream category fetch fails
 */

export const revalidate = 300; // 5-min edge cache — cheap on CoinGecko's demo tier.

interface SectorDef {
  id: string;
  label: string;
  slug: string; // CoinGecko category slug
}

// Ordered by how the market usually reads a rotation strip: majors → risk.
const SECTORS: SectorDef[] = [
  { id: 'layer1', label: 'Layer 1', slug: 'layer-1' },
  { id: 'layer2', label: 'Layer 2', slug: 'layer-2' },
  { id: 'defi', label: 'DeFi', slug: 'decentralized-finance-defi' },
  { id: 'ai', label: 'AI', slug: 'artificial-intelligence' },
  { id: 'meme', label: 'Memes', slug: 'meme-token' },
  { id: 'rwa', label: 'RWA', slug: 'real-world-assets-rwa' },
  { id: 'depin', label: 'DePIN', slug: 'depin' },
  { id: 'gaming', label: 'Gaming', slug: 'gaming' },
];

interface CoinMarket {
  symbol?: string;
  name?: string;
  market_cap?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

interface Mover {
  symbol: string;
  change24h: number;
}

interface SectorResult {
  id: string;
  label: string;
  /** Market-cap-weighted average 24h change across the sector's top coins. */
  change24h: number;
  /** Market-cap-weighted average 7d change (null when upstream omits it). */
  avg7d: number | null;
  /** Number of coins the average is computed from. */
  coins: number;
  /** Combined market cap of the sampled coins. */
  marketCap: number;
  /** Best + worst single mover, for a compact "leaders" hint. */
  topMovers: Mover[];
}

async function fetchSector(def: SectorDef): Promise<SectorResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=24h,7d&category=${encodeURIComponent(def.slug)}`,
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        signal: controller.signal,
        next: { revalidate: 300 },
      } as RequestInit,
    );
    if (!res.ok) return null;
    const coins = (await res.json()) as CoinMarket[];
    if (!Array.isArray(coins) || coins.length === 0) return null;

    let weighted24 = 0;
    let weighted7 = 0;
    let weight7 = 0;
    let totalMcap = 0;
    const movers: Mover[] = [];

    for (const c of coins) {
      const mcap = Number(c.market_cap) || 0;
      const ch24 =
        c.price_change_percentage_24h_in_currency ??
        c.price_change_percentage_24h;
      if (mcap <= 0 || ch24 == null || !Number.isFinite(ch24)) continue;
      totalMcap += mcap;
      weighted24 += ch24 * mcap;
      const ch7 = c.price_change_percentage_7d_in_currency;
      if (ch7 != null && Number.isFinite(ch7)) {
        weighted7 += ch7 * mcap;
        weight7 += mcap;
      }
      if (c.symbol) movers.push({ symbol: c.symbol.toUpperCase(), change24h: ch24 });
    }

    if (totalMcap <= 0 || movers.length === 0) return null;

    movers.sort((a, b) => b.change24h - a.change24h);
    const topMovers: Mover[] = [];
    if (movers.length > 0) topMovers.push(movers[0]);
    if (movers.length > 1) topMovers.push(movers[movers.length - 1]);

    return {
      id: def.id,
      label: def.label,
      change24h: weighted24 / totalMcap,
      avg7d: weight7 > 0 ? weighted7 / weight7 : null,
      coins: movers.length,
      marketCap: totalMcap,
      topMovers,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const settled = await Promise.all(SECTORS.map(fetchSector));
  const sectors = settled.filter((s): s is SectorResult => s !== null);

  if (sectors.length === 0) {
    return NextResponse.json(
      { available: false, reason: 'Sector data source is temporarily unavailable.' },
      { headers: { 'Cache-Control': 'public, s-maxage=60' } },
    );
  }

  // Strongest sector first — that IS the rotation signal.
  sectors.sort((a, b) => b.change24h - a.change24h);

  return NextResponse.json(
    { available: true, asOf: new Date().toISOString(), sectors },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
}
