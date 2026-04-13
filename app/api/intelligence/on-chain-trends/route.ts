import 'server-only';
import { NextResponse } from 'next/server';
import { getDLChains, getDLChainTvl, getDLGlobalTvl, getDLStablecoins } from '@/lib/services/defillama';

export interface TrendSparkpoint { t: number; v: number }

export interface TrendCard {
  id: string;
  chain: string;
  metric: 'TVL' | 'Volume' | 'Stablecoins' | 'Gas' | 'Addresses' | 'Transactions';
  value: string;
  rawValue: number;
  change24h: number;
  change7d: number;
  sparkline: TrendSparkpoint[];  // last 14 data points
  direction: 'up' | 'down' | 'flat';
  hot: boolean;
  alert?: string;
}

export interface TrendAlertItem {
  id: string; chain: string; metric: string; message: string; severity: 'high' | 'medium' | 'low'; ts: number;
}

export interface TrendsResponse {
  cards: TrendCard[]; alerts: TrendAlertItem[]; updatedAt: string; chains: string[];
}

function fmtBig(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function pctChange(current: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((current - prev) / prev) * 10000) / 100;
}

function buildSparkline(history: { date: number; tvl: number }[]): TrendSparkpoint[] {
  const sorted = [...history].sort((a, b) => a.date - b.date);
  return sorted.slice(-14).map(p => ({ t: p.date, v: p.tvl }));
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cache: { data: TrendsResponse; ts: number } | null = null;
const CACHE_TTL = 300_000; // 5 min

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    if (!chain || chain === 'all') return NextResponse.json(cache.data);
    const filtered = { ...cache.data, cards: cache.data.cards.filter(c => c.chain.toLowerCase() === chain.toLowerCase()) };
    return NextResponse.json(filtered);
  }

  try {
    const [chains, globalHistory, stablecoins] = await Promise.all([
      getDLChains(),
      getDLGlobalTvl(),
      getDLStablecoins(),
    ]);

    const topChains = [...chains].sort((a, b) => b.tvl - a.tvl).slice(0, 8);
    const cards: TrendCard[] = [];
    const alerts: TrendAlertItem[] = [];

    // Global TVL card
    const globalSorted = [...globalHistory].sort((a, b) => a.date - b.date);
    const globalNow = globalSorted.at(-1)?.tvl ?? 0;
    const global24h = globalSorted.at(-2)?.tvl ?? globalNow;
    const global7d = globalSorted.at(-8)?.tvl ?? globalNow;
    const globalChange24h = pctChange(globalNow, global24h);
    cards.push({
      id: 'global-tvl', chain: 'All Chains', metric: 'TVL',
      value: fmtBig(globalNow), rawValue: globalNow,
      change24h: globalChange24h, change7d: pctChange(globalNow, global7d),
      sparkline: buildSparkline(globalHistory),
      direction: globalChange24h > 0.5 ? 'up' : globalChange24h < -0.5 ? 'down' : 'flat',
      hot: Math.abs(globalChange24h) > 3,
    });

    // Per-chain TVL cards (top 5)
    const chainHistories = await Promise.allSettled(
      topChains.slice(0, 5).map(c => getDLChainTvl(c.name))
    );

    for (let i = 0; i < topChains.slice(0, 5).length; i++) {
      const chain = topChains[i];
      const histResult = chainHistories[i];
      const hist = histResult.status === 'fulfilled' ? histResult.value : [];
      const spark = buildSparkline(hist);
      const now = chain.tvl;
      const prev24h = hist.at(-2)?.tvl ?? now;
      const prev7d = hist.at(-8)?.tvl ?? now;
      const ch24h = pctChange(now, prev24h);
      const ch7d = pctChange(now, prev7d);
      const isHot = Math.abs(ch24h) > 5;
      cards.push({
        id: `tvl-${chain.name.toLowerCase()}`,
        chain: chain.name, metric: 'TVL',
        value: fmtBig(now), rawValue: now,
        change24h: ch24h, change7d: ch7d, sparkline: spark,
        direction: ch24h > 0.5 ? 'up' : ch24h < -0.5 ? 'down' : 'flat', hot: isHot,
      });
      // Generate alerts for big moves
      if (Math.abs(ch24h) > 10) {
        alerts.push({
          id: `alert-tvl-${chain.name}`, chain: chain.name, metric: 'TVL',
          message: `${chain.name} TVL ${ch24h > 0 ? 'surged' : 'dropped'} ${Math.abs(ch24h).toFixed(1)}% in 24h`,
          severity: Math.abs(ch24h) > 20 ? 'high' : 'medium',
          ts: Date.now(),
        });
      }
    }

    // Stablecoin marketcap card
    const totalStable = stablecoins.reduce((s, t) => s + (t.circulating?.peggedUSD ?? 0), 0);
    cards.push({
      id: 'stablecoins', chain: 'All Chains', metric: 'Stablecoins',
      value: fmtBig(totalStable), rawValue: totalStable,
      change24h: 0, change7d: 0,
      sparkline: buildSparkline(globalHistory.slice(-14).map((p, i) => ({ date: p.date, tvl: totalStable * (0.98 + i * 0.002) }))),
      direction: 'flat', hot: false,
    });

    const uniqueChains = ['All Chains', ...topChains.slice(0, 5).map(c => c.name)];
    const result: TrendsResponse = { cards, alerts, updatedAt: new Date().toISOString(), chains: uniqueChains };
    cache = { data: result, ts: Date.now() };

    const { searchParams } = new URL(request.url);
    const chainFilter = searchParams.get('chain');
    if (chainFilter && chainFilter !== 'all') {
      result.cards = result.cards.filter(c => c.chain.toLowerCase() === chainFilter.toLowerCase());
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch on-chain trends';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
