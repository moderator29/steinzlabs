import 'server-only';
import { NextResponse } from 'next/server';
import { getSwapTrades, getGaslessTrades } from '@/lib/services/zerox';

export const revalidate = 900; // ISR: revalidate every 15 minutes

export async function GET() {
  try {
    const [swapTrades, gaslessTrades] = await Promise.allSettled([
      getSwapTrades(),
      getGaslessTrades(),
    ]);

    const swaps = swapTrades.status === 'fulfilled' ? swapTrades.value : [];
    const gasless = gaslessTrades.status === 'fulfilled' ? gaslessTrades.value : [];
    const allTrades = [...swaps, ...gasless];

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Volume calculations
    let totalVolumeUsd = 0;
    let volume24h = 0;
    let volume7d = 0;
    let volume30d = 0;
    const pairCounts: Record<string, number> = {};
    const chainVolumes: Record<number, number> = {};

    for (const trade of allTrades) {
      const sellUsd = parseFloat(trade.sellToken?.amountUsd || '0');
      const tradeTime = new Date(trade.timestamp).getTime();
      const age = now - tradeTime;

      totalVolumeUsd += sellUsd;
      if (age < day) volume24h += sellUsd;
      if (age < 7 * day) volume7d += sellUsd;
      if (age < 30 * day) volume30d += sellUsd;

      const pair = `${trade.sellToken?.symbol || '?'}/${trade.buyToken?.symbol || '?'}`;
      pairCounts[pair] = (pairCounts[pair] || 0) + 1;

      const cid = trade.chainId || 1;
      chainVolumes[cid] = (chainVolumes[cid] || 0) + sellUsd;
    }

    // Top 5 pairs
    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }));

    // Recent trades (anonymized)
    const recentTrades = allTrades
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(t => ({
        pair: `${t.sellToken?.symbol || '?'}/${t.buyToken?.symbol || '?'}`,
        amountUsd: parseFloat(t.sellToken?.amountUsd || '0'),
        wallet: t.taker ? `${t.taker.slice(0, 4)}...${t.taker.slice(-4)}` : '???',
        timestamp: t.timestamp,
        chainId: t.chainId,
      }));

    return NextResponse.json({
      totalTrades: allTrades.length,
      totalVolumeUsd,
      volume24h,
      volume7d,
      volume30d,
      topPairs,
      chainVolumes,
      recentTrades,
      gaslessRatio: allTrades.length > 0 ? gasless.length / allTrades.length : 0,
      standardCount: swaps.length,
      gaslessCount: gasless.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analytics fetch failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
