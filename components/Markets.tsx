'use client';

import { useState, useEffect } from 'react';

interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  image: string;
}

export default function Markets() {
  const [activeFilter, setActiveFilter] = useState('trending');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const filters = ['trending', 'gainers', 'losers'];

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-data?category=${activeFilter}&limit=25`);
      const data = await response.json();
      if (data.tokens) {
        setTokens(data.tokens);
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, [activeFilter]);

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
              activeFilter === filter
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30'
                : 'text-gray-400 border border-white/10 hover:text-white'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-3xl mb-3 animate-pulse">&#x1F4CA;</div>
          <p className="text-sm">Loading market data...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="glass rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all flex items-center gap-3"
            >
              <img
                src={token.image}
                alt={token.name}
                className="w-8 h-8 rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{token.symbol}</span>
                  <span className="text-xs text-gray-500 truncate">{token.name}</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  Vol: ${(token.volume24h / 1e9).toFixed(2)}B | MCap: ${(token.marketCap / 1e9).toFixed(1)}B
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-semibold">
                  ${token.price < 1 ? token.price.toFixed(4) : token.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs font-semibold ${token.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {token.change24h >= 0 ? '+' : ''}{token.change24h?.toFixed(2) || '0.00'}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
