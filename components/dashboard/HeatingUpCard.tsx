'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, ArrowUpRight } from 'lucide-react';

// "Heating Up" — Naka's unique framing for the CoinGecko `/search/trending`
// feed. Same data, different name + flame glyph so it looks like ours.

interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number;
  data?: { price_change_percentage_24h?: { usd?: number } };
}

export function HeatingUpCard() {
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
        if (!cancelled) setCoins((json.coins ?? []).slice(0, 10));
      } catch {
        if (!cancelled) setCoins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 300_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Heating Up</h3>
            <p className="text-[10px] text-gray-500">What people are searching</p>
          </div>
        </div>
        <Link href="/dashboard/market" className="text-[11px] text-[#4D6BFF] hover:text-[#0A1EFF] flex items-center gap-1">
          Explore <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-white/[0.03] flex-1 overflow-y-auto">
        {loading && coins.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.02] animate-pulse mx-3 my-2 rounded" />
          ))
        ) : coins.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-xs">Nothing trending right now.</div>
        ) : coins.map((c, i) => {
          const pct = c.data?.price_change_percentage_24h?.usd;
          return (
            <Link key={c.id} href={`/dashboard/market?coin=${c.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group">
              <span className="w-5 text-[11px] font-mono text-gray-600 text-center">{i + 1}</span>
              {c.thumb && <img src={c.thumb} alt={c.symbol} className="w-6 h-6 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate group-hover:text-[#4D6BFF]">{c.name}</div>
                <div className="text-[10px] text-gray-500 uppercase">{c.symbol}</div>
              </div>
              {typeof pct === 'number' && (
                <span className={`text-xs font-semibold ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
