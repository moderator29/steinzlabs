'use client';

import { WatchlistItem, CoinGeckoMarket } from '@/lib/market/types';
import { WatchlistCard } from './WatchlistCard';

interface WatchlistGridProps {
  items: WatchlistItem[];
  tokens: CoinGeckoMarket[];
  onRemove?: (tokenId: string) => void;
}

const shimmer = 'animate-pulse bg-[#1E2433] rounded';

function SkeletonCard() {
  return (
    <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 pr-6">
        <div className={`w-10 h-10 rounded-full ${shimmer}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-3.5 w-24 ${shimmer}`} />
          <div className={`h-2.5 w-12 ${shimmer}`} />
        </div>
      </div>
      <div className={`h-7 w-32 ${shimmer}`} />
      <div className="flex justify-between">
        <div className={`h-3 w-20 ${shimmer}`} />
        <div className={`h-9 w-20 ${shimmer}`} />
      </div>
    </div>
  );
}

export function WatchlistGrid({ items, tokens, onRemove }: WatchlistGridProps) {
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));
  const isLoadingTokens = tokens.length === 0 && items.length > 0;

  if (isLoadingTokens) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <SkeletonCard key={item.token_id} />
        ))}
      </div>
    );
  }

  const matched = items
    .map((item) => ({ item, token: tokenMap.get(item.token_id) }))
    .filter((x): x is { item: WatchlistItem; token: CoinGeckoMarket } => x.token !== undefined);

  if (matched.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {matched.map(({ item, token }) => (
        <WatchlistCard
          key={item.token_id}
          token={token}
          onRemove={onRemove ?? (() => {})}
        />
      ))}
    </div>
  );
}
