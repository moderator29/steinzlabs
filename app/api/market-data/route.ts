import { NextResponse } from 'next/server';

// ISR — edge cache for 5 minutes
export const revalidate = 300;

// category: actual CoinGecko category slug (see /coins/categories/list).
// Pass-through to their API so tabs like defi/ai/meme/depin/stocks
// return chain-specific sets instead of the generic market_cap list.
async function fromCoinGecko(limit: number, category?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  const catParam = category && category !== 'top' ? `&category=${encodeURIComponent(category)}` : '';
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d${catParam}`,
    {
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
      signal: controller.signal,
      next:   { revalidate: 300 },
    } as RequestInit
  );
  clearTimeout(timer);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

async function fromCoinCap(limit: number) {
  const res = await fetch(
    `https://api.coincap.io/v2/assets?limit=${limit}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error('CoinCap failed');
  const { data } = await res.json();
  return (data as any[]).map((c) => ({
    id:                             c.id,
    symbol:                         c.symbol?.toUpperCase() ?? '',
    name:                           c.name ?? '',
    current_price:                  parseFloat(c.priceUsd) || 0,
    price_change_percentage_24h:    parseFloat(c.changePercent24Hr) || 0,
    price_change_percentage_7d_in_currency: 0,
    total_volume:                   parseFloat(c.volumeUsd24Hr) || 0,
    market_cap:                     parseFloat(c.marketCapUsd) || 0,
    sparkline_in_7d:                { price: [] },
    image: `https://assets.coincap.io/assets/icons/${c.symbol?.toLowerCase()}@2x.png`,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'top';
  const limit    = Math.min(parseInt(searchParams.get('limit') || '100'), 250);

  let coins: any[] = [];

  // gainers/losers are computed client-side from the top list — don't
  // pass those as CoinGecko categories (they'd 404). All other values
  // (defi, layer-1, artificial-intelligence, meme-token, depin, etc.)
  // are real CoinGecko category slugs.
  const cgCategory = (category === 'gainers' || category === 'losers' || category === 'top') ? undefined : category;

  try {
    coins = await fromCoinGecko(limit, cgCategory);
  } catch {
    try {
      coins = await fromCoinCap(limit);
    } catch {
      return NextResponse.json(
        { tokens: [], category, total: 0, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } }
      );
    }
  }

  let filtered = coins;
  if (category === 'gainers') {
    filtered = coins
      .filter((c) => (c.price_change_percentage_24h ?? 0) > 0)
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  } else if (category === 'losers') {
    filtered = coins
      .filter((c) => (c.price_change_percentage_24h ?? 0) < 0)
      .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
  }

  const tokens = filtered.map((coin) => ({
    id:       coin.id,
    symbol:   (coin.symbol ?? '').toUpperCase(),
    name:     coin.name ?? '',
    price:    coin.current_price ?? 0,
    change24h: coin.price_change_percentage_24h ?? 0,
    change7d:  coin.price_change_percentage_7d_in_currency ?? 0,
    volume24h: coin.total_volume ?? 0,
    marketCap: coin.market_cap ?? 0,
    sparkline: coin.sparkline_in_7d?.price ?? [],
    image:     coin.image ?? '',
  }));

  return NextResponse.json(
    { tokens, category, total: tokens.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
  );
}
