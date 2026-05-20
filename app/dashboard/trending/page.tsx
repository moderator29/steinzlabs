'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { TokenRow } from '@/components/market/TokenRow';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { resolveTokenChain } from '@/lib/market/tokenChainResolver';
import type { CoinGeckoMarket } from '@/lib/market/types';

interface TrendingCoin extends CoinGeckoMarket {
  thumb?: string;
}

// §S6.9 — pretty chain labels for the row chip. Ethereum omitted (default).
const CHAIN_DISPLAY: Record<string, string> = {
  bitcoin: 'BTC', solana: 'SOL', bsc: 'BSC', xrp: 'XRP', cardano: 'ADA',
  avalanche: 'AVAX', polkadot: 'DOT', dogecoin: 'DOGE', litecoin: 'LTC',
  polygon: 'MATIC', arbitrum: 'ARB', optimism: 'OP', base: 'BASE',
  fantom: 'FTM', cronos: 'CRO', sui: 'SUI', near: 'NEAR', cosmos: 'ATOM',
  tron: 'TRX', zcash: 'ZEC', monero: 'XMR',
};
function chainChipFor(id: string, symbol: string): string | null {
  const chain = resolveTokenChain({ id, symbol }).chain;
  if (!chain || chain === 'ethereum') return null;
  return CHAIN_DISPLAY[chain] ?? chain.toUpperCase();
}

export default function TrendingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

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
        const json = (await res.json()) as { coins: TrendingCoin[] };
        if (!cancelled) {
          // CoinGecko trending returns `thumb`; TokenRow/TokenLogo reads `image`.
          const normalised = (json.coins ?? []).map((c) => ({ ...c, image: c.image || c.thumb || '' }));
          setRows(normalised);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 300_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const onCoinClick = (id: string) => {
    const token = rows.find((r) => r.id === id);
    const chain = resolveTokenChain({ id, symbol: token?.symbol ?? id }).chain;
    router.push(`/dashboard/market/${chain}/${id}`);
  };

  return (
    <div className="p-4 sm:p-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <BackButton href="/dashboard" />
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">Trending Now</h1>
          <p className="text-xs text-gray-500">Most-searched coins in the last 24 hours.</p>
        </div>
      </div>

      <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06] bg-[#111827]">
        {loading && rows.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.02] animate-pulse border-b border-white/[0.04] last:border-b-0" />
          ))
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">Nothing trending right now.</div>
        ) : (
          rows.map((c, i) => (
            <TokenRow
              key={c.id}
              token={c}
              rank={i + 1}
              isWatched={isWatched(c.id)}
              onToggleWatch={toggleWatchlist}
              onClick={onCoinClick}
              variant="list"
              chainLabel={chainChipFor(c.id, c.symbol)}
            />
          ))
        )}
      </div>
    </div>
  );
}
