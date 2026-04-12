'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CoinGeckoMarket } from '@/lib/market/types';
import { formatPrice, formatLargeNumber } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';
import { PriceChangeDisplay } from './PriceChangeDisplay';
import { SparklineChart } from './SparklineChart';

interface WatchlistCardProps {
  token: CoinGeckoMarket;
  onRemove: (id: string) => void;
}

export function WatchlistCard({ token, onRemove }: WatchlistCardProps) {
  const router = useRouter();
  const sparkData = token.sparkline_in_7d?.price ?? [];
  const isPositive = (token.price_change_percentage_24h ?? 0) >= 0;

  return (
    <div
      onClick={() => router.push(`/market/prices/${token.id}`)}
      className="relative bg-[#0D1117] border border-[#1E2433] rounded-xl p-4 cursor-pointer
                 hover:border-[#0A1EFF]/40 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(10,30,255,0.08)]
                 transition-all duration-150"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(token.id); }}
        className="absolute top-3 right-3 p-1 text-[#0A1EFF] hover:scale-110 transition-transform"
      >
        <Star size={14} className="fill-[#0A1EFF]" />
      </button>

      <div className="flex items-center gap-3 mb-3 pr-6">
        <TokenLogo src={token.image} symbol={token.symbol} size={40} />
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate">{token.name}</div>
          <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-white font-bold font-mono text-xl">{formatPrice(token.current_price)}</span>
        <PriceChangeDisplay value={token.price_change_percentage_24h} size="sm" />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div>
          <span className="text-gray-500 text-xs">MCap </span>
          <span className="text-gray-300 text-xs font-mono">{formatLargeNumber(token.market_cap)}</span>
        </div>
        {sparkData.length > 0 && (
          <div className="w-20">
            <SparklineChart data={sparkData} isPositive={isPositive} height={36} />
          </div>
        )}
      </div>
    </div>
  );
}
