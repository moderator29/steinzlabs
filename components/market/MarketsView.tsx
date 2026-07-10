'use client';

import { Suspense, lazy, memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, TrendingDown, Zap,
} from 'lucide-react';
import { TopGainersCard } from '@/components/dashboard/TopGainersCard';
import { HeatingUpCard } from '@/components/dashboard/HeatingUpCard';
import MarketHeatmap from '@/components/market/MarketHeatmap';
import SectorStrip from '@/components/market/SectorStrip';

// The token list (search + categories + watchlist) is heavy, so it stays
// lazy — MarketsView renders on two surfaces (the dashboard Market sub-tab
// and the standalone /dashboard/market route) and we only want to pay for it
// once the markets front is actually shown.
// The RWA / TradFi (stocks) board used to render here too; it now lives on its
// own **Stocks** sub-tab (components/dashboard/StocksBoard) so this surface is
// CRYPTO-ONLY and the two asset classes no longer compete on one screen.
const MarketDashboard = lazy(() => import('@/components/MarketDashboard'));

interface MarketStats {
  totalMarketCap: string;
  totalVolume: string;
  btcDominance: string;
  marketCapChange: string;
  activeCoins: string;
}

// Clean, uniform stat cell — one glass primitive (nl-glass), one radius
// (rounded-xl) shared across the whole board so the strip reads as a system.
const StatCard = memo(function StatCard({ label, value, change, icon: Icon, trend }: {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="nl-glass rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-[#0066FF]/[0.10]">
            <Icon className="w-3.5 h-3.5 text-[#4D6BFF]" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[#B4C0E0]">{label}</span>
        </div>
        {change ? (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : trend === 'down' ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
            {change}
          </div>
        ) : null}
      </div>
      <div className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight">{value}</div>
    </div>
  );
});

function MarketsSectionSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
    </div>
  );
}

/**
 * MarketsView — the single canonical "markets front" for the platform.
 *
 * Rendered in BOTH the dashboard home Markets sub-tab and the standalone
 * /dashboard/market route so the two surfaces are guaranteed identical.
 * Composes, top to bottom:
 *   1. Global market-stats strip  (total mcap / 24h vol / BTC dominance / active coins)
 *   2. Market Heatmap             (top tokens, sized by cap, colored by 24h)
 *   3. Top Gainers + Heating Up   (60/40 split on lg+)
 *   4. Sector Rotation strip      (cap-weighted 24h change per sector)
 *   5. The token list/table       (search, categories, live prices, watchlist)
 *
 * CRYPTO-ONLY. The RWA / TradFi (stocks) board moved to the Stocks sub-tab.
 *
 * Self-contained: it owns its own market-globals fetch so neither host
 * surface has to thread data in. Real data only — volume-change and
 * dominance-change deltas the CoinGecko /global demo plan doesn't return
 * are left empty rather than fabricated.
 */
export default function MarketsView() {
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchMarketStats = async () => {
      try {
        const res = await fetch('/api/dashboard/market-globals', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const mc = data.totalMarketCap || 0;
        const vol = data.totalVolume || 0;
        const btcDom = data.btcDominance || 0;
        const mcChange = data.marketCapChange24h || 0;
        const active = Number(data.chainsTracked) || 0;
        setMarketStats({
          totalMarketCap: mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(1)}B`,
          totalVolume: vol >= 1e12 ? `$${(vol / 1e12).toFixed(2)}T` : `$${(vol / 1e9).toFixed(1)}B`,
          btcDominance: `${btcDom.toFixed(1)}%`,
          marketCapChange: `${mcChange >= 0 ? '+' : ''}${mcChange.toFixed(1)}%`,
          activeCoins: active > 1000 ? `${Math.round(active / 100) / 10}k+` : String(active),
        });
      } catch (err) {
        console.error('[MarketsView] Fetch market stats failed:', err);
      }
    };
    fetchMarketStats();
    const interval = setInterval(fetchMarketStats, 120_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const stats = marketStats ? [
    { label: 'Total Market Cap', value: marketStats.totalMarketCap, change: marketStats.marketCapChange, icon: BarChart3, trend: (parseFloat(marketStats.marketCapChange) >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral' },
    { label: '24h Volume', value: marketStats.totalVolume, change: '', icon: Activity, trend: 'neutral' as const },
    { label: 'BTC Dominance', value: marketStats.btcDominance, change: '', icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Active Coins', value: marketStats.activeCoins, change: 'Live', icon: Zap, trend: 'up' as const },
  ] : [
    { label: 'Total Market Cap', value: '…', change: '', icon: BarChart3, trend: 'neutral' as const },
    { label: '24h Volume', value: '…', change: '', icon: Activity, trend: 'neutral' as const },
    { label: 'BTC Dominance', value: '…', change: '', icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Active Coins', value: '…', change: '', icon: Zap, trend: 'neutral' as const },
  ];

  return (
    <div className="space-y-5">
      {/* 1 — Global market-stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.05 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* 2 — Market Heatmap (top tokens sized by cap, colored by 24h) */}
      <MarketHeatmap />

      {/* 3 — Top Gainers (60%) + Heating Up (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3">
          <TopGainersCard />
        </div>
        <div className="lg:col-span-2">
          <HeatingUpCard />
        </div>
      </div>

      {/* 4 — Sector Rotation strip */}
      <SectorStrip />

      {/* 5 — Token list/table (search, categories, live prices, watchlist) */}
      <Suspense fallback={<MarketsSectionSpinner />}>
        <MarketDashboard />
      </Suspense>
    </div>
  );
}
