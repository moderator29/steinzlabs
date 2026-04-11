'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Search, SlidersHorizontal, ChevronDown, ChevronRight, X, ArrowLeftRight } from 'lucide-react';

interface MarketToken {
  name: string; symbol: string; price: number; change24h: number;
  volume24h: number; marketCap: number; logo: string; chain: string;
  source: string; address?: string; pairAddress?: string;
}

const LOGO_COLORS = ['#F7931A','#627EEA','#F0B90B','#0033AD','#9945FF','#E84142','#2775CA'];

function CoinLogo({ token, size = 44 }: { token: MarketToken; size?: number }) {
  const [err, setErr] = useState(false);
  const color = LOGO_COLORS[token.symbol.charCodeAt(0) % LOGO_COLORS.length];
  if (err || !token.logo) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
      {token.symbol.slice(0, 2)}
    </div>
  );
  return <img src={token.logo} alt={token.symbol} width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

function fmtPrice(p: number) {
  if (!p) return '$0.00';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(10)}`;
}
function fmtMcap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return n > 0 ? `$${n.toFixed(0)}` : '';
}

// ─── Candlestick + Volume Chart (matches screenshot exactly) ─────────────────
const TF_CONFIG: Record<string, { interval: string; limit: number }> = {
  '1H': { interval: '1m',  limit: 60  },
  '1D': { interval: '15m', limit: 96  },
  '1W': { interval: '1h',  limit: 168 },
  '1M': { interval: '4h',  limit: 180 },
  '1Y': { interval: '1d',  limit: 365 },
};

function CandleChart({ symbol, tf }: { symbol: string; tf: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart: any;
    let cancelled = false;

    (async () => {
      const { createChart } = await import('lightweight-charts');
      if (cancelled || !ref.current) return;

      chart = createChart(el, {
        width: el.clientWidth,
        height: 280,
        layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        crosshair: { mode: 1 },
        handleScale: false,
        handleScroll: false,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderUpColor: '#22C55E',
        borderDownColor: '#EF4444',
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
      });

      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

      try {
        const cfg = TF_CONFIG[tf] || TF_CONFIG['1D'];
        const binSym = symbol.toUpperCase() + 'USDT';
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${binSym}&interval=${cfg.interval}&limit=${cfg.limit}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const klines: any[][] = await res.json();
          const candles = klines.map(k => ({
            time: Math.floor(k[0] / 1000) as any,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
          }));
          const vols = klines.map(k => ({
            time: Math.floor(k[0] / 1000) as any,
            value: parseFloat(k[5]),
            color: parseFloat(k[4]) >= parseFloat(k[1]) ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
          }));
          if (!cancelled) {
            candleSeries.setData(candles);
            volSeries.setData(vols);
            chart.timeScale().fitContent();
          }
        }
      } catch {}

      const ro = new ResizeObserver(() => {
        if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
      });
      ro.observe(el);
    })();

    return () => { cancelled = true; try { chart?.remove(); } catch {} };
  }, [symbol, tf]);

  return <div ref={ref} style={{ width: '100%' }} />;
}

// ─── Buy Modal (exactly matches screenshot 4) ─────────────────────────────────
function BuyModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const [input, setInput] = useState('0');
  const [sliderVal, setSliderVal] = useState(0);

  const press = (k: string) => {
    if (k === '⌫') { setInput(p => p.length <= 1 ? '0' : p.slice(0, -1)); return; }
    if (k === '.' && input.includes('.')) return;
    setInput(p => p === '0' ? k : p + k);
  };

  const pctLabels = ['0%', '25%', '50%', '75%', 'MAX'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ background: '#1C1C1E', borderRadius: '20px 20px 0 0', paddingBottom: 32 }}
        onClick={e => e.stopPropagation()}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* Title in GREEN */}
          <div style={{ color: '#22C55E', fontWeight: 700, fontSize: 20, marginBottom: 20 }}>
            Buy {token.symbol}
          </div>

          {/* Amount + swap icon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: input === '0' ? '#555' : '#fff' }}>${input}</span>
            <button style={{ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={16} color="#9CA3AF" />
            </button>
          </div>

          {/* Slider */}
          <div style={{ marginBottom: 6 }}>
            <input type="range" min={0} max={100} value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#22C55E', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {pctLabels.map(l => (
                <span key={l} style={{ fontSize: 11, color: '#6B7280' }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Available */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, marginTop: 6 }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>Available</span>
            <span style={{ color: '#6B7280', fontSize: 13 }}>$0.00</span>
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => press(k)} style={{
                padding: '18px 0', borderRadius: 12, fontSize: k === '⌫' ? 18 : 22, fontWeight: 600,
                border: 'none', background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{k}</button>
            ))}
          </div>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#000', cursor: 'pointer' }}>
              Connect Wallet
            </button>
            <button style={{ width: 52, borderRadius: 14, border: '1.5px solid #EF4444', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={18} color="#EF4444" />
            </button>
          </div>

          {/* Fee */}
          <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>0.1% fee</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Filter Modal (exactly matches screenshot 5) ──────────────────────────────
function FilterModal({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState('Crypto');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ background: '#1C1C1E', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ width: 28 }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Filters</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 2 }}>
            <X size={20} />
          </button>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 0 }}>
          {['Crypto', 'Stocks', 'Commodities', 'Forex'].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              flex: 1, paddingBottom: 12, paddingTop: 4, fontSize: 14, fontWeight: cat === c ? 700 : 400,
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: cat === c ? '#fff' : '#9CA3AF',
              borderBottom: cat === c ? '2px solid #fff' : '2px solid transparent',
              marginBottom: -1,
            }}>{c}</button>
          ))}
        </div>

        {/* Filter rows */}
        {[
          ['Blockchain', 'All Chains'],
          ['Market Cap', 'All'],
          ['Price Change', 'All'],
          ['Timeframe', '24 H'],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ color: '#fff', fontSize: 15 }}>{label}</span>
            <span style={{ color: '#9CA3AF', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              {val} <ChevronRight size={15} />
            </span>
          </div>
        ))}

        {/* Apply */}
        <button onClick={onClose} style={{ width: '100%', marginTop: 24, padding: '17px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#000', cursor: 'pointer' }}>
          Apply Filters
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Coin Row (matches screenshot 1 exactly) ──────────────────────────────────
function CoinRow({ token, rank, onClick }: { token: MarketToken; rank: number; onClick: () => void }) {
  const pos = token.change24h >= 0;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', gap: 14, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <span style={{ color: '#555', fontSize: 13, width: 18, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <CoinLogo token={token} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
        <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{token.marketCap > 0 ? fmtMcap(token.marketCap) : token.symbol}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? '#22C55E' : '#EF4444', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
          {pos ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Trade View (matches screenshot 2) ───────────────────────────────────────
function TradeView({ token, onCoinPick, onBuy }: { token: MarketToken; onCoinPick: () => void; onBuy: () => void }) {
  const [tf, setTf] = useState('1D');
  const [panel, setPanel] = useState<'portfolio' | 'history' | 'trades' | 'stats'>('portfolio');
  const pos = token.change24h >= 0;

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Coin selector */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CoinLogo token={token} size={28} />
        <button onClick={onCoinPick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{token.symbol}/USD</span>
          <ChevronDown size={16} color="#9CA3AF" />
        </button>
      </div>

      {/* Price hero */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{fmtPrice(token.price)}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: pos ? '#22C55E' : '#EF4444' }}>
          {pos ? '+' : ''}{token.change24h.toFixed(2)}%
        </span>
      </div>

      {/* Candlestick chart */}
      <div style={{ padding: '0' }}>
        <CandleChart symbol={token.symbol} tf={tf} />
      </div>

      {/* Timeframes */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 4 }}>
        {['1H', '1D', '1W', '1M', '1Y'].map(t => (
          <button key={t} onClick={() => setTf(t)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: tf === t ? 'rgba(255,255,255,0.15)' : 'transparent',
            color: tf === t ? '#fff' : '#6B7280',
          }}>{t}</button>
        ))}
      </div>

      {/* Panel tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 16px' }}>
        {(['portfolio', 'history', 'trades', 'stats'] as const).map(p => (
          <button key={p} onClick={() => setPanel(p)} style={{
            paddingBottom: 10, paddingTop: 4, marginRight: 16, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', background: 'transparent',
            color: panel === p ? '#fff' : '#6B7280',
            borderBottom: panel === p ? '2px solid #fff' : '2px solid transparent',
            textTransform: 'capitalize',
          }}>{p === 'history' ? 'Trade History' : p.charAt(0).toUpperCase() + p.slice(1)}</button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        Connect wallet to see {panel}
      </div>

      {/* Sticky Buy + Sell */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: 'linear-gradient(to top, #111111 85%, transparent)', display: 'flex', gap: 10 }}>
        <button onClick={onBuy} style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#000', cursor: 'pointer' }}>
          Buy
        </button>
        <button style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}>
          Sell
        </button>
      </div>
    </div>
  );
}

// ─── Main Market Page ─────────────────────────────────────────────────────────
export default function MarketPage() {
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'prices' | 'trade'>('prices');
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [totalMcap, setTotalMcap] = useState(0);
  const [totalChange, setTotalChange] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/market?tab=trending');
      const d = await r.json();
      const toks: MarketToken[] = d.tokens || [];
      setTokens(toks);
      const cap = toks.reduce((s, t) => s + (t.marketCap || 0), 0);
      setTotalMcap(cap);
      const weighted = toks.filter(t => t.marketCap > 0).reduce((s, t) => s + t.change24h * t.marketCap, 0);
      setTotalChange(cap > 0 ? weighted / cap : 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCoinClick = (token: MarketToken) => {
    setSelectedToken(token);
    setActiveTab('trade');
  };

  const filtered = tokens.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const tradeCoin = selectedToken || tokens[0] || null;
  const totalPos = totalChange >= 0;

  return (
    <div style={{ background: '#111111', minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* STEINZ header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff', boxShadow: '0 0 12px rgba(10,30,255,0.4)' }}>S</div>
          <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.3px' }}>STEINZ</span>
        </div>
        <a href="/dashboard/swap" style={{ padding: '7px 18px', borderRadius: 20, background: '#22C55E', color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Swap</a>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', gap: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 0 }}>
        <Star size={16} color={activeTab === 'prices' ? '#fff' : '#555'} fill={activeTab === 'prices' ? '#fff' : 'none'} style={{ flexShrink: 0, marginBottom: 2 }} />
        <button onClick={() => setActiveTab('prices')} style={{
          background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4,
          fontSize: 15, fontWeight: 700, color: activeTab === 'prices' ? '#fff' : '#6B7280',
          borderBottom: activeTab === 'prices' ? '2px solid #fff' : '2px solid transparent',
        }}>Prices</button>
        <button onClick={() => setActiveTab('trade')} style={{
          background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4,
          fontSize: 15, fontWeight: 700, color: activeTab === 'trade' ? '#fff' : '#6B7280',
          borderBottom: activeTab === 'trade' ? '2px solid #fff' : '2px solid transparent',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          Trade
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block', marginBottom: 1 }} />
        </button>
      </div>

      {/* ── PRICES TAB ── */}
      {activeTab === 'prices' && (
        <>
          {/* Search + filter */}
          <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Search size={15} color="#6B7280" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or CA"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, minWidth: 0 }} />
            </div>
            <button onClick={() => setFilterOpen(true)} style={{ width: 46, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SlidersHorizontal size={17} />
            </button>
          </div>

          {/* Total market cap */}
          {totalMcap > 0 && (
            <div style={{ padding: '0 16px 12px', color: '#9CA3AF', fontSize: 13 }}>
              Total: {fmtMcap(totalMcap)}{' '}
              <span style={{ color: totalPos ? '#22C55E' : '#EF4444' }}>
                {totalPos ? '▲' : '▼'} {Math.abs(totalChange).toFixed(2)}%
              </span>
            </div>
          )}

          {/* List */}
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 18 }} />
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '45%', height: 15, borderRadius: 8, background: 'rgba(255,255,255,0.07)', marginBottom: 7 }} />
                  <div style={{ width: '28%', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
                <div>
                  <div style={{ width: 80, height: 15, borderRadius: 8, background: 'rgba(255,255,255,0.07)', marginBottom: 7, marginLeft: 'auto' }} />
                  <div style={{ width: 55, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginLeft: 'auto' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
              {search ? `No results for "${search}"` : 'No coins found'}
            </div>
          ) : (
            filtered.map((t, i) => (
              <CoinRow key={`${t.symbol}-${i}`} token={t} rank={i + 1} onClick={() => handleCoinClick(t)} />
            ))
          )}
        </>
      )}

      {/* ── TRADE TAB ── */}
      {activeTab === 'trade' && tradeCoin && (
        <TradeView
          token={tradeCoin}
          onCoinPick={() => setActiveTab('prices')}
          onBuy={() => setBuyOpen(true)}
        />
      )}

      {activeTab === 'trade' && !tradeCoin && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
          <button onClick={() => setActiveTab('prices')} style={{ color: '#22C55E', background: 'none', border: 'none', fontSize: 15, cursor: 'pointer' }}>
            ← Pick a coin from Prices
          </button>
        </div>
      )}

      {/* Buy modal */}
      <AnimatePresence>
        {buyOpen && tradeCoin && <BuyModal key="buy" token={tradeCoin} onClose={() => setBuyOpen(false)} />}
      </AnimatePresence>

      {/* Filter modal */}
      <AnimatePresence>
        {filterOpen && <FilterModal key="filter" onClose={() => setFilterOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
