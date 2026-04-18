'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, SlidersHorizontal, X, TrendingUp, TrendingDown, Loader2, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
  sparkline: number[];
  source: 'coingecko' | 'dex';
  chain?: string;
  pairAddress?: string;
}

const MAJOR_IDS = [
  'bitcoin','ethereum','solana','binancecoin','ripple',
  'cardano','avalanche-2','polkadot','chainlink','uniswap',
];

const CHAIN_LABEL: Record<string, string> = {
  ethereum:'ETH', bsc:'BSC', polygon:'POLY', arbitrum:'ARB',
  optimism:'OP', base:'BASE', solana:'SOL', avalanche:'AVAX',
};

const CAT_API_MAP: Record<string, string> = {
  all:'top', majors:'top', defi:'defi',
  layer1:'layer-1', layer2:'layer-2', gaming:'gaming',
  ai:'ai', meme:'meme', depin:'depin',
};

const CATEGORIES = [
  { id:'all', label:'All' }, { id:'majors', label:'Majors' },
  { id:'defi', label:'DeFi' }, { id:'layer1', label:'Layer 1' },
  { id:'layer2', label:'Layer 2' }, { id:'gaming', label:'Gaming' },
  { id:'ai', label:'AI' }, { id:'meme', label:'Meme' },
  { id:'depin', label:'DePIN' },
];

