'use client';

import { usePrices } from '@/lib/hooks/usePrices';

export default function PriceTicker() {
  const { prices, loading } = usePrices();

  if (loading) {
    return (
      <div className="flex gap-6 px-4 py-2.5 overflow-hidden">
        {['BTC', 'ETH', 'SOL'].map((name) => (
          <div key={name} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-sm font-bold">{name}</span>
            <span className="text-white font-mono text-sm">Loading...</span>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(prices);

  if (entries.length === 0) {
    return null;
  }

  const tickerContent = entries.map(([symbol, data]) => (
    <div key={symbol} className="flex items-center gap-2.5 whitespace-nowrap px-4">
      <span className="text-gray-300 text-sm font-bold">{symbol}</span>
      <span className="text-white font-mono text-sm font-semibold">
        ${data.price < 1 ? data.price.toFixed(6) : data.price < 100 ? data.price.toFixed(2) : data.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
      <span className={`text-xs font-bold ${data.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
        {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
      </span>
      <span className="text-gray-700 text-xs mx-1">&bull;</span>
    </div>
  ));

  return (
    <div className="overflow-hidden py-2.5">
      <div className="flex animate-marquee-fast hover:[animation-play-state:paused]">
        <div className="flex shrink-0">
          {tickerContent}
        </div>
        <div className="flex shrink-0">
          {entries.map(([symbol, data]) => (
            <div key={`dup-${symbol}`} className="flex items-center gap-2.5 whitespace-nowrap px-4">
              <span className="text-gray-300 text-sm font-bold">{symbol}</span>
              <span className="text-white font-mono text-sm font-semibold">
                ${data.price < 1 ? data.price.toFixed(6) : data.price < 100 ? data.price.toFixed(2) : data.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className={`text-xs font-bold ${data.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
              </span>
              <span className="text-gray-700 text-xs mx-1">&bull;</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
