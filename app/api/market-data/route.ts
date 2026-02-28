import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'trending';
    const limit = parseInt(searchParams.get('limit') || '50');

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || ''
        },
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) throw new Error('CoinGecko API failed');

    const coins = await response.json();
    let filtered = coins;

    if (category === 'gainers') {
      filtered = coins.filter((c: any) => c.price_change_percentage_24h > 0).sort((a: any, b: any) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    } else if (category === 'losers') {
      filtered = coins.filter((c: any) => c.price_change_percentage_24h < 0).sort((a: any, b: any) => a.price_change_percentage_24h - b.price_change_percentage_24h);
    }

    const tokens = filtered.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      change7d: coin.price_change_percentage_7d_in_currency,
      volume24h: coin.total_volume,
      marketCap: coin.market_cap,
      sparkline: coin.sparkline_in_7d?.price || [],
      image: coin.image
    }));

    return NextResponse.json({ tokens, category, total: tokens.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Market data error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
