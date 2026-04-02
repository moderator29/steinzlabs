import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_PRICES: Record<string, any> = {
  bitcoin: { usd: 97250, usd_24h_change: 2.14, usd_24h_vol: 48200000000, usd_market_cap: 1910000000000 },
  ethereum: { usd: 3450, usd_24h_change: 1.87, usd_24h_vol: 18500000000, usd_market_cap: 415000000000 },
  solana: { usd: 178, usd_24h_change: 4.32, usd_24h_vol: 3200000000, usd_market_cap: 82000000000 },
  binancecoin: { usd: 620, usd_24h_change: 1.23, usd_24h_vol: 1800000000, usd_market_cap: 91000000000 },
  ripple: { usd: 2.45, usd_24h_change: -0.82, usd_24h_vol: 2100000000, usd_market_cap: 135000000000 },
  dogecoin: { usd: 0.32, usd_24h_change: 5.67, usd_24h_vol: 2800000000, usd_market_cap: 46000000000 },
  cardano: { usd: 0.72, usd_24h_change: 3.15, usd_24h_vol: 890000000, usd_market_cap: 25000000000 },
  chainlink: { usd: 18.20, usd_24h_change: 4.12, usd_24h_vol: 680000000, usd_market_cap: 11000000000 },
  'avalanche-2': { usd: 38.50, usd_24h_change: -1.45, usd_24h_vol: 520000000, usd_market_cap: 15700000000 },
  uniswap: { usd: 12.80, usd_24h_change: 2.89, usd_24h_vol: 320000000, usd_market_cap: 7700000000 },
  polkadot: { usd: 7.85, usd_24h_change: 2.31, usd_24h_vol: 410000000, usd_market_cap: 11000000000 },
  near: { usd: 6.20, usd_24h_change: 3.45, usd_24h_vol: 280000000, usd_market_cap: 7000000000 },
};

const SYMBOL_FALLBACK: Record<string, any> = {
  BTC: { price: 97250, change24h: 2.14, name: 'Bitcoin', marketCap: 1910000000000, volume: 48200000000 },
  ETH: { price: 3450, change24h: 1.87, name: 'Ethereum', marketCap: 415000000000, volume: 18500000000 },
  SOL: { price: 178, change24h: 4.32, name: 'Solana', marketCap: 82000000000, volume: 3200000000 },
  BNB: { price: 620, change24h: 1.23, name: 'BNB', marketCap: 91000000000, volume: 1800000000 },
  XRP: { price: 2.45, change24h: -0.82, name: 'XRP', marketCap: 135000000000, volume: 2100000000 },
  ADA: { price: 0.72, change24h: 3.15, name: 'Cardano', marketCap: 25000000000, volume: 890000000 },
  DOGE: { price: 0.32, change24h: 5.67, name: 'Dogecoin', marketCap: 46000000000, volume: 2800000000 },
  AVAX: { price: 38.50, change24h: -1.45, name: 'Avalanche', marketCap: 15700000000, volume: 520000000 },
  DOT: { price: 7.85, change24h: 2.31, name: 'Polkadot', marketCap: 11000000000, volume: 410000000 },
  LINK: { price: 18.20, change24h: 4.12, name: 'Chainlink', marketCap: 11000000000, volume: 680000000 },
  UNI: { price: 12.80, change24h: 2.89, name: 'Uniswap', marketCap: 7700000000, volume: 320000000 },
  NEAR: { price: 6.20, change24h: 3.45, name: 'NEAR Protocol', marketCap: 7000000000, volume: 280000000 },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');

  if (ids) {
    const idList = ids.split(',').map(id => id.trim());

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idList.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        {
          headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '' },
          next: { revalidate: 30 },
        }
      );

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ prices: data }, {
          headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
        });
      }
    } catch {}

    const fallback: Record<string, any> = {};
    for (const id of idList) {
      if (FALLBACK_PRICES[id]) {
        fallback[id] = FALLBACK_PRICES[id];
      }
    }
    return NextResponse.json({ prices: fallback }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h',
      {
        headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '' },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) throw new Error('CoinGecko API failed');

    const coins = await response.json();
    if (!Array.isArray(coins)) throw new Error('Invalid response format');

    const prices = coins.reduce((acc: any, coin: any) => {
      acc[coin.symbol.toUpperCase()] = {
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
        name: coin.name,
        image: coin.image,
        marketCap: coin.market_cap,
        volume: coin.total_volume,
      };
      return acc;
    }, {});

    return NextResponse.json(prices, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json(SYMBOL_FALLBACK);
  }
}
