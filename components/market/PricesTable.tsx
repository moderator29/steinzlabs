'use client';

import { CoinGeckoMarket } from '@/lib/market/types';
import { formatPrice, formatLargeNumber, formatPercent } from '@/lib/market/formatters';
import { SparklineChart } from './SparklineChart';
import { TokenLogo } from './TokenLogo';

interface PricesTableProps {
  tokens: CoinGeckoMarket[];
  loading?: boolean;
  onTokenClick?: (token: CoinGeckoMarket) => void;
}

const shimmer = 'animate-pulse bg-[#1E2433] rounded';

function PctCell({ value }: { value?: number | null }) {
  const v = value ?? 0;
  const isPos = v >= 0;
  return (
    <span className={`font-mono text-xs ${isPos ? 'text-green-400' : 'text-red-400'}`}>
      {formatPercent(v)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#1E2433]/60">
      <td className="px-3 py-3"><div className={`h-3 w-5 ${shimmer}`} /></td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${shimmer}`} />
          <div className="space-y-1">
            <div className={`h-3 w-20 ${shimmer}`} />
            <div className={`h-2.5 w-10 ${shimmer}`} />
          </div>
        </div>
      </td>
      <td className="px-3 py-3"><div className={`h-3 w-16 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-3 w-12 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-3 w-12 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-3 w-12 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-3 w-20 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-3 w-20 ${shimmer} ml-auto`} /></td>
      <td className="px-3 py-3"><div className={`h-8 w-20 ${shimmer} ml-auto`} /></td>
    </tr>
  );
}

export function PricesTable({ tokens, loading = false, onTokenClick }: PricesTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#1E2433] bg-[#0D1117]">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-[#1E2433] text-gray-500 text-xs">
            <th className="px-3 py-3 text-left font-medium w-10">#</th>
            <th className="px-3 py-3 text-left font-medium">Token</th>
            <th className="px-3 py-3 text-right font-medium">Price</th>
            <th className="px-3 py-3 text-right font-medium">1h %</th>
            <th className="px-3 py-3 text-right font-medium">24h %</th>
            <th className="px-3 py-3 text-right font-medium">7d %</th>
            <th className="px-3 py-3 text-right font-medium">Volume 24h</th>
            <th className="px-3 py-3 text-right font-medium">Market Cap</th>
            <th className="px-3 py-3 text-right font-medium w-24">7d Chart</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            : tokens.map((token) => {
                const sparkData = token.sparkline_in_7d?.price ?? [];
                const is24hPos = (token.price_change_percentage_24h ?? 0) >= 0;

                return (
                  <tr
                    key={token.id}
                    onClick={() => onTokenClick?.(token)}
                    className="border-b border-[#1E2433]/60 hover:bg-[#141824] transition-colors cursor-pointer group"
                  >
                    <td className="px-3 py-3 text-gray-500 text-xs tabular-nums">
                      {token.market_cap_rank ?? '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <TokenLogo src={token.image} symbol={token.symbol} size={28} />
                        <div>
                          <div className="text-white font-medium text-sm leading-tight group-hover:text-[#0A1EFF] transition-colors">
                            {token.name}
                          </div>
                          <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-white font-mono text-xs">
                      {formatPrice(token.current_price)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <PctCell value={token.price_change_percentage_1h_in_currency} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <PctCell value={token.price_change_percentage_24h} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <PctCell value={token.price_change_percentage_7d_in_currency} />
                    </td>
                    <td className="px-3 py-3 text-right text-gray-300 font-mono text-xs">
                      {formatLargeNumber(token.total_volume)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-300 font-mono text-xs">
                      {formatLargeNumber(token.market_cap)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-20 ml-auto">
                        {sparkData.length > 0 ? (
                          <SparklineChart data={sparkData} isPositive={is24hPos} height={32} />
                        ) : (
                          <div className="h-8 flex items-center justify-center text-gray-600 text-xs">
                            N/A
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>

      {!loading && tokens.length === 0 && (
        <div className="py-16 text-center text-gray-500 text-sm">
          No tokens found
        </div>
      )}
    </div>
  );
}
