import { NextResponse } from 'next/server';
import { getTopTokens, COINGECKO_CATEGORY_MAP, type CoinGeckoMarketToken } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// CoinCap fallback — free, no key, no rate limit issues. Used only if the
// unified CoinGecko service throws (rate-limited / outage / cold-start).
async function fetchCoinCap(limit: number): Promise<CoinGeckoMarketToken[]> {
  const res = await fetch(
    `https://api.coincap.io/v2/assets?limit=${limit}`,
    { signal: AbortSignal.timeout(6000), next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error('CoinCap failed');
  const { data } = await res.json() as { data: any[] };
  return data.map((c) => ({
    id:                               c.id,
    symbol:                           c.symbol?.toUpperCase() ?? '',
    name:                             c.name ?? '',
    image:                            `https://assets.coincap.io/assets/icons/${c.symbol?.toLowerCase()}@2x.png`,
    current_price:                    parseFloat(c.priceUsd) || 0,
    market_cap:                       parseFloat(c.marketCapUsd) || 0,
    market_cap_rank:                  parseInt(c.rank) || 0,
    fully_diluted_valuation:          null,
    total_volume:                     parseFloat(c.volumeUsd24Hr) || 0,
    high_24h:                         0,
    low_24h:                          0,
    price_change_24h:                 0,
    price_change_percentage_24h:      parseFloat(c.changePercent24Hr) || 0,
    market_cap_change_24h:            0,
    market_cap_change_percentage_24h: 0,
    circulating_supply:               parseFloat(c.supply) || 0,
    total_supply:                     parseFloat(c.maxSupply) || null,
    max_supply:                       parseFloat(c.maxSupply) || null,
    ath: 0, ath_change_percentage: 0, ath_date: '',
    atl: 0, atl_change_percentage: 0, atl_date: '',
    last_updated: new Date().toISOString(),
  }));
}

async function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page     = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const category = searchParams.get('category') ?? 'all';

  // Majors = top 200 by market cap (per product spec). Other categories use
  // 100 per page which is CoinGecko's standard for the /coins/markets endpoint.
  const perPage = category === 'majors' ? 200 : 100;
  const cgCategory = COINGECKO_CATEGORY_MAP[category] ?? null;

  // Hard 8s deadline so the dashboard never blocks waiting for upstream.
  try {
    const tokens = await withDeadline<CoinGeckoMarketToken[]>(
      getTopTokens(page, perPage, true, cgCategory ?? undefined),
      8000,
      [],
    );
    if (tokens.length > 0) {
      return NextResponse.json(tokens, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }
    // Empty CG result on majors/all? Try CoinCap so the page never goes blank.
    if (category === 'all' || category === 'majors') {
      const cc = await withDeadline<CoinGeckoMarketToken[]>(fetchCoinCap(perPage), 6000, []);
      return NextResponse.json(cc, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch (err) {
    console.error('[market/prices]', err);
    // Last-resort: CoinCap, then [].
    if (category === 'all' || category === 'majors') {
      try {
        const cc = await withDeadline<CoinGeckoMarketToken[]>(fetchCoinCap(perPage), 6000, []);
        return NextResponse.json(cc, { status: 200 });
      } catch { /* fall through */ }
    }
    return NextResponse.json([], { status: 502 });
  }
}
