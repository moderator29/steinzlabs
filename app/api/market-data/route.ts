import { NextResponse } from 'next/server';
import { cmcConfigured, cmcTopListings } from '@/lib/services/coinmarketcap';

// ISR — edge cache for 5 minutes
export const revalidate = 300;

// category: actual CoinGecko category slug (see /coins/categories/list).
// Pass-through to their API so tabs like defi/ai/meme/depin/stocks
// return chain-specific sets instead of the generic market_cap list.
async function fromCoinGecko(limit: number, category?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  const catParam = category && category !== 'top' ? `&category=${encodeURIComponent(category)}` : '';
  // Audit M1 #9 — table renders a "1H%" column header but the API
  // never returned the 1h field, so the cell stayed empty. Now we
  // ask CoinGecko for the 1h percentage too (free tier supports it).
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h,24h,7d${catParam}`,
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

// Fallback when CoinGecko is rate-limited/down. Was CoinCap v2
// (api.coincap.io/v2) — deprecated and now key-gated, so the fallback itself
// always failed. CoinPaprika is free, keyless, ranks by market cap, and
// exposes 1h/24h/7d changes, so the table degrades gracefully with real data.
async function fromCoinPaprika(limit: number) {
  const res = await fetch(
    `https://api.coinpaprika.com/v1/tickers?limit=${limit}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`CoinPaprika ${res.status}`);
  const data = await res.json();
  return (data as any[]).slice(0, limit).map((c) => {
    const usd = c.quotes?.USD ?? {};
    return {
      id:                             c.id,
      symbol:                         c.symbol?.toUpperCase() ?? '',
      name:                           c.name ?? '',
      current_price:                  usd.price ?? 0,
      price_change_percentage_1h_in_currency:  usd.percent_change_1h ?? null,
      price_change_percentage_24h:    usd.percent_change_24h ?? 0,
      price_change_percentage_7d_in_currency:  usd.percent_change_7d ?? 0,
      total_volume:                   usd.volume_24h ?? 0,
      market_cap:                     usd.market_cap ?? 0,
      market_cap_rank:                c.rank ?? null,
      sparkline_in_7d:                { price: [] },
      image: '',
    };
  });
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
    // Neither CMC nor CoinPaprika has a category filter, so for a category
    // request we'd rather return empty than the wrong set — only the
    // unfiltered top list has fallbacks.
    if (cgCategory) {
      return NextResponse.json(
        { tokens: [], category, total: 0, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } }
      );
    }
    // Tier 2: CoinMarketCap (env-gated, authoritative, credit-cheap — 1 cached
    // call). Tier 3: CoinPaprika (keyless). Two independent sources behind
    // CoinGecko so the market table stays live through an upstream outage.
    try {
      const cmc = cmcConfigured() ? await cmcTopListings(limit) : [];
      coins = cmc.length > 0 ? cmc : await fromCoinPaprika(limit);
    } catch {
      try {
        coins = await fromCoinPaprika(limit);
      } catch {
        return NextResponse.json(
          { tokens: [], category, total: 0, timestamp: new Date().toISOString() },
          { headers: { 'Cache-Control': 'public, s-maxage=60' } }
        );
      }
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
    // Audit M1 #9 — surface 1h. Falls back to null when CoinCap is
    // the upstream (CoinCap doesn't expose 1h), so the UI can render
    // a dash instead of a fabricated 0%.
    change1h: coin.price_change_percentage_1h_in_currency ?? null,
    change24h: coin.price_change_percentage_24h ?? 0,
    change7d:  coin.price_change_percentage_7d_in_currency ?? 0,
    volume24h: coin.total_volume ?? 0,
    marketCap: coin.market_cap ?? 0,
    rank:      coin.market_cap_rank ?? null,
    sparkline: coin.sparkline_in_7d?.price ?? [],
    image:     coin.image ?? '',
  }));

  return NextResponse.json(
    { tokens, category, total: tokens.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
  );
}
