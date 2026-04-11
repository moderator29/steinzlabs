import { NextResponse } from 'next/server';

// In-memory cache — shared across warm serverless instances
let cachedTokens: any[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function fetchCoinGecko(): Promise<any[]> {
  const url =
    'https://api.coingecko.com/api/v3/coins/markets' +
    '?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h';

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
  } as RequestInit);

  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const coins: any[] = await res.json();

  return coins.map((c: any, i: number) => ({
    id: c.id,
    symbol: (c.symbol || '').toUpperCase(),
    name: c.name || c.symbol,
    image: c.image || '',
    price: c.current_price ?? 0,
    change24h: c.price_change_percentage_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.total_volume ?? 0,
    rank: c.market_cap_rank ?? (i + 1),
    fdv: c.fully_diluted_valuation ?? 0,
    ath: c.ath ?? 0,
    athChangePercent: c.ath_change_percentage ?? 0,
    circulatingSupply: c.circulating_supply ?? 0,
    totalSupply: c.total_supply ?? 0,
  }));
}

function applyCategory(tokens: any[], category: string, limit: number): any[] {
  if (category === 'gainers') return [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, limit);
  if (category === 'losers') return [...tokens].sort((a, b) => a.change24h - b.change24h).slice(0, limit);
  return tokens.slice(0, limit);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'top';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 250);

    // Serve from cache if still fresh
    if (cachedTokens && Date.now() - cacheTs < CACHE_TTL) {
      const tokens = applyCategory(cachedTokens, category, limit);
      return NextResponse.json(
        { tokens, category, total: tokens.length, cached: true, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
      );
    }

    const tokens = await fetchCoinGecko();
    cachedTokens = tokens;
    cacheTs = Date.now();

    const result = applyCategory(tokens, category, limit);
    return NextResponse.json(
      { tokens: result, category, total: result.length, cached: false, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { tokens: [], category: 'top', total: 0, error: err.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
