'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Star, ArrowLeft, SlidersHorizontal,
  ChevronRight, Loader2, RefreshCw, TrendingUp, TrendingDown,
  Zap, Flame, BarChart2, Layers, Lock, DollarSign, LineChart, Package,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MarketToken {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  logo: string;
  chain: string;
  source: 'coingecko' | 'dexscreener' | 'pumpfun' | 'pumpswap' | 'binance' | 'okx';
  address?: string;
  pairAddress?: string;
  dexChain?: string;
  liquidity?: number;
  rank?: number;
}

type TabId = 'trending' | 'launches' | 'cex' | 'all';
type TimeframeId = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  if (p >= 0.000001) return `$${p.toFixed(8)}`;
  return `$${p.toFixed(10)}`;
}

function fmtCompact(n: number): string {
  if (!n) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ─── Coin Logo ─────────────────────────────────────────────────────────────────
function CoinLogo({ token, size = 40 }: { token: MarketToken; size?: number }) {
  const [err, setErr] = useState(false);
  if (!err && token.logo) {
    return (
      <img
        src={token.logo}
        alt={token.symbol}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={() => setErr(true)}
      />
    );
  }
  const colors = ['#0A1EFF', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626'];
  const bg = colors[token.symbol.charCodeAt(0) % colors.length];
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.34 }}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

// ─── Lightweight Chart (area/line) ────────────────────────────────────────────
function CoinChart({
  prices,
  isPositive,
  height = 240,
}: {
  prices: [number, number][];
  isPositive: boolean;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !prices.length) return;

    let chart: any = null;

    (async () => {
      const { createChart, CrosshairMode } = await import('lightweight-charts');
      const el = containerRef.current!;
      const color = isPositive ? '#10B981' : '#EF4444';

      chart = createChart(el, {
        width: el.clientWidth,
        height,
        layout: { background: { color: 'transparent' }, textColor: '#9CA3AF' },
        grid: { vertLines: { visible: false }, horzLines: { color: '#1F2937' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#374151' }, horzLine: { color: '#374151' } },
        handleScroll: false,
        handleScale: false,
      });

      const area = chart.addAreaSeries({
        lineColor: color,
        topColor: isPositive ? '#10B98120' : '#EF444420',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });

      const sorted = [...prices].sort((a, b) => a[0] - b[0]);
      const chartData = sorted.map(([ts, val]) => ({
        time: Math.floor(ts / 1000) as any,
        value: val,
      }));

      area.setData(chartData);
      chart.timeScale().fitContent();
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        if (el && chartRef.current) {
          chartRef.current.applyOptions({ width: el.clientWidth });
        }
      });
      ro.observe(el);
    })();

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [prices, isPositive, height]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({
  token,
  onClose,
}: {
  token: MarketToken;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('0');
  const [pct, setPct] = useState(0);

  const handleKey = (k: string) => {
    if (k === '⌫') {
      setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (k === '.' && amount.includes('.')) {
      // no-op
    } else if (k === '.' && amount === '0') {
      setAmount('0.');
    } else if (amount === '0' && k !== '.') {
      setAmount(k);
    } else {
      if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
      setAmount(prev => prev + k);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#111827] rounded-t-2xl border-t border-white/[0.08] z-10 pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="font-bold text-white text-lg">Buy {token.symbol}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount display */}
        <div className="px-5 py-2 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-bold text-white font-mono">
              ${amount}
            </span>
            <button className="text-gray-500 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slider */}
        <div className="px-5 py-4">
          <input
            type="range"
            min={0}
            max={100}
            step={25}
            value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full accent-[#10B981]"
          />
          <div className="flex justify-between text-[11px] text-gray-500 mt-1">
            {['0%', '25%', '50%', '75%', 'MAX'].map(l => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">Available</span>
            <span className="text-xs text-white font-mono">$0.00</span>
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-px bg-white/[0.04] mx-5 rounded-xl overflow-hidden border border-white/[0.06]">
          {keys.map(k => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              className="py-4 text-white text-xl font-semibold bg-[#0D1117] hover:bg-white/[0.06] active:bg-white/[0.10] transition-colors"
            >
              {k}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pt-4 pb-2">
          <button className="w-full py-4 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-lg rounded-xl transition-colors">
            Connect Wallet
          </button>
          <p className="text-center text-[11px] text-gray-600 mt-2">0.1% fee · Powered by STEINZ</p>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
interface FilterState {
  category: 'crypto' | 'stocks' | 'commodities' | 'forex';
  blockchain: string;
  marketCap: string;
  priceChange: string;
  timeframe: string;
}

function FilterModal({
  filters,
  onApply,
  onClose,
}: {
  filters: FilterState;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(filters);

  const categories = [
    { id: 'crypto', label: 'Crypto' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'commodities', label: 'Commodities' },
    { id: 'forex', label: 'Forex' },
  ] as const;

  const filterRows = [
    { label: 'Blockchain', key: 'blockchain', value: local.blockchain || 'All Chains' },
    { label: 'Market Cap', key: 'marketCap', value: local.marketCap || 'All' },
    { label: 'Price Change', key: 'priceChange', value: local.priceChange || 'All' },
    { label: 'Timeframe', key: 'timeframe', value: local.timeframe || '24H' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#111827] rounded-t-2xl border-t border-white/[0.08] z-10">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <span className="font-bold text-white text-lg">Filters</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex border-b border-white/[0.06]">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setLocal(prev => ({ ...prev, category: c.id }))}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                local.category === c.id ? 'text-white' : 'text-gray-500'
              }`}
            >
              {c.label}
              {local.category === c.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#10B981] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Filter rows */}
        <div className="px-5">
          {filterRows.map(row => (
            <div
              key={row.key}
              className="flex items-center justify-between py-4 border-b border-white/[0.04]"
            >
              <span className="text-sm text-gray-400">{row.label}</span>
              <div className="flex items-center gap-1 text-sm text-white font-medium">
                <span>{row.value}</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          <button
            onClick={() => { onApply(local); onClose(); }}
            className="w-full py-4 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-base rounded-xl transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coin Detail (full-page slide-in) ─────────────────────────────────────────
function CoinDetail({
  token,
  favorites,
  onToggleFav,
  onClose,
  onBuy,
}: {
  token: MarketToken;
  favorites: Set<string>;
  onToggleFav: (sym: string) => void;
  onClose: () => void;
  onBuy: () => void;
}) {
  const [tf, setTf] = useState<TimeframeId>('1D');
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const isPositive = token.change24h >= 0;
  const isFav = favorites.has(token.symbol);
  const TIMEFRAMES: TimeframeId[] = ['1H', '6H', '1D', '1W', '1M', '1Y', 'ALL'];

  const loadChart = useCallback(async (timeframe: TimeframeId) => {
    setChartLoading(true);
    try {
      const coinId = token.address || token.symbol.toLowerCase();
      const res = await fetch(`/api/coin-chart?id=${encodeURIComponent(coinId)}&tf=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        if (data.prices?.length) setPrices(data.prices);
      }
    } catch {
      // Chart data unavailable — show placeholder
    } finally {
      setChartLoading(false);
    }
  }, [token]);

  useEffect(() => { loadChart(tf); }, [tf, loadChart]);

  const keyStats = [
    { label: 'Liquidity', value: token.liquidity ? fmtCompact(token.liquidity) : '--' },
    { label: 'Mcap', value: fmtCompact(token.marketCap) },
    { label: 'FDV', value: token.marketCap ? fmtCompact(token.marketCap) : '--' },
    { label: 'Supply', value: '--' },
    { label: 'Vol 5m', value: '--' },
    { label: 'Vol 24h', value: fmtCompact(token.volume24h) },
    { label: '24h', value: `${token.change24h >= 0 ? '+' : ''}${token.change24h?.toFixed(2)}%`, colored: true },
    { label: 'Holders', value: '--' },
    { label: 'Chain', value: token.chain !== 'multi' ? token.chain.toUpperCase() : '--' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E1A] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <CoinLogo token={token} size={28} />
          <span className="font-bold text-white">{token.name}</span>
          <span className="text-gray-400 text-sm">{token.symbol}</span>
        </div>
        <button
          onClick={() => onToggleFav(token.symbol)}
          className="text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <Star className={`w-5 h-5 ${isFav ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Price hero */}
        <div className="px-5 pt-4 pb-2">
          <div className="text-4xl font-bold text-white font-mono">{fmtPrice(token.price)}</div>
          <div className={`flex items-center gap-1 mt-1 text-base font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? '+' : ''}{token.change24h?.toFixed(2)}%
          </div>
        </div>

        {/* Chart */}
        <div className="relative" style={{ height: 240 }}>
          {chartLoading && prices.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#0A1EFF] animate-spin" />
            </div>
          ) : prices.length > 0 ? (
            <CoinChart prices={prices} isPositive={isPositive} height={240} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-600 text-sm">Chart unavailable</span>
            </div>
          )}
        </div>

        {/* Timeframe picker */}
        <div className="flex items-center gap-0 px-4 py-3 border-b border-white/[0.04]">
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                tf === t
                  ? 'bg-white/[0.12] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* KEY STATS */}
        <div className="px-5 pt-4 pb-2">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
            Key Stats
          </div>
          <div className="grid grid-cols-3 gap-4">
            {keyStats.map(stat => (
              <div key={stat.label}>
                <div className="text-[10px] text-gray-500 mb-0.5">{stat.label}</div>
                <div className={`text-sm font-bold font-mono ${
                  stat.colored
                    ? (token.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')
                    : 'text-white'
                }`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contract address */}
        {token.address && (
          <div className="px-5 pt-2 pb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Contract</div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-300 font-mono break-all">{token.address}</span>
            </div>
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* Sticky buy button */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.06] bg-[#0A0E1A]">
        <button
          onClick={onBuy}
          className="w-full py-4 bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-black font-bold text-lg rounded-xl transition-colors"
        >
          Buy {token.symbol}
        </button>
      </div>
    </div>
  );
}

// ─── Coin Row ─────────────────────────────────────────────────────────────────
function CoinRow({
  token,
  rank,
  onClick,
}: {
  token: MarketToken;
  rank: number;
  onClick: () => void;
}) {
  const isUp = token.change24h >= 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors border-b border-white/[0.03] text-left"
    >
      {/* Rank */}
      <span className="text-[11px] text-gray-600 w-5 text-center flex-shrink-0 font-mono">{rank}</span>

      {/* Logo */}
      <CoinLogo token={token} size={40} />

      {/* Name + mcap */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm">{token.name}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">{fmtCompact(token.marketCap)}</div>
      </div>

      {/* Price + change */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="font-bold text-white text-sm font-mono">{fmtPrice(token.price)}</span>
        <span className={`text-xs font-semibold flex items-center gap-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'launches', label: 'New', icon: Zap },
  { id: 'cex', label: 'CEX', icon: BarChart2 },
  { id: 'all', label: 'All', icon: Layers },
];

const COMING_SOON_TABS = [
  { id: 'stocks', label: 'Stocks', icon: LineChart },
  { id: 'forex', label: 'Forex', icon: DollarSign },
  { id: 'commodities', label: 'Commodities', icon: Package },
] as const;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('trending');
  const [comingSoonTab, setComingSoonTab] = useState<string | null>(null);
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MarketToken | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    category: 'crypto',
    blockchain: 'All Chains',
    marketCap: 'All',
    priceChange: 'All',
    timeframe: '24H',
  });
  const abortRef = useRef<AbortController | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('steinz-market-favorites');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const toggleFav = (sym: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      try { localStorage.setItem('steinz-market-favorites', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const loadTokens = useCallback(async (tab: TabId) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market?tab=${tab}&chain=all`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setTokens(data.tokens?.map((t: MarketToken, i: number) => ({ ...t, rank: i + 1 })) || []);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError('Failed to load market data.');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!comingSoonTab) {
      loadTokens(activeTab);
      const iv = setInterval(() => loadTokens(activeTab), 30_000);
      return () => { clearInterval(iv); abortRef.current?.abort(); };
    }
  }, [activeTab, comingSoonTab, loadTokens]);

  const filtered = tokens.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || (t.address?.toLowerCase().includes(q) ?? false);
  });

  // ── If detail is open ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="detail"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-50"
        >
          <CoinDetail
            token={selected}
            favorites={favorites}
            onToggleFav={toggleFav}
            onClose={() => setSelected(null)}
            onBuy={() => setBuyOpen(true)}
          />
        </motion.div>
        {buyOpen && (
          <BuyModal
            token={selected}
            onClose={() => setBuyOpen(false)}
          />
        )}
      </AnimatePresence>
    );
  }

  // ── Market list ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Markets</h1>
          <p className="text-xs text-gray-500 mt-0.5">Live prices across DEX, CEX &amp; launches</p>
        </div>
        <button
          onClick={() => loadTokens(activeTab)}
          disabled={loading}
          className="text-gray-500 hover:text-white transition-colors p-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search bar + filter */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or CA"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.10] transition-colors flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0 px-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setComingSoonTab(null); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold relative transition-colors ${
              activeTab === id && !comingSoonTab ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {activeTab === id && !comingSoonTab && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0A1EFF] rounded-full" />
            )}
          </button>
        ))}
        {COMING_SOON_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setComingSoonTab(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold relative transition-colors ${
              comingSoonTab === id ? 'text-[#F59E0B]' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {comingSoonTab === id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#F59E0B] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Coming soon overlay */}
      {comingSoonTab && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
            <Lock className="w-10 h-10 text-[#F59E0B]" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2 capitalize">{comingSoonTab} Coming Soon</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              {comingSoonTab === 'stocks'
                ? 'Real-time stock prices and institutional trading intelligence. Coming soon for Premium members.'
                : comingSoonTab === 'forex'
                ? 'FX currency pairs with live rates and AI-powered trend signals. Coming soon.'
                : 'Gold, oil, silver, and commodity markets. Available with our upcoming Premium plan.'}
            </p>
          </div>
          <div className="px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl text-[#F59E0B] text-xs font-semibold">
            Premium Feature · Coming Soon
          </div>
          <button onClick={() => setComingSoonTab(null)} className="text-xs text-gray-500 hover:text-gray-300 underline">
            Back to Crypto
          </button>
        </div>
      )}

      {/* Token list */}
      {!comingSoonTab && (
        <div className="flex-1 overflow-y-auto">
          {loading && tokens.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 text-[#0A1EFF] animate-spin" />
              <span className="text-gray-500 text-sm">Loading market data…</span>
            </div>
          )}

          {error && tokens.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
              <span className="text-red-400 text-sm">{error}</span>
              <button onClick={() => loadTokens(activeTab)} className="text-xs text-[#0A1EFF] hover:underline">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && tokens.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-gray-500 text-sm">No tokens match your search.</span>
              <button onClick={() => setSearch('')} className="text-xs text-[#0A1EFF] hover:underline">
                Clear search
              </button>
            </div>
          )}

          <AnimatePresence>
            {filtered.map((token, idx) => (
              <motion.div
                key={`${token.symbol}__${token.source}__${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.4) }}
              >
                <CoinRow
                  token={token}
                  rank={token.rank ?? idx + 1}
                  onClick={() => setSelected(token)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {tokens.length > 0 && (
            <div className="py-5 text-center">
              <span className="text-[10px] text-gray-600">
                {filtered.length} assets · auto-refreshes every 30s
                {loading && ' · updating…'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filter modal */}
      {filterOpen && (
        <FilterModal
          filters={filters}
          onApply={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
