'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { TokenRow } from '@/components/market/TokenRow';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { buildDetailHref, resolveTokenChain } from '@/lib/market/tokenChainResolver';
import { useNavState } from '@/lib/nav/useNavState';
import type { CoinGeckoMarket } from '@/lib/market/types';

interface Gainer extends CoinGeckoMarket {
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

type Direction = 'gainers' | 'losers';

// §S6.9 — pretty chain labels for the row chip. Ethereum is omitted on
// purpose: it's the default and chipping every ERC20 row "ETH" adds noise.
// Native L1s and Solana/Base/Arbitrum show up clearly.
const CHAIN_DISPLAY: Record<string, string> = {
  bitcoin: 'BTC',
  solana: 'SOL',
  bsc: 'BSC',
  xrp: 'XRP',
  cardano: 'ADA',
  avalanche: 'AVAX',
  polkadot: 'DOT',
  dogecoin: 'DOGE',
  litecoin: 'LTC',
  polygon: 'MATIC',
  arbitrum: 'ARB',
  optimism: 'OP',
  base: 'BASE',
  fantom: 'FTM',
  cronos: 'CRO',
  sui: 'SUI',
  near: 'NEAR',
  cosmos: 'ATOM',
  tron: 'TRX',
  zcash: 'ZEC',
  monero: 'XMR',
};

function chainChipFor(id: string, symbol: string): string | null {
  const chain = resolveTokenChain({ id, symbol }).chain;
  if (!chain || chain === 'ethereum') return null;
  return CHAIN_DISPLAY[chain] ?? chain.toUpperCase();
}

export default function TopGainersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

  const [rows, setRows] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>('gainers');

  useNavState(
    'top-gainers',
    () => ({ direction }),
    (s) => {
      if (s.direction === 'gainers' || s.direction === 'losers') setDirection(s.direction);
    },
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // §S6.9 — UI is locked to 24h to match the only timeframe getTopGainers
        // can honestly return. 1h/7d pills lived but lied (upstream sort was
        // hard-coded to 24h on CoinGecko free tier). Removed the pills until
        // the upstream call can drive `order=` from a timeframe.
        const params = new URLSearchParams({ limit: '30', direction, timeframe: '24h' });
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
  }, [direction]);

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
            Biggest 24h movers, $1M+ market cap. Tap a row to open the trading terminal.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="nl-glass inline-flex items-center gap-1 p-1 rounded-lg">
          {(['gainers', 'losers'] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                direction === d
                  ? d === 'gainers'
                    ? 'nl-button bg-emerald-500/15 text-emerald-300'
                    : 'nl-button bg-red-500/15 text-red-300'
                  : 'nl-button--ghost text-slate-400 hover:text-white'
              }`}
            >
              {d === 'gainers' ? 'Gainers' : 'Losers'}
            </button>
          ))}
        </div>
      </div>

      <div className="nl-glass space-y-0 rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        {loading && rows.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.02] animate-pulse border-b border-white/[0.04] last:border-b-0" />
          ))
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            No {direction} data available right now.
          </div>
        ) : (
          rows.map((g, i) => (
            <TokenRow
              key={g.id}
              token={g}
              rank={i + 1}
              isWatched={isWatched(g.id)}
              onToggleWatch={toggleWatchlist}
              onClick={onCoinClick}
              variant="list"
              chainLabel={chainChipFor(g.id, g.symbol)}
            />
          ))
        )}
      </div>
    </div>
  );
}
