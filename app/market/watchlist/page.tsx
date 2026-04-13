'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { WatchlistCard } from '@/components/market/WatchlistCard';
import { LoadingSkeleton } from '@/components/market/LoadingSkeleton';
import { CoinGeckoMarket } from '@/lib/market/types';

export default function WatchlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { watchlist, loading: wLoading, removeFromWatchlist } = useWatchlist(user?.id ?? null);
  const [tokens, setTokens] = useState<CoinGeckoMarket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!watchlist.length) { setTokens([]); return; }
    setLoading(true);
    // Fetch first 100 tokens and filter to watchlisted ones
    fetch('/api/market/prices?page=1')
      .then((r) => r.json())
      .then((data: CoinGeckoMarket[]) => {
        const filtered = Array.isArray(data) ? data.filter((t) => watchlist.includes(t.id)) : [];
        setTokens(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [watchlist]);

  if (wLoading || loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <LoadingSkeleton key={i} variant="card" />)}
      </div>
    );
  }

  if (!watchlist.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Star size={48} className="text-gray-700 mb-4" />
        <h2 className="text-white font-semibold text-lg mb-2">No tokens in your watchlist</h2>
        <p className="text-gray-500 text-sm mb-6">Star any token from the Prices tab to track it here</p>
        <button onClick={() => router.push('/market/prices')}
          className="px-6 py-2.5 bg-[#0A1EFF] text-white rounded-lg font-medium hover:bg-[#0916CC] transition-colors">
          Browse Prices
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">{watchlist.length} tokens</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tokens.length > 0
          ? tokens.map((t) => (
              <WatchlistCard key={t.id} token={t} onRemove={removeFromWatchlist} />
            ))
          : watchlist.map((id) => (
              <div key={id} className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4 animate-pulse h-32" />
            ))
        }
      </div>
    </div>
  );
}
