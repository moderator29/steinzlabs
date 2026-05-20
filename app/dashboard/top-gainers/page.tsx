'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { TokenRow } from '@/components/market/TokenRow';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { buildDetailHref } from '@/lib/market/tokenChainResolver';
import { useNavState } from '@/lib/nav/useNavState';
import type { CoinGeckoMarket } from '@/lib/market/types';

interface Gainer extends CoinGeckoMarket {
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

type Direction = 'gainers' | 'losers';
type Timeframe = '1h' | '24h' | '7d';

function pctFor(g: Gainer, tf: Timeframe): number {
  if (tf === '1h') return g.price_change_percentage_1h_in_currency ?? 0;
  if (tf === '7d') return g.price_change_percentage_7d_in_currency ?? 0;
  return g.price_change_percentage_24h ?? 0;
}

export default function TopGainersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

  const [rows, setRows] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>('gainers');
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');

  useNavState(
    'top-gainers',
    () => ({ direction, timeframe }),
    (s) => {
      if (s.direction === 'gainers' || s.direction === 'losers') setDirection(s.direction);
      if (typeof s.timeframe === 'string') setTimeframe(s.timeframe as Timeframe);
    },
  );

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
        const json = (await res.json()) as { tokens: Gainer[] };
        if (!cancelled) setRows(json.tokens ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const t = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [direction, timeframe]);

  // TokenRow's list variant displays price_change_percentage_24h. To honour
  // the user-selected timeframe pill we project the chosen timeframe's pct
  // into that slot before render. Keeps pixel parity with the Market page
  // without forking TokenRow.
  const displayRows = useMemo<Gainer[]>(
    () => rows.map((g) => ({ ...g, price_change_percentage_24h: pctFor(g, timeframe) })),
    [rows, timeframe],
  );

  const onCoinClick = (id: string) => {
    const token = rows.find((r) => r.id === id);
    router.push(buildDetailHref({ id, symbol: token?.symbol ?? id }));
  };

  return (
    <div className="p-4 sm:p-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <BackButton href="/dashboard" />
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            direction === 'gainers' ? 'bg-emerald-500/10' : 'bg-red-500/10'
          }`}
        >
          {direction === 'gainers' ? (
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">
            Top {direction === 'gainers' ? 'Gainers' : 'Losers'}
          </h1>
          <p className="text-xs text-gray-500">
            Biggest {timeframe} movers, $1M+ market cap. Tap a row to open the trading terminal.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.06]">
          {(['gainers', 'losers'] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
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
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.06]">
          {(['1h', '24h', '7d'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06] bg-[#111827]">
        {loading && displayRows.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.02] animate-pulse border-b border-white/[0.04] last:border-b-0" />
          ))
        ) : displayRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            No {direction} data available for {timeframe} right now.
          </div>
        ) : (
          displayRows.map((g, i) => (
            <TokenRow
              key={g.id}
              token={g}
              rank={i + 1}
              isWatched={isWatched(g.id)}
              onToggleWatch={toggleWatchlist}
              onClick={onCoinClick}
              variant="list"
            />
          ))
        )}
      </div>
    </div>
  );
}
