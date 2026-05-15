'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { MiniSpark } from '@/components/dashboard/TopGainersCard';

interface Gainer {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
}

type Direction = 'gainers' | 'losers';
type Timeframe = '1h' | '24h' | '7d';

function pctFor(g: Gainer, tf: Timeframe): number {
  if (tf === '1h') return g.price_change_percentage_1h_in_currency ?? 0;
  if (tf === '7d') return g.price_change_percentage_7d_in_currency ?? 0;
  return g.price_change_percentage_24h;
}

function fmtPrice(p: number): string {
  if (!p) return '—';
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

function fmtCompact(m: number): string {
  if (!m) return '—';
  if (m >= 1e12) return `$${(m / 1e12).toFixed(2)}T`;
  if (m >= 1e9) return `$${(m / 1e9).toFixed(2)}B`;
  if (m >= 1e6) return `$${(m / 1e6).toFixed(2)}M`;
  if (m >= 1e3) return `$${(m / 1e3).toFixed(1)}K`;
  return `$${m.toFixed(0)}`;
}

export default function TopGainersPage() {
  const [rows, setRows] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>('gainers');
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '30', direction, timeframe });
        const res = await fetch(`/api/dashboard/top-gainers?${params}`, {
          signal: AbortSignal.timeout(12_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { tokens: Gainer[] };
        if (!cancelled) setRows(json.tokens ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [direction, timeframe]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <BackButton href="/dashboard" />
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          direction === 'gainers' ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`}>
          {direction === 'gainers'
            ? <TrendingUp className="w-5 h-5 text-emerald-400" />
            : <TrendingDown className="w-5 h-5 text-red-400" />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Top {direction === 'gainers' ? 'Gainers' : 'Losers'}</h1>
          <p className="text-xs text-gray-500">
            Biggest {timeframe} movers · $1M+ market cap · click a row to open the trading terminal.
          </p>
        </div>
      </div>

      {/* Audit M6 #4 + #3 — direction tab + timeframe pills. CMC /
          CoinGecko / Birdeye all expose gainers + losers as a paired
          view with multi-timeframe toggles; matches that. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-900/60 border border-slate-800/50">
          {(['gainers', 'losers'] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                direction === d
                  ? d === 'gainers'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {d === 'gainers' ? 'Gainers' : 'Losers'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-900/60 border border-slate-800/50">
          {(['1h', '24h', '7d'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-[#0A1EFF]/20 text-[#8FA3FF]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[32px_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(70px,0.7fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_28px] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-white/[0.05] hidden md:grid">
          <div>#</div>
          <div>Coin</div>
          <div className="text-right">Price</div>
          <div className="text-right">{timeframe}</div>
          <div className="text-right">7d Chart</div>
          <div className="text-right">Market Cap</div>
          <div></div>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {loading && rows.length === 0 ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-14 mx-3 my-2 rounded bg-white/[0.02] animate-pulse" />
            ))
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No {direction} data available for {timeframe} right now.
            </div>
          ) : rows.map((g, i) => {
            const pct = pctFor(g, timeframe);
            return (
            <Link
              key={g.id}
              href={`/dashboard/market?coin=${g.id}`}
              className="grid grid-cols-[32px_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(70px,0.7fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_28px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-mono text-gray-600">{i + 1}</span>
              <div className="flex items-center gap-2.5 min-w-0">
                {g.image && (
                  <img src={g.image} alt={g.symbol} loading="lazy" decoding="async" className="w-7 h-7 rounded-full shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{g.name}</div>
                  <div className="text-[10px] text-gray-500 uppercase">{g.symbol}</div>
                </div>
              </div>
              <div className="text-right text-sm text-white font-mono">{fmtPrice(g.current_price)}</div>
              <div className={`text-right text-sm font-semibold ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </div>
              <div className="flex justify-end">
                <MiniSpark prices={g.sparkline_in_7d?.price ?? []} width={90} height={28} />
              </div>
              <div className="text-right text-xs text-gray-400 font-mono">{fmtCompact(g.market_cap)}</div>
              <div className="text-right">
                <Star className="w-4 h-4 text-gray-600 hover:text-yellow-400 inline" />
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
