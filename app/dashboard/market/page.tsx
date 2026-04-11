'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Search, SlidersHorizontal, X, RefreshCw, ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BLUE = '#0A1EFF';
const BLUE_DIM = 'rgba(10,30,255,0.15)';
const BLUE_GLOW = '0 0 18px rgba(10,30,255,0.45)';
const BG = '#111111';

interface MarketToken {
  id: string; symbol: string; name: string; image: string;
  price: number; change24h: number; marketCap: number; volume24h: number; rank: number;
  fdv: number; ath: number; athChangePercent: number;
  circulatingSupply: number; totalSupply: number;
}

const TF_MAP: Record<string, { interval: string; limit: number }> = {
  '1H':  { interval: '1m',  limit: 60  },
  '6H':  { interval: '5m',  limit: 72  },
  '1D':  { interval: '15m', limit: 96  },
  '1W':  { interval: '1h',  limit: 168 },
  '1M':  { interval: '4h',  limit: 180 },
  '1Y':  { interval: '1d',  limit: 365 },
  'ALL': { interval: '1w',  limit: 200 },
};

const LOGO_COLORS = ['#F7931A','#627EEA','#F0B90B','#9945FF','#E84142','#2775CA','#0033AD'];

function fmtPrice(p: number): string {
  if (!p) return '$0.00';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(10);
}
function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}
function fmtSupply(n: number, sym: string): string {
  if (!n || n <= 0) return 'No max supply';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B ' + sym;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M ' + sym;
  return n.toLocaleString() + ' ' + sym;
}

function CoinLogo({ token, size = 44 }: { token: MarketToken; size?: number }) {
  const [err, setErr] = useState(false);
  const col = LOGO_COLORS[token.symbol.charCodeAt(0) % LOGO_COLORS.length];
  if (err || !token.image) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
      {token.symbol.slice(0, 2)}
    </div>
  );
  return <img src={token.image} alt={token.symbol} width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

