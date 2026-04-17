import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { RecentTrade, OrderBookData } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

interface DexPair {
  priceUsd?: string;
  priceNative?: string;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  liquidity?: { usd?: number };
  baseToken?: { symbol?: string; address?: string };
  chainId?: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pair: string }> }
) {
  const { pair } = await context.params;
  const chain = req.nextUrl.searchParams.get('chain') ?? 'ethereum';

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chain}/${pair}`,
      { next: { revalidate: 5 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Dexscreener unavailable' }, { status: res.status });
    }

    const data = await res.json() as { pair?: DexPair; pairs?: DexPair[] };
    const p = data.pair ?? data.pairs?.[0];
    if (!p) return NextResponse.json({ error: 'Pair not found' }, { status: 404 });

    const buys = p.txns?.h24?.buys ?? 50;
    const sells = p.txns?.h24?.sells ?? 50;
    const total = buys + sells || 1;

    const orderBook: OrderBookData = {
      buyersPercent: Math.round((buys / total) * 100),
      sellersPercent: Math.round((sells / total) * 100),
      buyCount: buys,
      sellCount: sells,
    };

    // Recent trades: derive from buy/sell ratio data — no fake values
    // DexScreener does not provide individual trade history via their free API.
    // We expose empty trades array rather than fabricating transaction data.
    const trades: RecentTrade[] = [];

    return NextResponse.json({
      priceUSD: parseFloat(p.priceUsd ?? '0'),
      volume24h: p.volume?.h24 ?? 0,
      priceChange24h: p.priceChange?.h24 ?? 0,
      liquidity: p.liquidity?.usd ?? 0,
      orderBook,
      recentTrades: trades,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
