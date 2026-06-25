import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { RecentTrade, OrderBookData } from '@/lib/market/types';
import { getPoolTrades } from '@/lib/services/geckoTrades';

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

    // Honest buy/sell ratio: only report it when DexScreener actually returns
    // 24h txn counts. The old code defaulted missing data to 50/50, fabricating
    // a balanced market that never existed. No data → null, not a fake split.
    const buys = p.txns?.h24?.buys;
    const sells = p.txns?.h24?.sells;
    const hasFlow = typeof buys === 'number' && typeof sells === 'number' && buys + sells > 0;
    const orderBook: OrderBookData | null = hasFlow
      ? {
          buyersPercent: Math.round((buys! / (buys! + sells!)) * 100),
          sellersPercent: Math.round((sells! / (buys! + sells!)) * 100),
          buyCount: buys!,
          sellCount: sells!,
        }
      : null;

    // Recent trades: DexScreener's free API exposes only aggregate hourly
    // counts, not individual swaps. We pull the REAL per-trade tape from
    // GeckoTerminal's pool /trades endpoint (real tx hashes + maker
    // addresses, EVM + Solana). Falls back to an empty array — never
    // fabricated data — if the pool/network isn't on GeckoTerminal.
    const trades: RecentTrade[] = await getPoolTrades(chain, pair);

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
