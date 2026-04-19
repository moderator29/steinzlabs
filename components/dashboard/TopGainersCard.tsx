'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

interface Gainer {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: { price: number[] };
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

function fmtMcap(m: number): string {
  if (m >= 1e12) return `$${(m / 1e12).toFixed(2)}T`;
  if (m >= 1e9) return `$${(m / 1e9).toFixed(2)}B`;
  if (m >= 1e6) return `$${(m / 1e6).toFixed(2)}M`;
  if (m >= 1e3) return `$${(m / 1e3).toFixed(1)}K`;
  return `$${m.toFixed(0)}`;
}

function MiniSpark({ prices }: { prices: number[] }) {
  if (!prices || prices.length < 2) return <div className="w-16 h-6" />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * 60;
    const y = 22 - ((p - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');
  const last = prices[prices.length - 1];
  const first = prices[0];
  const isUp = last >= first;
  return (
    <svg viewBox="0 0 60 24" className="w-16 h-6" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={isUp ? '#10B981' : '#EF4444'} strokeWidth="1.2" />
    </svg>
  );
}

export function TopGainersCard() {
  const [gainers, setGainers] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/top-gainers?limit=8', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { tokens: Gainer[] };
        if (!cancelled) setGainers(json.tokens ?? []);
      } catch {
        if (!cancelled) setGainers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Top Gainers</h3>
            <p className="text-[10px] text-gray-500">24h movers</p>
          </div>
        </div>
        <Link href="/dashboard/market" className="text-[11px] text-[#4D6BFF] hover:text-[#0A1EFF] flex items-center gap-1">
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead className="text-gray-500 border-b border-white/[0.04]">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-8">#</th>
              <th className="text-left font-medium px-3 py-2">Coin</th>
              <th className="text-right font-medium px-3 py-2">Price</th>
              <th className="text-right font-medium px-3 py-2">24h</th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">7d</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Market Cap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {loading && gainers.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-6 bg-white/[0.02] animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : gainers.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-xs">No gainers data right now. Check back in a minute.</td></tr>
            ) : gainers.map((g, i) => (
              <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 text-gray-600 font-mono">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/dashboard/market?coin=${g.id}`} className="flex items-center gap-2 hover:text-[#4D6BFF]">
                    {g.image && <img src={g.image} alt={g.symbol} className="w-5 h-5 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{g.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{g.symbol}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right text-white font-mono">{fmtPrice(g.current_price)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">
                  +{g.price_change_percentage_24h.toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                  <div className="flex justify-end"><MiniSpark prices={g.sparkline_in_7d?.price ?? []} /></div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-400 font-mono hidden md:table-cell">{fmtMcap(g.market_cap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
