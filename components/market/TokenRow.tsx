'use client';

import { Star } from 'lucide-react';
import { CoinGeckoMarket } from '@/lib/market/types';
import { formatPrice, formatLargeNumber } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';
import { PriceChangeDisplay } from './PriceChangeDisplay';
import { SparklineChart } from './SparklineChart';

interface TokenRowProps {
  token: CoinGeckoMarket;
  rank: number;
  isWatched: boolean;
  onToggleWatch: (id: string) => void;
  onClick: (id: string) => void;
  variant?: 'table' | 'list';
}

export function TokenRow({ token, rank, isWatched, onToggleWatch, onClick, variant = 'table' }: TokenRowProps) {
  const sparkData = token.sparkline_in_7d?.price ?? [];
  const isPositive = (token.price_change_percentage_7d_in_currency ?? 0) >= 0;

  if (variant === 'list') {
    return (
      <div
        onClick={() => onClick(token.id)}
        className="flex items-center gap-3 p-3 hover:bg-[#141824] rounded-lg cursor-pointer transition-colors"
      >
        <span className="text-gray-500 text-xs w-6 text-right flex-shrink-0">{rank}</span>
        <TokenLogo src={token.image} symbol={token.symbol} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">{token.name}</div>
          <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-white font-mono text-sm">{formatPrice(token.current_price)}</div>
          <PriceChangeDisplay value={token.price_change_percentage_24h} size="sm" />
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleWatch(token.id); }} className="ml-1 p-1">
          <Star size={14} className={isWatched ? 'fill-[#0A1EFF] text-[#0A1EFF]' : 'text-gray-600'} />
        </button>
      </div>
    );
  }

  // Table variant
  return (
    <tr
      onClick={() => onClick(token.id)}
      className="hover:bg-[#0A1EFF]/5 cursor-pointer transition-colors border-b border-[#1E2433]/50 group"
    >
      <td className="px-4 py-3.5 text-gray-500 text-sm w-12">{rank}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <TokenLogo src={token.image} symbol={token.symbol} size={32} />
          <div>
            <div className="text-white font-medium text-sm">{token.name}</div>
            <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 text-white font-mono text-sm text-right">{formatPrice(token.current_price)}</td>
      <td className="px-4 py-3.5 text-right"><PriceChangeDisplay value={token.price_change_percentage_1h_in_currency} size="sm" /></td>
      <td className="px-4 py-3.5 text-right"><PriceChangeDisplay value={token.price_change_percentage_24h} size="sm" /></td>
      <td className="px-4 py-3.5 text-right"><PriceChangeDisplay value={token.price_change_percentage_7d_in_currency} size="sm" /></td>
      <td className="px-4 py-3.5 text-gray-300 text-sm text-right">{formatLargeNumber(token.total_volume)}</td>
      <td className="px-4 py-3.5 text-gray-300 text-sm text-right">{formatLargeNumber(token.market_cap)}</td>
      <td className="px-4 py-3.5 w-28">
        {sparkData.length > 0 && <SparklineChart data={sparkData} isPositive={isPositive} height={40} />}
      </td>
      <td className="px-4 py-3.5 w-10">
        <button onClick={(e) => { e.stopPropagation(); onToggleWatch(token.id); }} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Star size={14} className={isWatched ? 'fill-[#0A1EFF] text-[#0A1EFF]' : 'text-gray-600'} />
        </button>
      </td>
    </tr>
  );
}
