'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Star, ArrowLeft, ChevronRight,
  Loader2, RefreshCw, TrendingUp, TrendingDown,
  Copy, Check, ExternalLink, ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DexToken {
  id: string;
  name: string;
  symbol: string;
  imageUri?: string;
  contractAddress: string;
  chain: string;
  price?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  change24h?: number;
  createdAt?: number;
  graduated?: boolean;
  dexUrl?: string;
  pairAddress?: string;
}

interface OHLCCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type DexTab = 'pumpfun' | 'pumpswap' | 'bonk' | 'fourmeme' | 'raydium' | 'newpairs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p?: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1)          return `$${p.toFixed(2)}`;
  if (p >= 0.01)       return `$${p.toFixed(4)}`;
  if (p >= 0.0001)     return `$${p.toFixed(6)}`;
  if (p >= 0.000001)   return `$${p.toFixed(8)}`;
  if (p)               return `$${p.toFixed(10)}`;
  return '--';
}

function fmtCompact(n?: number): string {
  if (!n) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ms?: number): string {
  if (!ms) return '--';
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Build synthetic OHLC candles from current price + 24h change
function buildSyntheticOHLC(price: number, change24h: number): OHLCCandle[] {
  const now = Math.floor(Date.now() / 1000);
  const points = 24;
  const startPrice = price / (1 + change24h / 100);
  const candles: OHLCCandle[] = [];
  let prev = startPrice;

  for (let i = 0; i < points; i++) {
    const t = now - (points - 1 - i) * 3600;
    const progress = i / (points - 1);
    const trend = startPrice + (price - startPrice) * progress;
    const vol = price * 0.012;
    const open  = prev;
    const close = trend + (Math.random() - 0.5) * vol;
    const high  = Math.max(open, close) + Math.random() * vol * 0.4;
    const low   = Math.min(open, close) - Math.random() * vol * 0.4;
    candles.push({ time: t, open, high, low: Math.max(1e-12, low), close, volume: Math.random() * 1e6 });
    prev = close;
  }
  candles[candles.length - 1].close = price;
  return candles;
}

// ─── Token Logo ───────────────────────────────────────────────────────────────
function TokenLogo({ token, size = 48 }: { token: DexToken; size?: number }) {
  const [err, setErr] = useState(false);
  if (!err && token.imageUri) {
    return (
      <img src={token.imageUri} alt={token.symbol} width={size} height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setErr(true)} />
    );
  }
  const palette = ['#F97316', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
  const bg = palette[(token.symbol || 'X').charCodeAt(0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.33,
    }}>
      {(token.symbol || '??').slice(0, 2)}
    </div>
  );
}

// ─── Candlestick + Volume Chart ───────────────────────────────────────────────
function CandleChart({ candles, height = 300 }: { candles: OHLCCandle[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;

    (async () => {
      const { createChart, CrosshairMode } = await import('lightweight-charts');
      const el = containerRef.current!;

      const chart = createChart(el, {
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

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22C55E', downColor: '#EF4444',
        borderUpColor: '#22C55E', borderDownColor: '#EF4444',
        wickUpColor: '#22C55E', wickDownColor: '#EF4444',
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0.02 } });

      const sorted = [...candles].sort((a, b) => a.time - b.time);
      const seen = new Set<number>();
      const unique = sorted.filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });

      candleSeries.setData(unique as any);
      volumeSeries.setData(unique.map(c => ({
        time: c.time as any,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
      })));

      chart.timeScale().fitContent();
      chartRef.current = chart;

      const ro = new ResizeObserver(() => { chartRef.current?.applyOptions({ width: el.clientWidth }); });
      ro.observe(el);
    })();

    return () => { chartRef.current?.remove(); chartRef.current = null; };
  }, [candles, height]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}

