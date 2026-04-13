'use client';

import { CoinGeckoMarket } from '@/lib/market/types';
import { formatPrice, formatPercent } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';

interface PricesListProps {
  tokens: CoinGeckoMarket[];
  loading?: boolean;
  onTokenClick?: (token: CoinGeckoMarket) => void;
}

const shimmer = 'animate-pulse bg-[#1E2433] rounded';

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2433]/60">
      <div className={`w-5 h-3 ${shimmer} flex-shrink-0`} />
      <div className={`w-8 h-8 rounded-full ${shimmer} flex-shrink-0`} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className={`h-3.5 w-24 ${shimmer}`} />
        <div className={`h-2.5 w-12 ${shimmer}`} />
      </div>
      <div className="text-right space-y-1.5 flex-shrink-0">
        <div className={`h-3.5 w-20 ${shimmer} ml-auto`} />
        <div className={`h-2.5 w-14 ${shimmer} ml-auto`} />
      </div>
    </div>
  );
}

export function PricesList({ tokens, loading = false, onTokenClick }: PricesListProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#1E2433] bg-[#0D1117] overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E2433] bg-[#0D1117] py-16 text-center text-gray-500 text-sm">
        No tokens found
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1E2433] bg-[#0D1117] overflow-hidden">
      {tokens.map((token, idx) => {
        const change = token.price_change_percentage_24h ?? 0;
        const isPos = change >= 0;

        return (
          <div
            key={token.id}
            onClick={() => onTokenClick?.(token)}
            className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2433]/60 last:border-b-0 hover:bg-[#141824] active:bg-[#141824] transition-colors cursor-pointer"
          >
            <span className="text-gray-600 text-xs tabular-nums w-5 text-right flex-shrink-0">
              {token.market_cap_rank ?? idx + 1}
            </span>

            <TokenLogo src={token.image} symbol={token.symbol} size={32} className="flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{token.name}</div>
              <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-white font-mono text-sm">{formatPrice(token.current_price)}</div>
              <div
                className={`text-xs font-medium mt-0.5 ${
                  isPos ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatPercent(change)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
