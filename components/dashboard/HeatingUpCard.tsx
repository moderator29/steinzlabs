'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, ArrowUpRight } from 'lucide-react';
import { MiniSpark } from './TopGainersCard';
import { buildDetailHref } from '@/lib/market/tokenChainResolver';

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

interface Props { limit?: number; href?: string }

export function HeatingUpCard({ limit = 4, href = '/dashboard/trending' }: Props) {
  const [coins, setCoins] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/trending', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { coins: TrendingCoin[] };
        if (!cancelled) setCoins((json.coins ?? []).slice(0, limit));
      } catch {
        if (!cancelled) setCoins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    // Audit M7 #4 — was 5min (300_000ms). 'Trending' loses meaning at
    // 5min latency; GeckoTerminal / Birdeye refresh every 30-60s.
    // Backed by a 2min cache on the API so this is safe for upstream.
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [limit]);

  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Heating Up</h3>
            {/* Audit M7 #1 — subtitle was 'What people are searching'
                which implied platform-side search analytics. The
                actual signal is CoinGecko's /search/trending endpoint,
                which ranks by their global search velocity. Honest
                label so users don't read it as 'what NAKA users are
                searching'. */}
            <p className="text-[10px] text-gray-500">Search-trending on CoinGecko · 24h</p>
          </div>
        </div>
        <Link href={href} className="text-[11px] text-[#4D6BFF] hover:text-[#0A1EFF] flex items-center gap-1">
          Explore <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-white/[0.03] flex-1">
        {loading && coins.length === 0 ? (
          Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-14 bg-white/[0.02] animate-pulse mx-3 my-2 rounded" />
          ))
        ) : coins.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-xs">Nothing trending right now.</div>
        ) : coins.map((c, i) => {
          const pct = c.price_change_percentage_24h;
          return (
            <Link
              key={c.id}
              href={buildDetailHref({ id: c.id, symbol: c.symbol })}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <span className="w-4 text-[11px] font-mono text-gray-600 text-center shrink-0">{i + 1}</span>
              {c.thumb && (
                <img
                  src={c.thumb}
                  alt={c.symbol}
                  className="w-7 h-7 rounded-full shrink-0"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="min-w-0 shrink-0 w-[72px] sm:w-auto sm:flex-shrink">
                <div className="text-sm text-white font-medium truncate leading-tight">{c.name}</div>
                <div className="text-[10px] text-gray-500 uppercase leading-tight">{c.symbol}</div>
              </div>
              <div className="flex-1 flex justify-center">
                <MiniSpark prices={c.sparkline_in_7d?.price ?? []} />
              </div>
              <div className="text-end shrink-0">
                <div className="text-sm text-white font-mono leading-tight">{fmtPrice(c.current_price)}</div>
                <div className={`text-[11px] font-semibold leading-tight ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
