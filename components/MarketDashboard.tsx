'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, SlidersHorizontal, X, TrendingUp, TrendingDown, Loader2, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWatchlist } from '@/hooks/market/useWatchlist';
import { resolveTokenChain } from '@/lib/market/tokenChainResolver';
import { TokenLogo } from '@/components/market/TokenLogo';

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
  // Token contract address for on-chain (dex) hits. Feeds the logo cascade
  // (DexScreener CDN then Trust Wallet registry keyed by CA + chain) so a coin
  // searched by name or pasted CA shows real art, not just a lettered avatar.
  address?: string;
  // A saved watchlist id that CoinGecko couldn't resolve to live market data
  // (e.g. a dex-only or delisted id). We keep it visible in an honest minimal
  // state rather than dropping it from the list.
  unresolved?: boolean;
}

// Honest placeholder for a saved coin id we couldn't resolve to live data.
// The card renders name/symbol derived from the id and a "data unavailable"
// note instead of fabricated price/change numbers — the coin stays in the
// watchlist and stays removable.
function minimalWatchRow(id: string): CoinRow {
  const name = id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id,
    symbol: id.slice(0, 6).toUpperCase(),
    name,
    image: '',
    price: 0,
    change24h: 0,
    marketCap: 0,
    volume24h: 0,
    rank: 0,
    sparkline: [],
    source: 'coingecko',
    unresolved: true,
  };
}

// Audit M1 #10 — was a frozen 10-token list. If SOL fell out of top
// 10, the pill still showed it; if PEPE climbed in, it was excluded.
// "Majors" now means top N by market cap from the live response,
// computed fresh on every render. Industry parity: CoinGecko /
// CoinMarketCap rank live, never hardcode.
const MAJORS_LIMIT = 10;

const CHAIN_LABEL: Record<string, string> = {
  ethereum:'ETH', bsc:'BSC', polygon:'POLY', arbitrum:'ARB',
  optimism:'OP', base:'BASE', solana:'SOL', avalanche:'AVAX',
};

// Maps UI category id -> CoinGecko category slug (their actual category
// IDs, not our shorthand). Earlier version used incorrect slugs like
// 'defi' which CoinGecko doesn't recognize, so the filter silently fell
// back to "top" and every category showed the same list. These are the
// real slugs (verified against /coins/categories/list).
const CAT_API_MAP: Record<string, string> = {
  all:         'top',
  majors:      'top',
  defi:        'decentralized-finance-defi',
  layer1:      'layer-1',
  layer2:      'layer-2',
  gaming:      'gaming',
  ai:          'artificial-intelligence',
  meme:        'meme-token',
  depin:       'depin',
  stocks:      'tokenized-stocks',
  commodities: 'real-world-assets-rwa',
  cults:       'cults',   // client-side post-filter — no CG category match
};

// Cults = culturally-driven tokens (community/brand). CoinGecko has no
// first-class category, so when cults is selected we fetch meme-token
// and filter to a curated list the platform recognizes as "cult".
const CULT_TOKENS = new Set([
  'dogecoin','shiba-inu','pepe','bonk','dogwifcoin','popcat','floki',
  'mog-coin','book-of-meme','brett-2','apu','goatseus-maximus','neiro',
  'fartcoin','moodeng','pnut','peanut-the-squirrel','chill-guy','turbo',
]);

const CATEGORIES = [
  { id:'all',         label:'All' },
  { id:'majors',      label:'Majors' },
  { id:'defi',        label:'DeFi' },
  { id:'layer1',      label:'Layer 1' },
  { id:'layer2',      label:'Layer 2' },
  { id:'gaming',      label:'Gaming' },
  { id:'ai',          label:'AI' },
  { id:'meme',        label:'Meme' },
  { id:'depin',       label:'DePIN' },
  { id:'stocks',      label:'Stocks' },
  { id:'commodities', label:'Commodities' },
  { id:'cults',       label:'Cults' },
];

