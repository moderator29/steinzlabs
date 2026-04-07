import { NextResponse } from 'next/server';

async function fetchCoinGecko(limit: number, category: string) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d`,
    {
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
      next: { revalidate: 120 },
    }
  );
  if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
  const coins = await response.json();

  let filtered = coins;
  if (category === 'gainers') {
    filtered = coins.filter((c: any) => c.price_change_percentage_24h > 0)
      .sort((a: any, b: any) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  } else if (category === 'losers') {
    filtered = coins.filter((c: any) => c.price_change_percentage_24h < 0)
      .sort((a: any, b: any) => a.price_change_percentage_24h - b.price_change_percentage_24h);
  }

  return filtered.map((coin: any) => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h,
    change7d: coin.price_change_percentage_7d_in_currency,
    volume24h: coin.total_volume,
    marketCap: coin.market_cap,
    rank: coin.market_cap_rank,
    sparkline: coin.sparkline_in_7d?.price || [],
    image: coin.image,
  }));
}

async function fetchDexScreenerFallback() {
  // Fetch top boosted tokens from DexScreener as fallback
  const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error('DexScreener fallback failed');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid DexScreener response');

  // Also try trending search for major tokens
  const trending = await fetch('https://api.dexscreener.com/latest/dex/search?q=ETH', {
    next: { revalidate: 60 },
  }).then(r => r.json()).catch(() => ({ pairs: [] }));

  const pairs = trending.pairs || [];
  const seen = new Set<string>();
  const tokens = pairs.slice(0, 100).map((p: any, i: number) => {
    const symbol = p.baseToken?.symbol?.toUpperCase() || '';
    if (!symbol || seen.has(symbol)) return null;
    seen.add(symbol);
    return {
      id: p.baseToken?.address || symbol.toLowerCase(),
      symbol,
      name: p.baseToken?.name || symbol,
      price: parseFloat(p.priceUsd || '0'),
      change24h: p.priceChange?.h24 || 0,
      change7d: 0,
      volume24h: p.volume?.h24 || 0,
      marketCap: p.fdv || p.marketCap || 0,
      rank: i + 1,
      sparkline: [],
      image: p.info?.imageUrl || '',
    };
  }).filter(Boolean);

  return tokens;
}

// Hard-coded top coins as last resort (with live price from a free endpoint)
async function fetchTopCoinsFallback() {
  const TOP_COINS = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', rank: 2 },
    { id: 'tether', symbol: 'USDT', name: 'Tether', rank: 3 },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', rank: 4 },
    { id: 'solana', symbol: 'SOL', name: 'Solana', rank: 5 },
    { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', rank: 6 },
    { id: 'xrp', symbol: 'XRP', name: 'XRP', rank: 7 },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', rank: 8 },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', rank: 9 },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', rank: 10 },
  ];

  try {
    const ids = TOP_COINS.map(c => c.id).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error('simple/price failed');
    const prices = await res.json();

    return TOP_COINS.map(c => {
      const p = prices[c.id] || {};
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        price: p.usd || 0,
        change24h: p.usd_24h_change || 0,
        change7d: 0,
        volume24h: p.usd_24h_vol || 0,
        marketCap: p.usd_market_cap || 0,
        rank: c.rank,
        sparkline: [],
        image: `https://assets.coingecko.com/coins/images/${c.rank === 1 ? '1/small/bitcoin.png' : c.rank === 2 ? '279/small/ethereum.png' : ''}`,
      };
    });
  } catch {
    return TOP_COINS.map((c, i) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      price: 0,
      change24h: 0,
      change7d: 0,
      volume24h: 0,
      marketCap: 0,
      rank: c.rank,
      sparkline: [],
      image: '',
    }));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'trending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 250);

    let tokens: any[] = [];

    // Try CoinGecko first
    try {
      tokens = await fetchCoinGecko(limit, category);
    } catch (cgErr) {
      console.error('CoinGecko failed, trying DexScreener:', cgErr);

      // Try DexScreener fallback
      try {
        tokens = await fetchDexScreenerFallback();
      } catch (dexErr) {
        console.error('DexScreener fallback failed, using static fallback:', dexErr);

        // Last resort: top 10 coins with simple price endpoint
        tokens = await fetchTopCoinsFallback();
      }
    }

    return NextResponse.json({
      tokens,
      category,
      total: tokens.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market data error:', error);
    // Always return 200 with empty array — never 500
    return NextResponse.json({ tokens: [], category: 'top', total: 0, timestamp: new Date().toISOString() });
  }
}
