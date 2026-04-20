'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, ArrowLeft, Star } from 'lucide-react';
import { MiniSpark } from '@/components/dashboard/TopGainersCard';

interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  sparkline_in_7d?: { price: number[] };
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

export default function TrendingPage() {
  const [rows, setRows] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/trending', {
          signal: AbortSignal.timeout(12_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { coins: TrendingCoin[] };
        if (!cancelled) setRows(json.coins ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 300_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Trending Now</h1>
          <p className="text-xs text-gray-500">Most-searched coins in the last 24 hours.</p>
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[32px_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(70px,0.7fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_28px] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-white/[0.05] hidden md:grid">
          <div>#</div>
          <div>Coin</div>
          <div className="text-right">Price</div>
          <div className="text-right">24h</div>
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
            <div className="px-4 py-10 text-center text-sm text-gray-500">Nothing trending right now.</div>
          ) : rows.map((c, i) => {
            const pct = c.price_change_percentage_24h;
            return (
              <Link
                key={c.id}
                href={`/dashboard/market?coin=${c.id}`}
                className="grid grid-cols-[32px_minmax(140px,1.3fr)_minmax(80px,0.8fr)_minmax(70px,0.7fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_28px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xs font-mono text-gray-600">{i + 1}</span>
                <div className="flex items-center gap-2.5 min-w-0">
                  {c.thumb && (
                    <img src={c.thumb} alt={c.symbol} className="w-7 h-7 rounded-full shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase">{c.symbol}</div>
                  </div>
                </div>
                <div className="text-right text-sm text-white font-mono">{fmtPrice(c.current_price)}</div>
                <div className={`text-right text-sm font-semibold ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
                <div className="flex justify-end">
                  <MiniSpark prices={c.sparkline_in_7d?.price ?? []} width={90} height={28} />
                </div>
                <div className="text-right text-xs text-gray-400 font-mono">{fmtCompact(c.market_cap)}</div>
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