// ─── Candlestick Chart (lightweight-charts + Binance klines) ──────────────────
function CandleChart({ symbol, tf }: { symbol: string; tf: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart: any;
    let cancelled = false;

    (async () => {
      try {
        const { createChart } = await import('lightweight-charts');
        if (cancelled || !ref.current) return;
        chart = createChart(el, {
          width: el.clientWidth,
          height: 260,
          layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
          grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
          rightPriceScale: { borderVisible: false },
          timeScale: { borderVisible: false, timeVisible: true },
          crosshair: { mode: 1 },
          handleScale: false,
          handleScroll: false,
        });
        const candles = chart.addCandlestickSeries({
          upColor: BLUE, downColor: '#EF4444',
          borderUpColor: BLUE, borderDownColor: '#EF4444',
          wickUpColor: BLUE, wickDownColor: '#EF4444',
        });
        const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

        const cfg = TF_MAP[tf] || TF_MAP['1D'];
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=${cfg.interval}&limit=${cfg.limit}`
        );
        if (res.ok && !cancelled) {
          const klines: any[][] = await res.json();
          candles.setData(klines.map(k => ({
            time: Math.floor(k[0] / 1000) as any,
            open: parseFloat(k[1]), high: parseFloat(k[2]),
            low: parseFloat(k[3]), close: parseFloat(k[4]),
          })));
          vol.setData(klines.map(k => ({
            time: Math.floor(k[0] / 1000) as any,
            value: parseFloat(k[5]),
            color: parseFloat(k[4]) >= parseFloat(k[1]) ? 'rgba(10,30,255,0.5)' : 'rgba(239,68,68,0.5)',
          })));
          chart.timeScale().fitContent();
        }
        const ro = new ResizeObserver(() => {
          if (ref.current && chart) chart.applyOptions({ width: ref.current.clientWidth });
        });
        ro.observe(el);
      } catch {}
    })();

    return () => { cancelled = true; try { chart?.remove(); } catch {} };
  }, [symbol, tf]);

  return <div ref={ref} style={{ width: '100%' }} />;
}

// ─── Buy / Sell Modal ─────────────────────────────────────────────────────────
function BuySellModal({ token, mode, onClose }: { token: MarketToken; mode: 'buy' | 'sell'; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState('0');
  const isBuy = mode === 'buy';
  const accentColor = isBuy ? BLUE : '#EF4444';

  const press = (k: string) => {
    if (k === '⌫') { setInput(p => p.length <= 1 ? '0' : p.slice(0, -1)); return; }
    if (k === '.' && input.includes('.')) return;
    setInput(p => p === '0' ? k : p + k);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        style={{ background: '#0D0D14', borderRadius: '20px 20px 0 0', paddingBottom: 36, border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ color: accentColor, fontWeight: 700, fontSize: 20, marginBottom: 20 }}>
            {isBuy ? 'Buy' : 'Sell'} {token.symbol}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, position: 'relative' }}>
            <span style={{ fontSize: 52, fontWeight: 700, color: input === '0' ? '#333' : '#fff' }}>${input}</span>
            <button style={{ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={15} color="#9CA3AF" />
            </button>
          </div>
          <div style={{ marginBottom: 6 }}>
            <input type="range" min={0} max={100} defaultValue={0}
              style={{ width: '100%', accentColor, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['0%','25%','50%','75%','MAX'].map(l => (
                <span key={l} style={{ fontSize: 11, color: '#6B7280' }}>{l}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 18px' }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>Available</span>
            <span style={{ color: '#6B7280', fontSize: 13 }}>$0.00</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => press(k)}
                style={{ padding: '17px 0', borderRadius: 12, fontSize: k === '⌫' ? 18 : 22, fontWeight: 600, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {k}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button
              onClick={() => { onClose(); router.push(`/dashboard/swap?token=${token.symbol}&amount=${input}`); }}
              style={{ flex: 1, padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${accentColor}, ${isBuy ? '#3d57ff' : '#ff3b3b'})`, color: '#fff', cursor: 'pointer', boxShadow: `0 0 18px ${isBuy ? 'rgba(10,30,255,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
              Connect Wallet
            </button>
            <button style={{ width: 52, borderRadius: 14, border: `1.5px solid ${isBuy ? '#EF4444' : BLUE}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={18} color={isBuy ? '#EF4444' : BLUE} />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>0.1% fee</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Trade View ───────────────────────────────────────────────────────────────
function TradeView({ token, onBack, onBuy, onSell }: { token: MarketToken; onBack: () => void; onBuy: () => void; onSell: () => void }) {
  const [tf, setTf] = useState('1D');
  const [panel, setPanel] = useState<'portfolio'|'history'|'trades'|'stats'>('portfolio');
  const pos = token.change24h >= 0;

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}>
          <ChevronLeft size={22} />
        </button>
        <CoinLogo token={token} size={26} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{token.symbol}/USD</span>
      </div>

      {/* Price hero */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{fmtPrice(token.price)}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: pos ? BLUE : '#EF4444', marginTop: 4 }}>
          {pos ? '+' : ''}{token.change24h.toFixed(2)}%
        </div>
      </div>

      {/* Chart */}
      <CandleChart symbol={token.symbol} tf={tf} />

      {/* Timeframes */}
      <div style={{ display: 'flex', padding: '8px 16px', gap: 2, overflowX: 'auto' }}>
        {Object.keys(TF_MAP).map(t => (
          <button key={t} onClick={() => setTf(t)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: tf === t ? BLUE_DIM : 'transparent', color: tf === t ? '#fff' : '#6B7280', boxShadow: tf === t ? BLUE_GLOW : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Panel tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 16px', marginTop: 4 }}>
        {(['portfolio','history','trades','stats'] as const).map(p => (
          <button key={p} onClick={() => setPanel(p)}
            style={{ paddingBottom: 10, paddingTop: 4, marginRight: 14, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: panel === p ? '#fff' : '#6B7280', borderBottom: panel === p ? `2px solid ${BLUE}` : '2px solid transparent', whiteSpace: 'nowrap' }}>
            {p === 'history' ? 'Trade History' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
        Connect wallet to see {panel}
      </div>

      {/* KEY STATS */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase' }}>
          Key Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'RANK', value: `#${token.rank}`, sub: '' },
            { label: 'MARKET CAP', value: fmtMcap(token.marketCap), sub: '' },
            { label: 'FDV', value: fmtMcap(token.fdv || token.marketCap), sub: token.fdv === token.marketCap || !token.fdv ? '= Market Cap' : '' },
            { label: 'VOLUME 24H', value: fmtMcap(token.volume24h), sub: (pos ? '+' : '') + token.change24h.toFixed(1) + '%' },
            { label: 'ATH', value: fmtPrice(token.ath), sub: token.athChangePercent ? (token.athChangePercent).toFixed(1) + '% below ATH' : '' },
            { label: 'CIRCULATING', value: fmtSupply(token.circulatingSupply, token.symbol), sub: !token.totalSupply ? 'No max supply' : '' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Buy + Sell */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'linear-gradient(to top, #111111 80%, transparent)', display: 'flex', gap: 10, zIndex: 10 }}>
        <button onClick={onBuy} style={{ flex: 1, padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', cursor: 'pointer', boxShadow: BLUE_GLOW }}>
          Buy
        </button>
        <button onClick={onSell} style={{ flex: 1, padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}>
          Sell
        </button>
      </div>
    </div>
  );
}

// ─── Coin Row (no ChevronRight) ───────────────────────────────────────────────
function CoinRow({ token, rank, onClick }: { token: MarketToken; rank: number; onClick: () => void }) {
  const pos = token.change24h >= 0;
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', gap: 12, userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}>
      <span style={{ color: '#444', fontSize: 12, width: 20, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <CoinLogo token={token} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
        <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{token.marketCap > 0 ? fmtMcap(token.marketCap) : token.symbol}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? BLUE : '#EF4444', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
          {pos ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'prices' | 'trade'>('prices');
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [totalMcap, setTotalMcap] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch('/api/market-data?category=top&limit=100', { cache: 'no-store' });
      if (!r.ok) throw new Error('fetch failed');
      const d = await r.json();
      const toks: MarketToken[] = (d.tokens || []).map((t: any) => ({
        id: t.id || t.symbol?.toLowerCase() || '',
        symbol: (t.symbol || '').toUpperCase(),
        name: t.name || t.symbol || '',
        image: t.image || '',
        price: Number(t.price ?? 0),
        change24h: Number(t.change24h ?? 0),
        marketCap: Number(t.marketCap ?? 0),
        volume24h: Number(t.volume24h ?? 0),
        rank: Number(t.rank ?? 0),
        fdv: Number(t.fdv ?? 0),
        ath: Number(t.ath ?? 0),
        athChangePercent: Number(t.athChangePercent ?? 0),
        circulatingSupply: Number(t.circulatingSupply ?? 0),
        totalSupply: Number(t.totalSupply ?? 0),
      }));
      setTokens(toks);
      setTotalMcap(toks.reduce((s, t) => s + t.marketCap, 0));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCoinClick = (token: MarketToken) => {
    setSelectedToken(token);
    setActiveTab('trade');
  };

  const tradeCoin = selectedToken || tokens[0] || null;

  const filtered = search
    ? tokens.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : tokens;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', maxWidth: 480, margin: '0 auto' }}>

      {/* STEINZ header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff', boxShadow: BLUE_GLOW }}>S</div>
          <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.3px' }}>STEINZ</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => load(true)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
          <a href="/dashboard/swap" style={{ padding: '7px 16px', borderRadius: 20, background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: BLUE_GLOW }}>Swap</a>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', gap: 20, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Star size={16} color={activeTab === 'prices' ? BLUE : '#444'} fill={activeTab === 'prices' ? BLUE : 'none'} style={{ flexShrink: 0, marginBottom: 2 }} />
        <button onClick={() => setActiveTab('prices')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4, fontSize: 15, fontWeight: 700, color: activeTab === 'prices' ? '#fff' : '#6B7280', borderBottom: activeTab === 'prices' ? `2px solid ${BLUE}` : '2px solid transparent' }}>
          Prices
        </button>
        <button onClick={() => setActiveTab('trade')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4, fontSize: 15, fontWeight: 700, color: activeTab === 'trade' ? '#fff' : '#6B7280', borderBottom: activeTab === 'trade' ? `2px solid ${BLUE}` : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 5 }}>
          Trade <span style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, display: 'inline-block', boxShadow: BLUE_GLOW }} />
        </button>
      </div>

      {/* ── PRICES TAB ── */}
      {activeTab === 'prices' && (
        <>
          <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.09)' }}>
              <Search size={15} color="#6B7280" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or CA"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, minWidth: 0 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>}
            </div>
          </div>

          {totalMcap > 0 && (
            <div style={{ padding: '0 16px 10px', color: '#9CA3AF', fontSize: 13 }}>
              Total: {fmtMcap(totalMcap)}
            </div>
          )}

          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 20 }} />
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.06)', marginBottom: 7 }} />
                  <div style={{ width: '24%', height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }} />
                </div>
                <div>
                  <div style={{ width: 76, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.06)', marginLeft: 'auto', marginBottom: 7 }} />
                  <div style={{ width: 52, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginLeft: 'auto' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280', fontSize: 14 }}>
              {search ? `No results for "${search}"` : 'No coins found'}
            </div>
          ) : (
            filtered.map((t, i) => (
              <CoinRow key={t.id || i} token={t} rank={i + 1} onClick={() => handleCoinClick(t)} />
            ))
          )}
        </>
      )}

      {/* ── TRADE TAB ── */}
      {activeTab === 'trade' && (
        tradeCoin
          ? <TradeView token={tradeCoin} onBack={() => setActiveTab('prices')} onBuy={() => setBuyOpen(true)} onSell={() => setSellOpen(true)} />
          : <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
              <button onClick={() => setActiveTab('prices')} style={{ color: BLUE, background: 'none', border: 'none', fontSize: 15, cursor: 'pointer' }}>
                ← Pick a coin from Prices
              </button>
            </div>
      )}

      <AnimatePresence>
        {buyOpen && tradeCoin && <BuySellModal key="buy" token={tradeCoin} mode="buy" onClose={() => setBuyOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {sellOpen && tradeCoin && <BuySellModal key="sell" token={tradeCoin} mode="sell" onClose={() => setSellOpen(false)} />}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
