'use client';

import { usePrices } from '@/lib/hooks/usePrices';

export default function PriceTicker() {
  const { prices, loading } = usePrices();

  if (loading) {
    return (
      <div className="flex gap-6 px-4 py-2 overflow-x-auto scrollbar-hide">
        {['BTC', 'ETH', 'SOL'].map((name) => (
          <div key={name} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-xs font-semibold">{name}</span>
            <span className="text-white font-mono text-xs">Loading...</span>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(prices);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-5 px-4 py-2 overflow-x-auto scrollbar-hide">
      {entries.map(([symbol, data]) => (
        <div key={symbol} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-gray-400 text-xs font-semibold">{symbol}</span>
          <span className="text-white font-mono text-xs">
            ${data.price < 1 ? data.price.toFixed(6) : data.price < 100 ? data.price.toFixed(2) : data.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className={`text-[10px] font-semibold ${data.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
