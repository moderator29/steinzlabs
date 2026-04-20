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

export function MiniSpark({ prices, width = 72, height = 26 }: { prices: number[]; width?: number; height?: number }) {
  if (!prices || prices.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - 2 - ((p - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  const last = prices[prices.length - 1];
  const first = prices[0];
  const isUp = last >= first;
  const color = isUp ? '#10B981' : '#EF4444';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

interface Props { limit?: number; href?: string }

export function TopGainersCard({ limit = 5, href = '/dashboard/top-gainers' }: Props) {
  const [gainers, setGainers] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard/top-gainers?limit=${limit}`, {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { tokens: Gainer[] };
        if (!cancelled) setGainers((json.tokens ?? []).slice(0, limit));
      } catch {
        if (!cancelled) setGainers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [limit]);

  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden h-full flex flex-col">
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
        <Link href={href} className="text-[11px] text-[#4D6BFF] hover:text-[#0A1EFF] flex items-center gap-1">
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-white/[0.03] flex-1">
        {loading && gainers.length === 0 ? (
          Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-14 bg-white/[0.02] animate-pulse mx-3 my-2 rounded" />
          ))
        ) : gainers.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-xs">No gainers data right now.</div>
        ) : gainers.map((g, i) => (
          <Link
            key={g.id}
            href={`/dashboard/market?coin=${g.id}`}
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="w-4 text-[11px] font-mono text-gray-600 text-center shrink-0">{i + 1}</span>
            {g.image && (
              <img
                src={g.image}
                alt={g.symbol}
                className="w-7 h-7 rounded-full shrink-0"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div className="min-w-0 shrink-0 w-[72px] sm:w-auto sm:flex-shrink">
              <div className="text-sm text-white font-medium truncate leading-tight">{g.name}</div>
              <div className="text-[10px] text-gray-500 uppercase leading-tight">{g.symbol}</div>
            </div>
            <div className="flex-1 flex justify-center">
              <MiniSpark prices={g.sparkline_in_7d?.price ?? []} />
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm text-white font-mono leading-tight">{fmtPrice(g.current_price)}</div>
              <div className="text-[11px] font-semibold text-emerald-400 leading-tight">
                +{g.price_change_percentage_24h.toFixed(1)}%
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
