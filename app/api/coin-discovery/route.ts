import 'server-only';
import { NextResponse } from 'next/server';
import { getTopTokens } from '@/lib/services/coingecko';

export async function GET() {
  try {
    const coins = await getTopTokens(50);

    return NextResponse.json({
      coins: coins.map(c => ({
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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch coins' }, { status: 500 });
  }
}
