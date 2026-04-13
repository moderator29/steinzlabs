'use client';

import { useState, useCallback } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMarketData } from '@/hooks/market/useMarketData';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { CategoryPills } from '@/components/market/CategoryPills';
import { TopGainersBar } from '@/components/market/TopGainersBar';
import { TokenRow } from '@/components/market/TokenRow';
import { LoadingSkeleton } from '@/components/market/LoadingSkeleton';
import { ErrorState } from '@/components/market/ErrorState';

type CategoryId = 'all' | 'majors' | 'defi' | 'layer1' | 'layer2' | 'gaming' | 'ai' | 'meme' | 'depin';

const MAJOR_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'cardano', 'avalanche-2', 'polkadot'];

export default function PricesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryId>('all');
  const [search, setSearch] = useState('');

  const { tokens, loading, error, refetch } = useMarketData({ category });
  const { isWatched, toggleWatchlist } = useWatchlist(null); // TODO: pass userId from auth

  const filtered = tokens.filter((t) => {
    if (category === 'majors') return MAJOR_IDS.includes(t.id);
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSelect = useCallback((id: string) => {
    router.push(`/market/prices/${id}`);
  }, [router]);

  return (
    <div className="space-y-4">
      {/* Search + Category */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or contract address..."
            className="w-full bg-[#141824] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF] transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#141824] border border-[#1E2433] rounded-lg text-gray-400 hover:text-white text-sm transition-colors">
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      <CategoryPills active={category} onChange={setCategory as (id: CategoryId) => void} />

      {/* Top gainers */}
      {!loading && tokens.length > 0 && (
        <TopGainersBar tokens={tokens} onSelect={handleSelect} />
      )}

      {/* Token table */}
      {loading ? (
        <LoadingSkeleton rows={10} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#0D1117] border border-[#1E2433] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-[#1E2433]">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Coin</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">1H%</th>
                  <th className="px-4 py-3 text-right">24H%</th>
                  <th className="px-4 py-3 text-right">7D%</th>
                  <th className="px-4 py-3 text-right">24H Volume</th>
                  <th className="px-4 py-3 text-right">Market Cap</th>
                  <th className="px-4 py-3 text-right w-28">7D Chart</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((token, i) => (
                  <TokenRow
                    key={token.id}
                    token={token}
                    rank={i + 1}
                    isWatched={isWatched(token.id)}
                    onToggleWatch={(id) => toggleWatchlist(id)}
                    onClick={handleSelect}
                    variant="table"
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden bg-[#0D1117] border border-[#1E2433] rounded-xl overflow-hidden">
            {filtered.map((token, i) => (
              <TokenRow
                key={token.id}
                token={token}
                rank={i + 1}
                isWatched={isWatched(token.id)}
                onToggleWatch={(id) => toggleWatchlist(id)}
                onClick={handleSelect}
                variant="list"
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-gray-400">{search} not found. Try a contract address or check spelling.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
