'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, SlidersHorizontal, X, TrendingUp, TrendingDown, Loader2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CoinRow {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  rank: number;
  source: 'coingecko' | 'dex';
  chain?: string;
  pairAddress?: string;
}

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'ETH', bsc: 'BSC', polygon: 'POLY', arbitrum: 'ARB',
  optimism: 'OP', base: 'BASE', solana: 'SOL', avalanche: 'AVAX',
};

function fmtPrice(p: number) {
  if (!p) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtMcap(n: number) {
  if (!n) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export default function Markets() {
  const router = useRouter();
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoinRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [totalMcap, setTotalMcap] = useState('$2.41T');
  const [totalChange, setTotalChange] = useState('+2.4%');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTopCoins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market-data?category=top&limit=100');
      const data = await res.json();
      if (data.tokens) {
        const rows: CoinRow[] = data.tokens.map((t: any, i: number) => ({
          id: t.id || t.symbol?.toLowerCase() || `coin-${i}`,
          symbol: t.symbol?.toUpperCase() || '',
          name: t.name || '',
          image: t.image || '',
          price: t.price || t.current_price || 0,
          change24h: t.change24h ?? t.price_change_percentage_24h ?? 0,
          marketCap: t.marketCap ?? t.market_cap ?? 0,
          volume24h: t.volume24h ?? t.total_volume ?? 0,
          rank: t.rank ?? t.market_cap_rank ?? i + 1,
          source: 'coingecko',
        }));
        setCoins(rows);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopCoins();
  }, [fetchTopCoins]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const localMatch = coins.filter(c =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.symbol.toLowerCase().includes(q.toLowerCase())
        );

        if (localMatch.length > 0) {
          setSearchResults(localMatch.slice(0, 20));
          setSearching(false);
          return;
        }

        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const rows: CoinRow[] = (data.results || []).map((r: any) => ({
          id: r.pairAddress || r.address || r.symbol,
          symbol: r.symbol,
          name: r.name,
          image: '',
          price: r.priceUsd,
          change24h: r.change24h,
          marketCap: 0,
          volume24h: r.volume24h,
          rank: 0,
          source: 'dex',
          chain: r.chain,
          pairAddress: r.pairAddress,
        }));
        setSearchResults(rows);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleCoinTap = (coin: CoinRow) => {
    const params = new URLSearchParams({
      symbol: coin.symbol,
      name: coin.name,
    });
    if (coin.source === 'coingecko' && coin.id) {
      params.set('coin', coin.id);
    }
    if (coin.pairAddress) params.set('pair', coin.pairAddress);
    if (coin.chain) params.set('chain', coin.chain);
    router.push(`/dashboard/market?${params.toString()}`);
  };

  const displayCoins = searchQuery.length >= 2 ? searchResults : coins;

  return (
    <div className="pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Total: {totalMcap}</div>
          <div className="text-xs font-semibold text-emerald-400">{totalChange}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or CA..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A1EFF] animate-spin" />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center justify-center w-10 h-10 bg-[#111827] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 transition-all flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading all coins...</span>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06]">
          {displayCoins.length === 0 && searchQuery.length >= 2 ? (
            <div className="py-10 text-center text-gray-500 text-sm bg-[#111827]">
              No coins found for "{searchQuery}"
            </div>
          ) : (
            displayCoins.map((coin, i) => {
              const isPositive = coin.change24h >= 0;
              return (
                <button
                  key={`${coin.id}-${i}`}
                  onClick={() => handleCoinTap(coin)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 text-left"
                >
                  <div className="w-6 text-right text-[11px] text-gray-500 flex-shrink-0 font-mono">
                    {coin.rank > 0 ? coin.rank : ''}
                  </div>

                  <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center">
                    {coin.image ? (
                      <img src={coin.image} alt={coin.symbol} className="w-full h-full object-cover rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-xs font-bold text-white">{coin.symbol.slice(0, 2)}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">{coin.name}</span>
                      {coin.source === 'dex' && coin.chain && (
                        <span className="text-[9px] px-1 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded font-medium">
                          {CHAIN_LABEL[coin.chain] || coin.chain.slice(0, 4).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {coin.marketCap > 0 ? fmtMcap(coin.marketCap) : coin.symbol}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                    <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      )}

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative w-full bg-[#111827] rounded-t-2xl p-6 z-10 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Blockchain', value: 'All Chains' },
                { label: 'Market Cap', value: 'All' },
                { label: 'Price Change', value: 'All' },
                { label: 'Timeframe', value: '24 H' },
              ].map((filter) => (
                <div key={filter.label} className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-gray-300">{filter.label}</span>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{filter.value}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
