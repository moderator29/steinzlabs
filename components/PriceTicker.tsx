'use client';

import { usePrices } from '@/lib/hooks/usePrices';

export default function PriceTicker() {
  const { btc, eth, sol, loading } = usePrices();

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

  const coins = [
    { name: 'BTC', data: btc },
    { name: 'ETH', data: eth },
    { name: 'SOL', data: sol },
  ];

  return (
    <div className="flex gap-6 px-4 py-2 overflow-x-auto scrollbar-hide">
      {coins.map(({ name, data }) => (
        <div key={name} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-gray-400 text-xs font-semibold">{name}</span>
          <span className="text-white font-mono text-xs">
            ${data ? data.price.toLocaleString(undefined, { maximumFractionDigits: name === 'SOL' ? 2 : 0 }) : '0'}
          </span>
          {data && (
            <span className={`text-[10px] font-semibold ${data.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
