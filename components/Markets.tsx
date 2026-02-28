'use client';

import { useState } from 'react';

export default function Markets() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Trending', 'DeFi', 'Meme', 'Gainers', 'Losers'];

  const tokens = [
    { name: 'Bitcoin', symbol: 'BTC', price: '$97,245', change: '+2.4%', positive: true, mcap: '$1.91T' },
    { name: 'Ethereum', symbol: 'ETH', price: '$3,412', change: '+1.8%', positive: true, mcap: '$410B' },
    { name: 'Solana', symbol: 'SOL', price: '$178.50', change: '+5.2%', positive: true, mcap: '$82B' },
    { name: 'BNB', symbol: 'BNB', price: '$612', change: '-0.3%', positive: false, mcap: '$91B' },
    { name: 'Cardano', symbol: 'ADA', price: '$0.89', change: '+3.1%', positive: true, mcap: '$31B' },
    { name: 'Polygon', symbol: 'MATIC', price: '$1.12', change: '-1.2%', positive: false, mcap: '$10B' },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm ${
              activeFilter === filter
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'bg-[#111827] hover:bg-[#1A2235] text-gray-400'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tokens.map((token) => (
          <div key={token.symbol} className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/20 transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">{token.symbol.charAt(0)}</span>
              </div>
              <div>
                <div className="font-semibold">{token.name}</div>
                <div className="text-sm text-gray-400">{token.symbol}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold">{token.price}</div>
              <div className={`text-sm font-semibold ${token.positive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {token.change}
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-sm text-gray-400">MCap</div>
              <div className="text-sm font-mono">{token.mcap}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