// ─── Trade Modal ──────────────────────────────────────────────────────────────
function TradeModal({
  token, mode, onClose,
}: {
  token: DexToken;
  mode: 'buy' | 'sell';
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState('0');
  const [pct, setPct] = useState(0);
  const isBuy = mode === 'buy';

  const press = (k: string) => {
    if (k === '⌫') { setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    if (k === '.' && amount.includes('.')) return;
    if (k === '.' && amount === '0') { setAmount('0.'); return; }
    if (amount === '0' && k !== '.') { setAmount(k); return; }
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    setAmount(prev => prev + k);
  };

  const confirm = () => {
    const params = new URLSearchParams({
      tokenIn:  isBuy ? 'USDC'         : token.symbol,
      tokenOut: isBuy ? token.symbol   : 'USDC',
      amount,
      ca:       token.contractAddress,
      chain:    token.chain || 'solana',
    });
    onClose();
    router.push(`/dashboard/swap?${params.toString()}`);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  const accent = isBuy ? '#22C55E' : '#EF4444';

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        className="relative w-full z-10 rounded-t-2xl"
        style={{ background: '#1C1C1C', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          <span className="font-bold text-white text-lg">{isBuy ? 'Buy' : 'Sell'} {token.symbol}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 pb-2 flex items-center gap-2">
          <span className="text-xs" style={{ color: '#6B7280' }}>Price:</span>
          <span className="text-sm font-mono font-bold text-white">{fmtPrice(token.price)}</span>
        </div>
        <div className="px-5 py-3 text-center">
          <span className="text-5xl font-bold text-white font-mono">${amount}</span>
        </div>
        <div className="px-5 pb-1">
          <input type="range" min={0} max={100} value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: accent }} />
          <div className="flex justify-between mt-1.5">
            {['0%','25%','50%','75%','MAX'].map(l => (
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
            <button key={k} onClick={() => press(k)}
              className="py-4 text-xl font-semibold text-white rounded-xl transition-colors active:bg-white/10 hover:bg-white/5">
              {k === '⌫' ? <span className="flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></span> : k}
            </button>
          ))}
        </div>
        <div className="px-5 pt-1 pb-7">
          <button onClick={confirm}
            className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98]"
            style={{ background: accent }}>
            {isBuy ? 'Buy' : 'Sell'} on STEINZ
          </button>
          <p className="text-center text-xs mt-2" style={{ color: '#6B7280' }}>0.1% fee · Powered by STEINZ</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Token Detail ─────────────────────────────────────────────────────────────
function TokenDetail({
  token, favorites, onToggleFav, onClose,
}: {
  token: DexToken;
  favorites: Set<string>;
  onToggleFav: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [tradeModal, setTradeModal] = useState<'buy' | 'sell' | null>(null);
  const isUp = (token.change24h ?? 0) >= 0;
  const isFav = favorites.has(token.id);

  // Try Binance klines first, fall back to synthetic OHLC
  const [candles, setCandles] = useState<OHLCCandle[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setChartLoading(true);
      try {
        const res = await fetch(`/api/coin-ohlc?symbol=${encodeURIComponent(token.symbol)}&tf=1D`);
        if (res.ok) {
          const data = await res.json();
          if (data.candles?.length > 0) { setCandles(data.candles); return; }
        }
      } catch {}
      // Fall back to synthetic
      if (token.price) setCandles(buildSyntheticOHLC(token.price, token.change24h ?? 0));
      setChartLoading(false);
    })();
  }, [token]);

  const copy = () => {
    navigator.clipboard.writeText(token.contractAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: 'Price',    value: fmtPrice(token.price) },
    { label: 'Mcap',     value: fmtCompact(token.marketCap) },
    { label: 'Liquidity',value: fmtCompact(token.liquidity) },
    { label: 'Vol 24h',  value: fmtCompact(token.volume24h) },
    { label: '24h',      value: `${isUp ? '+' : ''}${(token.change24h ?? 0).toFixed(2)}%`, colored: true },
    { label: 'Chain',    value: token.chain.toUpperCase() },
    { label: 'Created',  value: timeAgo(token.createdAt) },
    { label: 'Status',   value: token.graduated ? 'Graduated' : 'Live' },
    { label: 'Pair',     value: token.pairAddress ? shortAddr(token.pairAddress) : '--' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#111111' }}>
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <TokenLogo token={token} size={24} />
            <button className="flex items-center gap-1 font-bold text-white">
              {token.name}
              <span className="text-sm font-normal" style={{ color: '#6B7280' }}>{token.symbol}</span>
              <ChevronDown className="w-4 h-4" style={{ color: '#6B7280' }} />
            </button>
          </div>
          <button onClick={() => onToggleFav(token.id)} className="p-1 transition-colors">
            <Star className="w-5 h-5"
              style={{ color: isFav ? '#F59E0B' : '#6B7280', fill: isFav ? '#F59E0B' : 'none' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-4 pb-2">
            <div className="text-4xl font-bold text-white font-mono">{fmtPrice(token.price)}</div>
            <div className="flex items-center gap-1 mt-1.5 text-base font-semibold"
              style={{ color: isUp ? '#22C55E' : '#EF4444' }}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isUp ? '+' : ''}{(token.change24h ?? 0).toFixed(2)}%
            </div>
          </div>

          <div className="relative" style={{ height: 300 }}>
            {chartLoading && candles.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#22C55E' }} />
              </div>
            ) : candles.length > 0 ? (
              <CandleChart candles={candles} height={300} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm" style={{ color: '#6B7280' }}>Chart unavailable</span>
              </div>
            )}
          </div>

          <div className="px-5 pt-4 pb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6B7280' }}>
              Key Stats
            </div>
            <div className="grid grid-cols-3 gap-4">
              {stats.map(s => (
                <div key={s.label}>
                  <div className="text-[10px] mb-0.5" style={{ color: '#6B7280' }}>{s.label}</div>
                  <div className="text-sm font-bold font-mono"
                    style={{ color: (s as any).colored ? (isUp ? '#22C55E' : '#EF4444') : '#fff' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {token.contractAddress && (
            <div className="px-5 pt-2 pb-2">
              <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#6B7280' }}>Contract</div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="flex-1 text-xs font-mono break-all" style={{ color: '#9CA3AF' }}>{token.contractAddress}</span>
                <button onClick={copy} className="flex-shrink-0 transition-colors">
                  {copied
                    ? <Check className="w-4 h-4" style={{ color: '#22C55E' }} />
                    : <Copy className="w-4 h-4" style={{ color: '#6B7280' }} />
                  }
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 px-5 py-3">
            <button
              onClick={() => router.push(`/dashboard/security?ca=${token.contractAddress}`)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
              Scan Contract
            </button>
            {token.dexUrl && (
              <a href={token.dexUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                <ExternalLink className="w-4 h-4" /> Chart
              </a>
            )}
          </div>

          <div className="px-5 py-3 text-center">
            <span className="text-xs" style={{ color: '#6B7280' }}>Connect wallet to see portfolio</span>
          </div>

          <div className="h-24" />
        </div>

        {/* Buy + Sell footer */}
        <div className="flex-shrink-0 px-5 py-4 flex gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
          <button onClick={() => setTradeModal('buy')}
            className="flex-1 py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.98]"
            style={{ background: '#22C55E' }}>
            Buy
          </button>
          <button onClick={() => setTradeModal('sell')}
            className="flex-1 py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.98]"
            style={{ background: '#EF4444' }}>
            Sell
          </button>
        </div>
      </div>

      <AnimatePresence>
        {tradeModal && (
          <TradeModal token={token} mode={tradeModal} onClose={() => setTradeModal(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({ token, rank, onClick }: { token: DexToken; rank: number; onClick: () => void }) {
  const isUp = (token.change24h ?? 0) >= 0;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[11px] w-5 text-center flex-shrink-0 font-mono" style={{ color: '#6B7280' }}>{rank}</span>
      <TokenLogo token={token} size={48} />
      <div className="flex-1 min-w-0 text-left">
        <div className="font-bold text-white text-sm truncate">{token.name}</div>
        <div className="text-[12px] mt-0.5 font-mono" style={{ color: '#6B7280' }}>
          {token.marketCap ? fmtCompact(token.marketCap) : timeAgo(token.createdAt)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="font-bold text-white text-sm font-mono">{fmtPrice(token.price)}</span>
        <span className="text-[12px] font-semibold" style={{ color: isUp ? '#22C55E' : '#EF4444' }}>
          {isUp ? '▲' : '▼'} {Math.abs(token.change24h ?? 0).toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TABS: { id: DexTab; label: string }[] = [
  { id: 'pumpfun',  label: 'pump.fun'  },
  { id: 'pumpswap', label: 'PumpSwap'  },
  { id: 'bonk',     label: 'BONK'      },
  { id: 'fourmeme', label: 'FourMeme'  },
  { id: 'raydium',  label: 'Raydium'   },
  { id: 'newpairs', label: 'New Pairs' },
];
const AGE_FILTERS = ['All', '2m', '5m', '20m', '1h', '5h', '12h'];

function ageMs(label: string): number {
  if (label === 'All') return Infinity;
  const n = parseInt(label);
  if (label.endsWith('m')) return n * 60_000;
  if (label.endsWith('h')) return n * 3_600_000;
  return Infinity;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DexPage() {
  const [tab, setTab]             = useState<DexTab>('pumpfun');
  const [ageFilter, setAgeFilter] = useState('All');
  const [tokens, setTokens]       = useState<DexToken[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<DexToken | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem('steinz-dex-favs');
      if (s) setFavorites(new Set(JSON.parse(s)));
    } catch {}
  }, []);

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('steinz-dex-favs', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const load = useCallback(async (t: DexTab) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dex-feed?tab=${t}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) setTokens(data.tokens || []);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError('Failed to load DEX data.');
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
    const iv = setInterval(() => load(tab), 30_000);
    return () => { clearInterval(iv); abortRef.current?.abort(); };
  }, [tab, load]);

  const maxAge = ageMs(ageFilter);
  const filtered = tokens.filter(t => {
    if (maxAge !== Infinity && t.createdAt && (Date.now() - t.createdAt) > maxAge) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.symbol || '').toLowerCase().includes(q) ||
           (t.name || '').toLowerCase().includes(q) ||
           (t.contractAddress?.toLowerCase().includes(q) ?? false);
  });

  if (selected) {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="detail"
          initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-50">
          <TokenDetail
            token={selected} favorites={favorites} onToggleFav={toggleFav}
            onClose={() => setSelected(null)}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111111' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-lg font-bold text-white">DEX Discovery</h1>
        <button onClick={() => load(tab)} disabled={loading} className="transition-colors" style={{ color: '#6B7280' }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* DEX tab pills */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 py-2.5 gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => { setTab(t.id); setAgeFilter('All'); setSearch(''); }}
            className="flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={tab === t.id
              ? { background: '#22C55E', color: '#000' }
              : { background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.07)' }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* Age filters */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2 flex-shrink-0">
        {AGE_FILTERS.map(a => (
          <button key={a} onClick={() => setAgeFilter(a)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={ageFilter === a
              ? { background: 'rgba(255,255,255,0.14)', color: '#fff' }
              : { background: 'transparent', color: '#6B7280' }
            }>
            {a}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7280' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or CA"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="transition-colors hover:text-white" style={{ color: '#6B7280' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && tokens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#22C55E' }} />
            <span className="text-sm" style={{ color: '#6B7280' }}>Loading DEX data…</span>
          </div>
        )}
        {error && tokens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={() => load(tab)} className="text-xs hover:underline" style={{ color: '#22C55E' }}>Retry</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && tokens.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-sm" style={{ color: '#6B7280' }}>No tokens match your filter.</span>
            <button onClick={() => { setSearch(''); setAgeFilter('All'); }}
              className="text-xs hover:underline" style={{ color: '#22C55E' }}>Clear filters</button>
          </div>
        )}
        <AnimatePresence>
          {filtered.map((token, idx) => (
            <motion.div key={token.id || idx}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.35) }}>
              <TokenRow token={token} rank={idx + 1} onClick={() => setSelected(token)} />
            </motion.div>
          ))}
        </AnimatePresence>
        {tokens.length > 0 && (
          <div className="py-5 text-center">
            <span className="text-[10px]" style={{ color: '#374151' }}>
              {filtered.length} tokens · updates every 30s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