function fmtPrice(p: number): string {
  if (!p) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtMcap(n: number): string {
  if (!n) return '';
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) return null;
  const step = Math.ceil(data.length / 60);
  const pts = data.filter((_, i) => i % step === 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 100; const H = 40;
  const points = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * W},${H - ((v - min) / range) * (H - 4) + 2}`
  ).join(' ');
  const color = isPositive ? '#22c55e' : '#ef4444';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function MarketDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<'prices' | 'watchlist'>('prices');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({ mcap:'all', priceChange:'all', sortBy:'market_cap' });
  const [pendingFilters, setPendingFilters] = useState({ mcap:'all', priceChange:'all', sortBy:'market_cap' });
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [searchResults, setSearchResults] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinCache = useRef<Map<string, CoinRow>>(new Map());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('steinz_watchlist');
      if (stored) setWatchlist(JSON.parse(stored));
    } catch { /* ignore */ }
    void Promise.resolve(supabase.from('watchlist').select('token_id')).then(({ data }) => {
      if (data && data.length > 0) {
        const ids = data.map((r: { token_id: string }) => r.token_id);
        setWatchlist(ids);
        try { localStorage.setItem('steinz_watchlist', JSON.stringify(ids)); } catch { /* ignore */ }
      }
    }).catch((err: unknown) => console.error('[MarketDashboard] Watchlist load failed:', err instanceof Error ? err.message : err));
  }, []);

  const fetchCoins = useCallback(async () => {
    setLoading(true);
    try {
      const apiCat = CAT_API_MAP[category] || 'top';
      const res = await fetch(`/api/market-data?category=${apiCat}&limit=100`);
      const data = await res.json() as { tokens?: Record<string, unknown>[] };
      if (data.tokens && data.tokens.length > 0) {
        let rows: CoinRow[] = data.tokens.map((t, i) => ({
          id:       String(t.id ?? t.symbol ?? `coin-${i}`),
          symbol:   String(t.symbol ?? '').toUpperCase(),
          name:     String(t.name ?? ''),
          image:    String(t.image ?? ''),
          price:    Number(t.price ?? 0),
          change24h: Number(t.change24h ?? 0),
          marketCap: Number(t.marketCap ?? 0),
          volume24h: Number(t.volume24h ?? 0),
          rank:     Number(t.rank ?? i + 1),
          sparkline: Array.isArray(t.sparkline) ? t.sparkline as number[] : [],
          source:   'coingecko' as const,
        }));
        if (category === 'majors') rows = rows.filter(c => MAJOR_IDS.includes(c.id));
        rows.forEach(r => coinCache.current.set(r.id, r));
        setCoins(rows);
      } else { setCoins([]); }
    } catch { setCoins([]); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { fetchCoins(); }, [fetchCoins]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (search.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(search)}`);
        const data = await res.json() as Record<string, unknown>[];
        const mapped: CoinRow[] = (Array.isArray(data) ? data : []).map(r => ({
          id:        String(r.id ?? ''),
          symbol:    String(r.symbol ?? ''),
          name:      String(r.name ?? ''),
          image:     String(r.thumb ?? ''),
          price:     Number(r.price ?? 0),
          change24h: Number(r.change24h ?? 0),
          marketCap: Number(r.marketCap ?? 0),
          volume24h: 0,
          rank:      0,
          sparkline: [],
          source:    r.source === 'coingecko' ? 'coingecko' : 'dex',
          chain:     r.chain ? String(r.chain) : undefined,
          pairAddress: r.pairAddress ? String(r.pairAddress) : undefined,
        }));
        setSearchResults(mapped);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const watchlistCoins = useMemo<CoinRow[]>(() => {
    return watchlist
      .map(id => coinCache.current.get(id))
      .filter((c): c is CoinRow => c !== undefined);
  }, [watchlist, coins]);

  const displayCoins = useMemo<CoinRow[]>(() => {
    if (tab === 'watchlist') return watchlistCoins;
    let list = search.length >= 2 ? searchResults : coins;
    if (filters.priceChange === 'gainers')    list = list.filter(c => c.change24h > 0);
    if (filters.priceChange === 'losers')     list = list.filter(c => c.change24h < 0);
    if (filters.priceChange === 'big_gainers') list = list.filter(c => c.change24h >= 5);
    if (filters.priceChange === 'big_losers')  list = list.filter(c => c.change24h <= -5);
    if (filters.mcap === 'micro') list = list.filter(c => c.marketCap > 0 && c.marketCap < 10e6);
    if (filters.mcap === 'small') list = list.filter(c => c.marketCap >= 10e6 && c.marketCap < 100e6);
    if (filters.mcap === 'mid')   list = list.filter(c => c.marketCap >= 100e6 && c.marketCap < 1e9);
    if (filters.mcap === 'large') list = list.filter(c => c.marketCap >= 1e9);
    if (filters.sortBy === 'change_desc') list = [...list].sort((a,b) => b.change24h - a.change24h);
    if (filters.sortBy === 'change_asc')  list = [...list].sort((a,b) => a.change24h - b.change24h);
    if (filters.sortBy === 'volume')      list = [...list].sort((a,b) => b.volume24h - a.volume24h);
    if (filters.sortBy === 'price_desc')  list = [...list].sort((a,b) => b.price - a.price);
    return list;
  }, [coins, searchResults, search, filters, tab, watchlistCoins]);

  const handleCoinTap = (coin: CoinRow) => {
    try { localStorage.setItem('steinz_last_tab', 'markets'); } catch { /* localStorage unavailable — silently ignore */ }
    router.push(`/market/prices/${coin.id || coin.symbol.toLowerCase()}`);
  };

  const toggleWatchlist = (e: React.MouseEvent, coinId: string) => {
    e.stopPropagation();
    setWatchlist(prev => {
      const isAdding = !prev.includes(coinId);
      const next = isAdding ? [...prev, coinId] : prev.filter(id => id !== coinId);
      try { localStorage.setItem('steinz_watchlist', JSON.stringify(next)); } catch { /* ignore */ }
      if (isAdding) {
        void Promise.resolve(supabase.from('watchlist').insert({ token_id: coinId })).catch((err: unknown) =>
          console.error('[MarketDashboard] Watchlist add failed:', err instanceof Error ? err.message : err)
        );
      } else {
        void Promise.resolve(supabase.from('watchlist').delete().eq('token_id', coinId)).catch((err: unknown) =>
          console.error('[MarketDashboard] Watchlist remove failed:', err instanceof Error ? err.message : err)
        );
      }
      return next;
    });
  };

  const activeFilterCount =
    (filters.mcap !== 'all' ? 1 : 0) +
    (filters.priceChange !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'market_cap' ? 1 : 0);

  const filterModal = showFilters ? (
    <div className="fixed inset-0 z-40 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
      <div className="relative w-full bg-[#111827] rounded-t-2xl p-6 z-10 border-t border-white/[0.06] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Filters</h3>
          <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort By</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[{v:'market_cap',l:'Market Cap'},{v:'change_desc',l:'Top Gainers'},{v:'change_asc',l:'Top Losers'},{v:'volume',l:'Volume'},{v:'price_desc',l:'Price ↓'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,sortBy:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.sortBy===o.v?'bg-[#0A1EFF] border-[#0A1EFF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Price Change</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[{v:'all',l:'All'},{v:'gainers',l:'Gainers'},{v:'big_gainers',l:'Big Gainers (>5%)'},{v:'losers',l:'Losers'},{v:'big_losers',l:'Big Losers (<-5%)'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,priceChange:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.priceChange===o.v?'bg-[#0A1EFF] border-[#0A1EFF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Market Cap</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {[{v:'all',l:'All'},{v:'micro',l:'Micro (<$10M)'},{v:'small',l:'Small ($10M–$100M)'},{v:'mid',l:'Mid ($100M–$1B)'},{v:'large',l:'Large (>$1B)'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,mcap:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.mcap===o.v?'bg-[#0A1EFF] border-[#0A1EFF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={()=>{setFilters(pendingFilters);setShowFilters(false);}}
            className="flex-1 py-3.5 bg-[#0A1EFF] hover:bg-blue-600 text-white font-bold rounded-xl transition-colors">
            Apply
          </button>
          <button onClick={()=>{const d={mcap:'all',priceChange:'all',sortBy:'market_cap'};setPendingFilters(d);setFilters(d);setShowFilters(false);}}
            className="px-5 py-3.5 text-gray-400 hover:text-white font-semibold text-sm transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="pb-4">
      <div className="flex gap-1 p-1 bg-[#111827] border border-white/[0.06] rounded-xl mb-4">
        {(['prices','watchlist'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${t===tab?'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]':'text-gray-400 hover:text-white'}`}>
            {t==='prices'?'Prices':'Watchlist'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name or CA..."
            className="w-full pl-9 pr-10 py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A1EFF] animate-spin" />}
          {search && !searching && (
            <button onClick={()=>{setSearch('');setSearchResults([]);}}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {tab === 'prices' && (
          <button onClick={()=>{setPendingFilters(filters);setShowFilters(true);}}
            className={`relative flex items-center justify-center w-10 h-10 bg-[#111827] border rounded-xl transition-all flex-shrink-0 ${activeFilterCount>0?'border-[#0A1EFF]/60 text-[#0A1EFF]':'border-white/[0.06] text-gray-400 hover:text-white'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0A1EFF] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {tab === 'prices' && search.length < 2 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide" style={{scrollbarWidth:'none'}}>
          {CATEGORIES.map(cat=>(
            <button key={cat.id} onClick={()=>setCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${category===cat.id?'bg-[#0A1EFF] text-white shadow-[0_0_10px_rgba(10,30,255,0.35)]':'bg-[#111827] text-gray-400 hover:text-white border border-white/[0.06]'}`}>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'watchlist' && !loading && (
        watchlistCoins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Star className="w-8 h-8 text-gray-600" />
            <p className="text-gray-400 text-sm text-center">No coins saved yet.<br/>Tap ☆ on any coin to add it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {watchlistCoins.map(coin=>{
              const pos = coin.change24h >= 0;
              return (
                <div key={coin.id} onClick={()=>handleCoinTap(coin)}
                  className="bg-[#111827] border border-white/[0.06] rounded-xl p-3 cursor-pointer hover:border-[#0A1EFF]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center">
                        {coin.image
                          ? <img src={coin.image} alt={coin.symbol} className="w-full h-full object-cover rounded-full" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
                          : <span className="text-[10px] font-bold text-white">{coin.symbol.slice(0,2)}</span>}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[72px]">{coin.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{coin.symbol}</div>
                      </div>
                    </div>
                    <button onClick={e=>toggleWatchlist(e,coin.id)} className="p-1 hover:scale-110 transition-transform">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    </button>
                  </div>
                  {coin.marketCap > 0 && (
                    <div className="text-[10px] text-gray-500 mb-1 font-mono">{fmtMcap(coin.marketCap)}</div>
                  )}
                  <div className="text-sm font-bold font-mono text-white">{fmtPrice(coin.price)}</div>
                  <div className={`text-xs font-semibold flex items-center gap-0.5 mb-2 ${pos?'text-emerald-400':'text-red-400'}`}>
                    {pos?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                    {pos?'+':''}{coin.change24h.toFixed(2)}%
                  </div>
                  {coin.sparkline.length > 1 && (
                    <div className="h-10 w-full">
                      <MiniSparkline data={coin.sparkline} isPositive={pos} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'prices' && (
        loading ? (
          <div className="space-y-2">
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} className="h-16 bg-[#111827] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : coins.length === 0 && search.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-gray-400 text-sm text-center">Market data unavailable.<br/>Please retry.</p>
            <button onClick={fetchCoins} className="text-sm text-[#0A1EFF] hover:text-blue-400 transition-colors">Retry</button>
          </div>
        ) : (
          <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06]">
            {displayCoins.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm bg-[#111827]">
                {search.length>=2 ? `No results for "${search}"` : 'No coins match the filters.'}
              </div>
            ) : displayCoins.map((coin,i)=>{
              const pos = coin.change24h >= 0;
              const inWl = watchlist.includes(coin.id);
              return (
                <button key={`${coin.id}-${i}`} onClick={()=>handleCoinTap(coin)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 text-left">
                  <div className="w-6 text-right text-[11px] text-gray-500 flex-shrink-0 font-mono">
                    {coin.rank > 0 ? coin.rank : ''}
                  </div>
                  <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center">
                    {coin.image
                      ? <img src={coin.image} alt={coin.symbol} className="w-full h-full object-cover rounded-full" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
                      : <span className="text-xs font-bold text-white">{coin.symbol.slice(0,2)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate">{coin.name}</span>
                      {coin.source==='dex' && coin.chain && (
                        <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded font-medium">
                          {CHAIN_LABEL[coin.chain]||coin.chain.slice(0,4).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span className="font-mono">{coin.symbol}</span>
                      {coin.marketCap > 0 && <span>{fmtMcap(coin.marketCap)}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                    <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${pos?'text-emerald-400':'text-red-400'}`}>
                      {pos?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                      {pos?'+':''}{coin.change24h.toFixed(2)}%
                    </div>
                  </div>
                  <button onClick={e=>toggleWatchlist(e,coin.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors hover:bg-white/[0.06]"
                    aria-label={inWl?'Remove from watchlist':'Add to watchlist'}>
                    <Star className={`w-4 h-4 transition-colors ${inWl?'text-yellow-400 fill-yellow-400':'text-gray-600'}`} />
                  </button>
                </button>
              );
            })}
          </div>
        )
      )}

      {mounted && createPortal(filterModal, document.body)}
    </div>
  );
}