function fmtPrice(p: number): string {
  if (!p) return '--';
  if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
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
  const { user } = useAuth();
  // Watchlist is server-owned: the /api/market/watchlist route derives the
  // user from the session and writes user_id itself. The previous inline
  // `supabase.from('watchlist').insert({ token_id })` omitted user_id, so
  // every insert failed (user_id is NOT NULL + RLS `auth.uid() = user_id`),
  // the optimistic star rolled back, and clicking appeared to "do nothing".
  const { watchlist, isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null, {
    onRequireAuth: () => router.push('/login?from=/dashboard'),
  });
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinCache = useRef<Map<string, CoinRow>>(new Map());

  useEffect(() => { setMounted(true); }, []);

  const fetchCoins = useCallback(async () => {
    setLoading(true);
    try {
      // Cults reuses meme-token fetch then client-side filters (see below)
      const apiCat = category === 'cults' ? CAT_API_MAP.meme : (CAT_API_MAP[category] || 'top');
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
        if (category === 'majors') {
          // Live top-N by market cap from the response itself, not a
          // frozen ID list. The CoinGecko endpoint already returns
          // the data sorted market_cap_desc in this category.
          rows = rows.slice(0, MAJORS_LIMIT);
        }
        // Cults is a curated subset of meme-token — CoinGecko has no
        // first-class category, so we fetch meme-token upstream (via
        // CAT_API_MAP) then post-filter to the platform's cult list.
        if (category === 'cults') rows = rows.filter(c => CULT_TOKENS.has(c.id));
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
    // Drop out-of-order responses so a slow earlier query can't overwrite the
    // results of the query the user is actually looking at now.
    let cancelled = false;
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(search)}`);
        const data = await res.json() as Record<string, unknown>[];
        if (cancelled) return;
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
          address:   r.contractAddress ? String(r.contractAddress) : undefined,
        }));
        setSearchResults(mapped);
      } catch { if (!cancelled) setSearchResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 350);
    return () => { cancelled = true; if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Watchlist rows are fetched by id, NOT filtered from the loaded page.
  // The old code did `watchlist.map(id => coinCache.get(id))`, so any saved
  // coin outside the currently-loaded category top-100 was simply absent from
  // the cache and silently dropped. Now we ask CoinGecko for exactly the saved
  // ids (/api/market/markets?ids=…) so every watchlisted coin renders with live
  // price/logo regardless of which category is loaded.
  const [watchlistCoins, setWatchlistCoins] = useState<CoinRow[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    // Only the watchlist tab needs this data; skip the fetch on the prices tab.
    if (tab !== 'watchlist') return;
    if (watchlist.length === 0) { setWatchlistCoins([]); setWatchlistLoading(false); return; }

    let cancelled = false;
    setWatchlistLoading(true);
    (async () => {
      const byId = new Map<string, CoinRow>();
      try {
        const res = await fetch(`/api/market/markets?ids=${encodeURIComponent(watchlist.join(','))}`);
        const data = await res.json() as { tokens?: Record<string, unknown>[] };
        if (cancelled) return;
        (data.tokens ?? []).forEach((t) => {
          const row: CoinRow = {
            id:        String(t.id ?? ''),
            symbol:    String(t.symbol ?? '').toUpperCase(),
            name:      String(t.name ?? ''),
            image:     String(t.image ?? ''),
            price:     Number(t.price ?? 0),
            change24h: Number(t.change24h ?? 0),
            marketCap: Number(t.marketCap ?? 0),
            volume24h: Number(t.volume24h ?? 0),
            rank:      Number(t.rank ?? 0),
            sparkline: Array.isArray(t.sparkline) ? t.sparkline as number[] : [],
            source:    'coingecko' as const,
          };
          if (row.id) { byId.set(row.id, row); coinCache.current.set(row.id, row); }
        });
      } catch {
        // Network/upstream failure — fall through and resolve each id from the
        // cache (populated by the prices tab) or a minimal placeholder below.
      }
      if (cancelled) return;
      // Preserve EVERY saved id, in saved order: live row → cached row →
      // honest minimal placeholder. Nothing is ever dropped.
      setWatchlistCoins(
        watchlist.map((id) => byId.get(id) ?? coinCache.current.get(id) ?? minimalWatchRow(id)),
      );
      setWatchlistLoading(false);
    })();

    return () => { cancelled = true; };
  }, [tab, watchlist]);

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
    // Audit M2 — route directly to the canonical coin-detail page.
    // Previously this pushed to /market/prices/[tokenId], a server-side
    // redirect-only page that bounced to /dashboard/market/ethereum/{id};
    // users saw a brief flicker and a URL-bar flash. Going straight to
    // the destination matches DexScreener / Birdeye one-click behaviour.
    // Per-token chain routing (so SOL doesn't land on ethereum) is the
    // dedicated fix in branch #4 fix/market-routing-honesty.
    // Bug §3a — was hardcoded to /market/ethereum/{id}. Route to
    // each token's canonical native chain (BTC → bitcoin, SOL → solana,
    // XRP → xrp, etc.) so the terminal header doesn't label them ETHEREUM.
    // A dex search hit already carries its real chain + contract address, so
    // route there directly instead of forcing it onto ethereum by id/symbol;
    // CoinGecko coins have no explicit chain, so resolve the native one.
    const chain = coin.chain || resolveTokenChain({ id: coin.id, symbol: coin.symbol }).chain;
    const target = coin.address || coin.id || coin.symbol.toLowerCase();
    router.push(`/dashboard/market/${chain}/${target}`);
  };

  // Optimistic toggle backed by the shared useWatchlist hook, which POSTs to
  // /api/market/watchlist (server derives + writes user_id) and rolls back on
  // failure. stopPropagation keeps the star from also triggering the row's
  // navigate-to-token tap; a signed-out click prompts sign-in via onRequireAuth.
  const handleToggleWatch = (e: React.MouseEvent, coinId: string) => {
    e.stopPropagation();
    void toggleWatchlist(coinId);
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
          <button onClick={() => setShowFilters(false)} aria-label="Close filters" className="text-gray-400 hover:text-white"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort By</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[{v:'market_cap',l:'Market Cap'},{v:'change_desc',l:'Top Gainers'},{v:'change_asc',l:'Top Losers'},{v:'volume',l:'Volume'},{v:'price_desc',l:'Price ↓'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,sortBy:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.sortBy===o.v?'bg-[#0066FF] border-[#0066FF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Price Change</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[{v:'all',l:'All'},{v:'gainers',l:'Gainers'},{v:'big_gainers',l:'Big Gainers (>5%)'},{v:'losers',l:'Losers'},{v:'big_losers',l:'Big Losers (<-5%)'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,priceChange:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.priceChange===o.v?'bg-[#0066FF] border-[#0066FF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Market Cap</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {[{v:'all',l:'All'},{v:'micro',l:'Micro (<$10M)'},{v:'small',l:'Small ($10M–$100M)'},{v:'mid',l:'Mid ($100M–$1B)'},{v:'large',l:'Large (>$1B)'}].map(o=>(
            <button key={o.v} onClick={()=>setPendingFilters(p=>({...p,mcap:o.v}))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${pendingFilters.mcap===o.v?'bg-[#0066FF] border-[#0066FF] text-white':'bg-transparent border-white/[0.1] text-gray-400 hover:text-white'}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={()=>{setFilters(pendingFilters);setShowFilters(false);}}
            className="flex-1 py-3.5 bg-[#0066FF] hover:bg-blue-600 text-white font-bold rounded-xl transition-colors">
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
      <div
        className="flex gap-1 p-1 rounded-xl mb-4 nl-glass"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
      >
        {(['prices','watchlist'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${t===tab?'text-white':'text-gray-400 hover:text-white'}`}
            style={t===tab ? { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 18px rgba(0,102,255,.55), inset 0 1px 0 rgba(255,255,255,.22)' } : {}}>
            {t==='prices'?'Prices':'Watchlist'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name or CA..."
            className="w-full ps-9 pe-10 py-2.5 nl-glass rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
            style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }} />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0066FF] animate-spin" />}
          {search && !searching && (
            <button onClick={()=>{setSearch('');setSearchResults([]);}}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {tab === 'prices' && (
          <button onClick={()=>{setPendingFilters(filters);setShowFilters(true);}}
            className={`relative flex items-center justify-center w-10 h-10 bg-[#111827] border rounded-xl transition-all flex-shrink-0 ${activeFilterCount>0?'border-[#0066FF]/60 text-[#0066FF]':'border-white/[0.06] text-gray-400 hover:text-white'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0066FF] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {tab === 'prices' && search.length < 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide" style={{scrollbarWidth:'none'}}>
          {CATEGORIES.map(cat=>(
            <button key={cat.id} onClick={()=>setCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${category===cat.id?'text-white nl-glass':'bg-white/[0.03] text-gray-400 hover:text-white border border-[#0066FF]/15'}`}
              style={category===cat.id
                ? { background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 14px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.2)' }
                : { boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'watchlist' && (
        watchlistLoading && watchlistCoins.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({length:4}).map((_,i)=>(
              <div key={i} className="h-32 bg-[#111827] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : watchlistCoins.length === 0 ? (
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
                  className="bg-[#111827] border border-white/[0.06] rounded-xl p-3 cursor-pointer hover:border-[#0066FF]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TokenLogo src={coin.image || undefined} symbol={coin.symbol} address={coin.address} chain={coin.chain} size={32} />
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[72px]">{coin.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{coin.symbol}</div>
                      </div>
                    </div>
                    <button onClick={e=>handleToggleWatch(e,coin.id)} className="p-1 hover:scale-110 transition-transform" aria-label="Remove from watchlist">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    </button>
                  </div>
                  {coin.unresolved ? (
                    // Saved id CoinGecko couldn't resolve — stay honest: no
                    // fabricated price/change, just a clear "unavailable" note.
                    // The coin remains visible and removable via the star.
                    <div className="text-[10px] text-gray-500 mt-1">Live data unavailable</div>
                  ) : (
                    <>
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
                    </>
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
            <button onClick={fetchCoins} className="text-sm text-[#0066FF] hover:text-blue-400 transition-colors">Retry</button>
          </div>
        ) : (
          <div className="space-y-0 rounded-xl overflow-hidden border border-white/[0.06]">
            {displayCoins.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm bg-[#111827]">
                {search.length>=2 ? `No results for "${search}"` : 'No coins match the filters.'}
              </div>
            ) : displayCoins.map((coin,i)=>{
              const pos = coin.change24h >= 0;
              const inWl = isWatched(coin.id);
              return (
                <div key={`${coin.id}-${i}`} role="button" tabIndex={0}
                  onClick={()=>handleCoinTap(coin)}
                  onKeyDown={e=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); handleCoinTap(coin); } }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0 text-start cursor-pointer">
                  <div className="w-6 text-end text-[11px] text-gray-500 flex-shrink-0 font-mono">
                    {coin.rank > 0 ? coin.rank : ''}
                  </div>
                  <TokenLogo src={coin.image || undefined} symbol={coin.symbol} address={coin.address} chain={coin.chain} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-white truncate min-w-0">{coin.name}</span>
                      {coin.source==='dex' && coin.chain && (
                        <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-[#0066FF]/20 text-[#0066FF] rounded font-medium">
                          {CHAIN_LABEL[coin.chain]||coin.chain.slice(0,4).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span className="font-mono">{coin.symbol}</span>
                      {coin.marketCap > 0 && <span>{fmtMcap(coin.marketCap)}</span>}
                    </div>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                    <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${pos?'text-emerald-400':'text-red-400'}`}>
                      {pos?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                      {pos?'+':''}{coin.change24h.toFixed(2)}%
                    </div>
                  </div>
                  <button onClick={e=>handleToggleWatch(e,coin.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors hover:bg-white/[0.06]"
                    aria-label={inWl?'Remove from watchlist':'Add to watchlist'}>
                    <Star className={`w-4 h-4 transition-colors ${inWl?'text-yellow-400 fill-yellow-400':'text-gray-600'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {mounted && createPortal(filterModal, document.body)}
    </div>
  );
}