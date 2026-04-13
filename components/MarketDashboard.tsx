'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, SlidersHorizontal, X, TrendingUp, TrendingDown, Loader2, Star, ChevronRight } from 'lucide-react';
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

const MAJOR_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'avalanche-2', 'polkadot', 'chainlink', 'uniswap',
];

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'ETH', bsc: 'BSC', polygon: 'POLY', arbitrum: 'ARB',
  optimism: 'OP', base: 'BASE', solana: 'SOL', avalanche: 'AVAX',
};

const CAT_API_MAP: Record<string, string> = {
  all: 'top', majors: 'top', defi: 'defi',
  layer1: 'layer-1', layer2: 'layer-2', gaming: 'gaming',
  ai: 'ai', meme: 'meme', depin: 'depin',
};

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'majors', label: 'Majors' },
  { id: 'defi', label: 'DeFi' },
  { id: 'layer1', label: 'Layer 1' },
  { id: 'layer2', label: 'Layer 2' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'ai', label: 'AI' },
  { id: 'meme', label: 'Meme' },
  { id: 'depin', label: 'DePIN' },
];

function fmtPrice(p: number) {
  if (!p) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtMcap(n: number) {
  if (!n) return '';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export default function MarketDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<'prices' | 'watchlist'>('prices');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    mcap: 'all',
    priceChange: 'all',
    sortBy: 'market_cap',
  });
  const [pendingFilters, setPendingFilters] = useState({
    mcap: 'all',
    priceChange: 'all',
    sortBy: 'market_cap',
  });
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchlist');
      setWatchlist(stored ? JSON.parse(stored) : []);
    } catch {
      setWatchlist([]);
    }
  }, []);

  const fetchCoins = useCallback(async () => {
    setLoading(true);
    try {
      const apiCat = CAT_API_MAP[category] || 'top';
      const res = await fetch(`/api/market-data?category=${apiCat}&limit=100`);
      const data = await res.json();
      if (data.tokens && data.tokens.length > 0) {
        let rows: CoinRow[] = data.tokens.map((t: any, i: number) => ({
          id: t.id || t.symbol?.toLowerCase() || `coin-${i}`,
          symbol: t.symbol?.toUpperCase() || '',
          name: t.name || '',
          image: t.image || '',
          price: t.price || t.current_price || 0,
          change24h: t.change24h ?? t.price_change_percentage_24h ?? 0,
          marketCap: t.marketCap ?? t.market_cap ?? 0,
          volume24h: t.volume24h ?? t.total_volume ?? 0,
          rank: t.rank ?? t.market_cap_rank ?? i + 1,
          source: 'coingecko' as const,
        }));
        if (category === 'majors') {
          rows = rows.filter(c => MAJOR_IDS.includes(c.id));
        }
        setCoins(rows);
      } else {
        setCoins([]);
      }
    } catch {
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchCoins();
  }, [fetchCoins]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (search.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        const mapped: CoinRow[] = (Array.isArray(data) ? data : []).map((r: any) => ({
          id: r.id,
          symbol: r.symbol,
          name: r.name,
          image: r.thumb || '',
          price: r.price || 0,
          change24h: r.change24h || 0,
          marketCap: r.marketCap || 0,
          volume24h: 0,
          rank: 0,
          source: r.source === 'coingecko' ? 'coingecko' : 'dex',
          chain: r.chain,
          pairAddress: r.pairAddress,
        }));
        setSearchResults(mapped);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const displayCoins = useMemo(() => {
    let list: CoinRow[] = search.length >= 2
      ? (searchResults as CoinRow[])
      : (tab === 'watchlist' ? coins.filter(c => watchlist.includes(c.id)) : coins);

    if (filters.priceChange === 'gainers') list = list.filter(c => c.change24h > 0);
    if (filters.priceChange === 'losers') list = list.filter(c => c.change24h < 0);
    if (filters.priceChange === 'big_gainers') list = list.filter(c => c.change24h >= 5);
    if (filters.priceChange === 'big_losers') list = list.filter(c => c.change24h <= -5);

    if (filters.mcap === 'micro') list = list.filter(c => c.marketCap > 0 && c.marketCap < 10e6);
    if (filters.mcap === 'small') list = list.filter(c => c.marketCap >= 10e6 && c.marketCap < 100e6);
    if (filters.mcap === 'mid') list = list.filter(c => c.marketCap >= 100e6 && c.marketCap < 1e9);
    if (filters.mcap === 'large') list = list.filter(c => c.marketCap >= 1e9);

    if (filters.sortBy === 'change_desc') list = [...list].sort((a, b) => b.change24h - a.change24h);
    if (filters.sortBy === 'change_asc') list = [...list].sort((a, b) => a.change24h - b.change24h);
    if (filters.sortBy === 'volume') list = [...list].sort((a, b) => b.volume24h - a.volume24h);
    if (filters.sortBy === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);

    return list;
  }, [coins, searchResults, search, filters, tab, watchlist]);

  const handleCoinTap = (coin: CoinRow) => {
    if (coin.id && !coin.pairAddress) {
      router.push(`/market/prices/${coin.id}`);
    } else if (coin.pairAddress) {
      router.push(`/market/prices/${coin.id || coin.symbol.toLowerCase()}`);
    } else {
      router.push(`/market/prices/${coin.symbol.toLowerCase()}`);
    }
  };

  const toggleWatchlist = (e: React.MouseEvent, coinId: string) => {
    e.stopPropagation();
    setWatchlist(prev => {
      const next = prev.includes(coinId)
        ? prev.filter(id => id !== coinId)
        : [...prev, coinId];
      try { localStorage.setItem('watchlist', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const activeFilterCount =
    (filters.mcap !== 'all' ? 1 : 0) +
    (filters.priceChange !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'market_cap' ? 1 : 0);

  const openFilters = () => {
    setPendingFilters(filters);
    setShowFilters(true);
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setShowFilters(false);
  };

  const resetFilters = () => {
    const def = { mcap: 'all', priceChange: 'all', sortBy: 'market_cap' };
    setPendingFilters(def);
    setFilters(def);
    setShowFilters(false);
  };

  const removeFilter = (key: 'mcap' | 'priceChange' | 'sortBy') => {
    const defaults = { mcap: 'all', priceChange: 'all', sortBy: 'market_cap' };
    setFilters(prev => ({ ...prev, [key]: defaults[key] }));
  };

  const filterChipLabel = (key: string, val: string) => {
    if (key === 'mcap') {
      const map: Record<string, string> = { micro: 'Micro Cap', small: 'Small Cap', mid: 'Mid Cap', large: 'Large Cap' };
      return map[val] || val;
    }
    if (key === 'priceChange') {
      const map: Record<string, string> = { gainers: 'Gainers', losers: 'Losers', big_gainers: 'Big Gainers', big_losers: 'Big Losers' };
      return map[val] || val;
    }
    if (key === 'sortBy') {
      const map: Record<string, string> = { change_desc: 'Sort: Top Gainers', change_asc: 'Sort: Top Losers', volume: 'Sort: Volume', price_desc: 'Sort: Price' };
      return map[val] || val;
    }
    return val;
  };

  return (
    <div className="pb-4">
      {/* Prices | Watchlist sub-tab toggle */}
      <div className="flex gap-1 p-1 bg-[#111827] border border-white/[0.06] rounded-xl mb-4">
        {(['prices', 'watchlist'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${
              tab === t
                ? 'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t === 'prices' ? 'Prices' : 'Watchlist'}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or CA..."
            className="w-full pl-9 pr-10 py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A1EFF] animate-spin" />
          )}
          {search && !searching && (
            <button
              onClick={() => { setSearch(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={openFilters}
          className={`relative flex items-center justify-center w-10 h-10 bg-[#111827] border rounded-xl transition-all flex-shrink-0 ${
            activeFilterCount > 0
              ? 'border-[#0A1EFF]/60 text-[#0A1EFF]'
              : 'border-white/[0.06] text-gray-400 hover:text-white hover:border-[#0A1EFF]/30'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0A1EFF] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Category pills — horizontal scroll */}
      {tab === 'prices' && search.length < 2 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                category === cat.id
                  ? 'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]'
                  : 'bg-[#111827] text-gray-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filters.mcap !== 'all' && (
            <button
              onClick={() => removeFilter('mcap')}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0A1EFF]/10 border border-[#0A1EFF]/30 rounded-full text-xs text-[#0A1EFF] font-medium"
            >
              {filterChipLabel('mcap', filters.mcap)}
              <X className="w-3 h-3" />
            </button>
          )}
          {filters.priceChange !== 'all' && (
            <button
              onClick={() => removeFilter('priceChange')}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0A1EFF]/10 border border-[#0A1EFF]/30 rounded-full text-xs text-[#0A1EFF] font-medium"
            >
              {filterChipLabel('priceChange', filters.priceChange)}
              <X className="w-3 h-3" />
            </button>
          )}
          {filters.sortBy !== 'market_cap' && (
            <button
              onClick={() => removeFilter('sortBy')}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0A1EFF]/10 border border-[#0A1EFF]/30 rounded-full text-xs text-[#0A1EFF] font-medium"
            >
              {filterChipLabel('sortBy', filters.sortBy)}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#111827] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tab === 'watchlist' && watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Star className="w-8 h-8 text-gray-600" />
          <p className="text-gray-400 text-sm text-center">
            No coins saved.<br />
            Tap ☆ on any coin to save it.
          </p>
        </div>
      ) : coins.length === 0 && tab === 'prices' && search.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-gray-400 text-sm text-center">
            Market data unavailable.<br />Please retry in a moment.
          </p>
          <button
            onClick={fetchCoins}
            className="flex items-center gap-2 text-sm text-[#0A1EFF] hover:text-blue-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06]">
          {displayCoins.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm bg-[#111827]">
              {search.length >= 2 ? `No coins found for "${search}"` : 'No coins match the selected filters.'}
            </div>
          ) : (
            displayCoins.map((coin, i) => {
              const isPositive = coin.change24h >= 0;
              const inWatchlist = watchlist.includes(coin.id);
              return (
                <button
                  key={`${coin.id}-${i}`}
                  onClick={() => handleCoinTap(coin)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 text-left"
                >
                  {/* Logo */}
                  <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center">
                    {coin.image ? (
                      <img
                        src={coin.image}
                        alt={coin.symbol}
                        className="w-full h-full object-cover rounded-full"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-xs font-bold text-white">{coin.symbol.slice(0, 2)}</span>
                    )}
                  </div>

                  {/* Name + rank/chain */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate">{coin.name}</span>
                      {coin.source === 'dex' && coin.chain && (
                        <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded font-medium">
                          {CHAIN_LABEL[coin.chain] || coin.chain.slice(0, 4).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span className="font-mono">{coin.symbol}</span>
                      {coin.rank > 0 && <span className="text-gray-600">#{coin.rank}</span>}
                      {coin.marketCap > 0 && <span>{fmtMcap(coin.marketCap)}</span>}
                    </div>
                  </div>

                  {/* Price + change */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                    <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </div>
                  </div>

                  {/* Watchlist star */}
                  <button
                    onClick={e => toggleWatchlist(e, coin.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors hover:bg-white/[0.06]"
                    aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Star
                      className={`w-4 h-4 transition-colors ${inWatchlist ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                    />
                  </button>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Filter bottom sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
          />
          <div className="relative w-full bg-[#111827] rounded-t-2xl p-6 z-10 border-t border-white/[0.06] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sort By */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 'market_cap', label: 'Market Cap' },
                  { val: 'change_desc', label: 'Top Gainers' },
                  { val: 'change_asc', label: 'Top Losers' },
                  { val: 'volume', label: 'Volume' },
                  { val: 'price_desc', label: 'Price High→Low' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setPendingFilters(p => ({ ...p, sortBy: opt.val }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      pendingFilters.sortBy === opt.val
                        ? 'bg-[#0A1EFF] border-[#0A1EFF] text-white'
                        : 'bg-transparent border-white/[0.1] text-gray-400 hover:text-white hover:border-white/[0.2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Change */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Price Change</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 'all', label: 'All' },
                  { val: 'gainers', label: 'Gainers' },
                  { val: 'big_gainers', label: 'Big Gainers (>5%)' },
                  { val: 'losers', label: 'Losers' },
                  { val: 'big_losers', label: 'Big Losers (<-5%)' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setPendingFilters(p => ({ ...p, priceChange: opt.val }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      pendingFilters.priceChange === opt.val
                        ? 'bg-[#0A1EFF] border-[#0A1EFF] text-white'
                        : 'bg-transparent border-white/[0.1] text-gray-400 hover:text-white hover:border-white/[0.2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Cap */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Market Cap</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 'all', label: 'All' },
                  { val: 'micro', label: 'Micro (<$10M)' },
                  { val: 'small', label: 'Small ($10M–$100M)' },
                  { val: 'mid', label: 'Mid ($100M–$1B)' },
                  { val: 'large', label: 'Large (>$1B)' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setPendingFilters(p => ({ ...p, mcap: opt.val }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      pendingFilters.mcap === opt.val
                        ? 'bg-[#0A1EFF] border-[#0A1EFF] text-white'
                        : 'bg-transparent border-white/[0.1] text-gray-400 hover:text-white hover:border-white/[0.2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={applyFilters}
                className="flex-1 py-3.5 bg-[#0A1EFF] hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
              >
                Apply
              </button>
              <button
                onClick={resetFilters}
                className="px-5 py-3.5 text-gray-400 hover:text-white font-semibold text-sm transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
