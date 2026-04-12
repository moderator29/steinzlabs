'use client';

import { CoinGeckoMarket } from '@/lib/market/types';
import { formatPrice } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';
import { PriceChangeDisplay } from './PriceChangeDisplay';

interface TopGainersBarProps {
  tokens: CoinGeckoMarket[];
  onSelect: (id: string) => void;
}

export function TopGainersBar({ tokens, onSelect }: TopGainersBarProps) {
  const gainers = [...tokens]
    .filter((t) => t.price_change_percentage_24h > 0)
    .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .slice(0, 8);

  if (!gainers.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {gainers.map((token) => (
        <button
          key={token.id}
          onClick={() => onSelect(token.id)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#141824] border border-[#1E2433] rounded-lg hover:border-[#0A1EFF]/50 hover:bg-[#0A1EFF]/5 transition-all"
        >
          <TokenLogo src={token.image} symbol={token.symbol} size={20} />
          <span className="text-white text-xs font-medium uppercase">{token.symbol}</span>
          <span className="text-white text-xs font-mono">{formatPrice(token.current_price)}</span>
          <PriceChangeDisplay value={token.price_change_percentage_24h} size="sm" showArrow={false} />
        </button>
      ))}
    </div>
  );
}
