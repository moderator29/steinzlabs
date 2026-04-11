'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, SlidersHorizontal, X, TrendingUp, TrendingDown,
  ChevronRight, RefreshCw, AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  pairAddress?: string;
  chain?: string;
  isSearchResult?: boolean;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(p: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(10)}`;
}

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1e9) return `Vol $${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Vol $${(n / 1e6).toFixed(1)}M`;
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Markets() {
  const router = useRouter();

  // Coin list state
  const [coins, setCoins]           = useState<CoinRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMcap, setTotalMcap]   = useState('');
  const [mcapChange, setMcapChange] = useState({ val: 0, positive: true });

  // Search state
  const [search, setSearch]                 = useState('');
  const [searchResults, setSearchResults]   = useState<CoinRow[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch top 100 from CoinGecko (via server-side route, no CORS) ──────────
  const fetchCoins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setLoadError(false); }

    try {
      const res = await fetch('/api/market-data?category=top&limit=100', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const rows: CoinRow[] = (data.tokens || []).map((t: any) => ({
        id:         t.id || t.symbol?.toLowerCase() || '',
        symbol:     (t.symbol || '').toUpperCase(),
        name:       t.name || t.symbol || '',
        image:      t.image || '',
        price:      Number(t.price ?? 0),
        change24h:  Number(t.change24h ?? 0),
        marketCap:  Number(t.marketCap ?? 0),
        volume24h:  Number(t.volume24h ?? 0),
        rank:       Number(t.rank ?? 0),
      }));
      setCoins(rows);

      // Global mcap from CoinGecko data — compute total
      const totalMc = rows.reduce((s, r) => s + r.marketCap, 0);
      if (totalMc > 0) {
        setTotalMcap(totalMc >= 1e12 ? `$${(totalMc / 1e12).toFixed(2)}T` : `$${(totalMc / 1e9).toFixed(1)}B`);
      }
      const totalVol = rows.reduce((s, r) => s + r.volume24h, 0);
      const wChange  = rows.reduce((s, r) => s + r.change24h * r.volume24h, 0);
      const avg      = totalVol > 0 ? wChange / totalVol : 0;
      setMcapChange({ val: Math.abs(avg), positive: avg >= 0 });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCoins(); }, [fetchCoins]);

  // ── Search: local filter first, then DexScreener for CA/name ──────────────
  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    // 1. Instant local match
    const local = coins.filter(c =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.symbol.toLowerCase().includes(q.toLowerCase())
    );
    if (local.length > 0) {
      setSearchResults(local.slice(0, 20));
    }

    // 2. DexScreener search after 350ms — searches by CA, name, symbol, any chain
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const pairs: any[] = data.pairs || [];

        const dexRows: CoinRow[] = pairs
          .slice(0, 30)
          .map((p: any) => ({
            id:           p.pairAddress || p.baseToken?.address || '',
            symbol:       (p.baseToken?.symbol || '').toUpperCase(),
            name:         p.baseToken?.name || p.baseToken?.symbol || '',
            image:        p.info?.imageUrl || '',
            price:        parseFloat(p.priceUsd || '0'),
            change24h:    p.priceChange?.h24 ?? 0,
            marketCap:    p.marketCap ?? p.fdv ?? 0,
            volume24h:    p.volume?.h24 ?? 0,
            rank:         0,
            pairAddress:  p.pairAddress,
            chain:        p.chainId,
            isSearchResult: true,
          }))
          .filter(r => r.symbol && r.price > 0);

        // Merge: local CoinGecko hits first, then DEX results not already shown
        const combined = [...local];
        for (const d of dexRows) {
          if (!combined.find(c => c.symbol === d.symbol && !c.isSearchResult)) {
            combined.push(d);
          }
        }
        setSearchResults(combined.slice(0, 30));
      } catch { /* non-critical */ }
      finally { setSearchLoading(false); }
    }, 350);
  };

  const handleCoinTap = (coin: CoinRow) => {
    if (coin.pairAddress) {
      router.push(
        `/dashboard/market?symbol=${coin.symbol}&name=${encodeURIComponent(coin.name)}&pair=${coin.pairAddress}&chain=${coin.chain || ''}`
      );
    } else {
      router.push(
        `/dashboard/market?symbol=${coin.symbol}&name=${encodeURIComponent(coin.name)}&coin=${coin.id}`
      );
    }
  };

  const displayCoins = search.length >= 2 ? searchResults : coins;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="pb-4">

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {totalMcap && (
            <div className="text-xs text-gray-500">
              Total: {totalMcap}&nbsp;
              <span className={mcapChange.positive ? 'text-[#0A1EFF] font-semibold' : 'text-red-400 font-semibold'}>
                {mcapChange.positive ? '+' : '-'}{mcapChange.val.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => fetchCoins(true)}
          className="text-gray-500 hover:text-white p-1 transition-colors"
          style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or CA..."
            className="w-full pl-9 pr-9 py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          )}
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center justify-center w-10 h-10 bg-[#111827] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 transition-all flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Coin list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading markets...</span>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-8 h-8 text-gray-600" />
          <span className="text-sm text-gray-500">Failed to load data</span>
          <button onClick={() => fetchCoins()} className="text-xs text-[#0A1EFF] underline">
            Retry
          </button>
        </div>
      ) : displayCoins.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          {search.length >= 2 ? `No results for "${search}"` : 'No coins found'}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-white/[0.06]">
          {displayCoins.map((coin, i) => {
            const isPos = coin.change24h >= 0;
            const sub   = coin.isSearchResult
              ? (coin.chain ? coin.chain.toUpperCase() : 'DEX')
              : (fmtMcap(coin.marketCap) || fmtVol(coin.volume24h) || coin.symbol);
            return (
              <button
                key={`${coin.id}-${i}`}
                onClick={() => handleCoinTap(coin)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0 text-left"
              >
                {/* Rank */}
                <div className="w-5 text-right text-[11px] text-gray-600 flex-shrink-0 font-mono">
                  {coin.rank > 0 ? coin.rank : ''}
                </div>

                {/* Logo */}
                <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-[#0A1EFF]/10 flex items-center justify-center">
                  {coin.image ? (
                    <img
                      src={coin.image}
                      alt={coin.symbol}
                      className="w-full h-full object-cover rounded-full"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-xs font-bold text-[#0A1EFF]">
                      {coin.symbol.slice(0, 2)}
                    </span>
                  )}
                </div>

                {/* Name + sub */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{coin.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">{sub}</div>
                </div>

                {/* Price + change */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                  <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isPos ? 'text-[#0A1EFF]' : 'text-red-400'}`}>
                    {isPos
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />
                    }
                    {isPos ? '+' : ''}{Number(coin.change24h).toFixed(2)}%
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-700 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Filter bottom sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
          />
          <div className="relative w-full bg-[#0D1117] rounded-t-2xl p-6 z-10 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-white">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-0">
              {[
                { label: 'Blockchain', value: 'All Chains' },
                { label: 'Market Cap', value: 'All' },
                { label: 'Price Change', value: 'All' },
                { label: 'Timeframe', value: '24H' },
              ].map(f => (
                <div
                  key={f.label}
                  className="flex items-center justify-between py-4 border-b border-white/[0.06]"
                >
                  <span className="text-sm text-gray-300">{f.label}</span>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>{f.value}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-6 py-4 font-bold rounded-xl text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
