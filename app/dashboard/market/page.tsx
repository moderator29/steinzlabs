'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Star, ArrowLeft, SlidersHorizontal,
  ChevronRight, Loader2, RefreshCw, TrendingUp, TrendingDown,
  ArrowUpDown, ChevronDown, Zap,
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
  source: string;
  address?: string;
  rank?: number;
}

type TimeframeId = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

interface FilterState {
  category: string;
  blockchain: string;
  marketCap: string;
  priceChange: string;
  timeframe: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
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

// ─── Coin Logo ────────────────────────────────────────────────────────────────
function CoinLogo({ token, size = 48 }: { token: MarketToken; size?: number }) {
  const [err, setErr] = useState(false);
  if (!err && token.logo) {
    return (
      <img
        src={token.logo}
        alt={token.symbol}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    );
  }
  const palette = ['#F97316', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
  const bg = palette[token.symbol.charCodeAt(0) % palette.length];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.33,
      }}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

// ─── Lightweight Area Chart ───────────────────────────────────────────────────
function CoinChart({
  prices,
  isPositive,
  height = 260,
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
      const color = isPositive ? '#22C55E' : '#EF4444';

      chart = createChart(el, {
        width: el.clientWidth,
        height,
        layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(255,255,255,0.2)' },
          horzLine: { color: 'rgba(255,255,255,0.2)' },
        },
        handleScroll: false,
        handleScale: false,
      });

      const area = chart.addAreaSeries({
        lineColor: color,
        topColor: isPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const sorted = [...prices].sort((a, b) => a[0] - b[0]);
      area.setData(sorted.map(([ts, val]) => ({ time: Math.floor(ts / 1000) as any, value: val })));
      chart.timeScale().fitContent();
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        chartRef.current?.applyOptions({ width: el.clientWidth });
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
function BuyModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const [amount, setAmount] = useState('0');
  const [pct, setPct] = useState(0);

  const press = (k: string) => {
    if (k === '⌫') {
      setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (k === '.' && amount.includes('.')) {
      return;
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
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        className="relative w-full z-10 rounded-t-2xl"
        style={{ background: '#1C1C1C', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <span className="font-bold text-white text-lg">Buy {token.symbol}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-5xl font-bold text-white font-mono">${amount}</span>
            <button className="ml-1 text-gray-500 hover:text-white transition-colors">
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-1">
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#22C55E' }}
          />
          <div className="flex justify-between mt-1.5">
            {['0%', '25%', '50%', '75%', 'MAX'].map(l => (
              <span key={l} className="text-[11px]" style={{ color: '#6B7280' }}>{l}</span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="text-sm" style={{ color: '#6B7280' }}>Available</span>
          <span className="text-sm font-mono text-white">$0.00</span>
        </div>

        <div className="grid grid-cols-3 gap-0 px-2 py-1">
          {keys.map(k => (
            <button
              key={k}
              onClick={() => press(k)}
              className="py-4 text-xl font-semibold text-white rounded-xl transition-colors active:bg-white/10 hover:bg-white/5"
            >
              {k === '⌫' ? (
                <span className="flex items-center justify-center">
                  <X className="w-5 h-5 text-gray-400" />
                </span>
              ) : k}
            </button>
          ))}
        </div>

        <div className="px-5 pt-1 pb-7">
          <button
            className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98]"
            style={{ background: '#22C55E' }}
          >
            Connect Wallet
          </button>
          <p className="text-center text-xs mt-2" style={{ color: '#6B7280' }}>0.1% fee</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
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
  const cats = ['Crypto', 'Stocks', 'Commodities', 'Forex'];
  const rows: { key: keyof FilterState; label: string; value: string }[] = [
    { key: 'blockchain', label: 'Blockchain', value: local.blockchain },
    { key: 'marketCap', label: 'Market Cap', value: local.marketCap },
    { key: 'priceChange', label: 'Price Change', value: local.priceChange },
    { key: 'timeframe', label: 'Timeframe', value: local.timeframe },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        className="relative w-full z-10 rounded-t-2xl"
        style={{ background: '#1C1C1C', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <span className="text-lg font-bold text-white">Filters</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setLocal(prev => ({ ...prev, category: c.toLowerCase() }))}
              className="flex-1 py-3 text-sm font-semibold relative transition-colors"
              style={{ color: local.category === c.toLowerCase() ? '#fff' : '#6B7280' }}
            >
              {c}
              {local.category === c.toLowerCase() && (
                <div
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: '#22C55E' }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="px-5">
          {rows.map(row => (
            <div
              key={row.key}
              className="flex items-center justify-between py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-sm" style={{ color: '#9CA3AF' }}>{row.label}</span>
              <div className="flex items-center gap-1 text-sm font-medium text-white">
                {row.value}
                <ChevronRight className="w-4 h-4" style={{ color: '#6B7280' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          <button
            onClick={() => { onApply(local); onClose(); }}
            className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98]"
            style={{ background: '#22C55E' }}
          >
            Apply Filters
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Coin Detail ──────────────────────────────────────────────────────────────
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
  const isUp = token.change24h >= 0;
  const isFav = favorites.has(token.symbol);
  const TIMEFRAMES: TimeframeId[] = ['1H', '6H', '1D', '1W', '1M', '1Y', 'ALL'];

  const loadChart = useCallback(async (timeframe: TimeframeId) => {
    setChartLoading(true);
    try {
      const id = token.address || token.symbol.toLowerCase();
      const res = await fetch(`/api/coin-chart?id=${encodeURIComponent(id)}&tf=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        if (data.prices?.length) setPrices(data.prices);
      }
    } catch {
      // chart unavailable
    } finally {
      setChartLoading(false);
    }
  }, [token]);

  useEffect(() => { loadChart(tf); }, [tf, loadChart]);

  const stats = [
    { label: 'Liquidity', value: '--' },
    { label: 'Mcap', value: fmtCompact(token.marketCap) },
    { label: 'FDV', value: token.marketCap ? fmtCompact(token.marketCap) : '--' },
    { label: 'Supply', value: '--' },
    { label: 'Vol 5m', value: '--' },
    { label: 'Vol 24h', value: fmtCompact(token.volume24h) },
    { label: '24h', value: `${isUp ? '+' : ''}${token.change24h?.toFixed(2)}%`, colored: true },
    { label: 'Holders', value: '--' },
    { label: 'Chain', value: token.chain !== 'multi' ? token.chain.toUpperCase() : '--' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#111111' }}>
      <div
        className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-1.5 font-bold text-white">
          {token.name}
          <span className="text-sm font-normal" style={{ color: '#6B7280' }}>{token.symbol}</span>
          <ChevronDown className="w-4 h-4" style={{ color: '#6B7280' }} />
        </button>
        <button onClick={() => onToggleFav(token.symbol)} className="p-1 transition-colors">
          <Star
            className="w-5 h-5"
            style={{
              color: isFav ? '#F59E0B' : '#6B7280',
              fill: isFav ? '#F59E0B' : 'none',
            }}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-2">
          <div className="text-4xl font-bold text-white font-mono">{fmtPrice(token.price)}</div>
          <div
            className="flex items-center gap-1 mt-1.5 text-base font-semibold"
            style={{ color: isUp ? '#22C55E' : '#EF4444' }}
          >
            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isUp ? '+' : ''}{token.change24h?.toFixed(2)}%
          </div>
        </div>

        <div className="relative" style={{ height: 260 }}>
          {chartLoading && prices.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#22C55E' }} />
            </div>
          ) : prices.length > 0 ? (
            <CoinChart prices={prices} isPositive={isUp} height={260} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm" style={{ color: '#6B7280' }}>Chart unavailable</span>
            </div>
          )}
        </div>

        <div
          className="flex items-center px-3 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                background: tf === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tf === t ? '#fff' : '#6B7280',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-5 pt-4 pb-2">
          <div
            className="text-[11px] font-bold uppercase tracking-widest mb-3"
            style={{ color: '#6B7280' }}
          >
            Key Stats
          </div>
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label}>
                <div className="text-[10px] mb-0.5" style={{ color: '#6B7280' }}>{s.label}</div>
                <div
                  className="text-sm font-bold font-mono"
                  style={{
                    color: (s as any).colored
                      ? (isUp ? '#22C55E' : '#EF4444')
                      : '#fff',
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {token.address && (
          <div className="px-5 pt-2 pb-4">
            <div
              className="text-[10px] uppercase tracking-widest mb-1.5"
              style={{ color: '#6B7280' }}
            >
              Contract
            </div>
            <div
              className="px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-xs font-mono break-all" style={{ color: '#9CA3AF' }}>
                {token.address}
              </span>
            </div>
          </div>
        )}

        <div className="h-24" />
      </div>

      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}
      >
        <button
          onClick={onBuy}
          className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.98]"
          style={{ background: '#22C55E' }}
        >
          Buy {token.symbol}
        </button>
      </div>
    </div>
  );
}

// ─── Coin Row ─────────────────────────────────────────────────────────────────
function CoinRow({ token, rank, onClick }: { token: MarketToken; rank: number; onClick: () => void }) {
  const isUp = token.change24h >= 0;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <span
        className="text-[11px] w-5 text-center flex-shrink-0 font-mono"
        style={{ color: '#6B7280' }}
      >
        {rank}
      </span>
      <CoinLogo token={token} size={48} />
      <div className="flex-1 min-w-0 text-left">
        <div className="font-bold text-white text-sm truncate">{token.name}</div>
        <div className="text-[12px] mt-0.5 font-mono" style={{ color: '#6B7280' }}>
          {fmtCompact(token.marketCap)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="font-bold text-white text-sm font-mono">{fmtPrice(token.price)}</span>
        <span
          className="text-[12px] font-semibold"
          style={{ color: isUp ? '#22C55E' : '#EF4444' }}
        >
          {isUp ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const router = useRouter();
  const [view, setView] = useState<'prices' | 'trade'>('prices');
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

  useEffect(() => {
    try {
      const s = localStorage.getItem('steinz-market-favs');
      if (s) setFavorites(new Set(JSON.parse(s)));
    } catch {}
  }, []);

  const toggleFav = (sym: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      try { localStorage.setItem('steinz-market-favs', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market?tab=trending&chain=all', { signal: ctrl.signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setTokens((data.tokens || []).map((t: MarketToken, i: number) => ({ ...t, rank: i + 1 })));
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError('Failed to load market data.');
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => { clearInterval(iv); abortRef.current?.abort(); };
  }, [load]);

  const totalMcap = tokens.reduce((s, t) => s + (t.marketCap || 0), 0);
  const enrichedTokens = tokens.filter(t => t.marketCap > 0);
  const avgChange = enrichedTokens.length
    ? enrichedTokens.reduce((s, t) => s + t.change24h, 0) / enrichedTokens.length
    : 0;

  const filtered = tokens.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.address?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Detail view ──────────────────────────────────────────────────────────────
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
        <AnimatePresence>
          {buyOpen && (
            <BuyModal token={selected} onClose={() => setBuyOpen(false)} />
          )}
        </AnimatePresence>
      </AnimatePresence>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111111' }}>
      {/* Tab strip */}
      <div
        className="flex items-center gap-5 px-4 pt-5 pb-0 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button className="pb-3 transition-colors" style={{ color: '#6B7280' }}>
          <Star className="w-4 h-4" />
        </button>
        {(['prices', 'trade'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="pb-3 text-sm font-semibold capitalize relative transition-colors"
            style={{ color: view === v ? '#fff' : '#6B7280' }}
          >
            {v === 'prices' ? 'Prices' : 'Trade'}
            {view === v && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-white" />
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={load}
          disabled={loading}
          className="pb-3 transition-colors"
          style={{ color: '#6B7280' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {view === 'trade' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <Zap className="w-8 h-8" style={{ color: '#22C55E' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Trade Coming Soon</h3>
            <p className="text-sm max-w-xs" style={{ color: '#6B7280' }}>
              Direct on-chain trading. Coming soon for STEINZ Premium.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/swap')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: '#22C55E' }}
          >
            Go to Swap
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7280' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or CA"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="transition-colors hover:text-white"
                  style={{ color: '#6B7280' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Total market cap */}
          {totalMcap > 0 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <span className="text-[12px] font-mono" style={{ color: '#6B7280' }}>
                Total: {fmtCompact(totalMcap)}{' '}
                <span style={{ color: avgChange >= 0 ? '#22C55E' : '#EF4444' }}>
                  {avgChange >= 0 ? '▲' : '▼'}{Math.abs(avgChange).toFixed(2)}%
                </span>
              </span>
            </div>
          )}

          {/* Token list */}
          <div className="flex-1 overflow-y-auto">
            {loading && tokens.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#22C55E' }} />
                <span className="text-sm" style={{ color: '#6B7280' }}>Loading market data…</span>
              </div>
            )}

            {error && tokens.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
                <span className="text-sm text-red-400">{error}</span>
                <button
                  onClick={load}
                  className="text-xs hover:underline"
                  style={{ color: '#22C55E' }}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && tokens.length > 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <span className="text-sm" style={{ color: '#6B7280' }}>No tokens match your search.</span>
                <button
                  onClick={() => setSearch('')}
                  className="text-xs hover:underline"
                  style={{ color: '#22C55E' }}
                >
                  Clear search
                </button>
              </div>
            )}

            <AnimatePresence>
              {filtered.map((token, idx) => (
                <motion.div
                  key={`${token.symbol}__${token.source}__${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.35) }}
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
                <span className="text-[10px]" style={{ color: '#374151' }}>
                  {filtered.length} assets · updates every 30s
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {filterOpen && (
          <FilterModal
            filters={filters}
            onApply={setFilters}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
