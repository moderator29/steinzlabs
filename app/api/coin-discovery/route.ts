import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h',
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || ''
        },
        next: { revalidate: 120 }
      }
    );

    if (!response.ok) {
      throw new Error('CoinGecko API failed');
    }

    const coins = await response.json();

    if (!Array.isArray(coins)) {
      throw new Error('Invalid response');
    }

    return NextResponse.json({
      coins: coins.map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: c.price_change_percentage_24h || 0,
        marketCap: c.market_cap,
        volume: c.total_volume,
        image: c.image,
        rank: c.market_cap_rank,
        high24h: c.high_24h,
        low24h: c.low_24h,
        ath: c.ath,
        athChangePercentage: c.ath_change_percentage,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Coin discovery error:', error);
    return NextResponse.json({ error: 'Failed to fetch coins' }, { status: 500 });
  }
}
