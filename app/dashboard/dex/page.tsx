'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Copy, ChevronLeft, Check, ArrowLeftRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BLUE = '#0A1EFF';
const BLUE_DIM = 'rgba(10,30,255,0.15)';
const BLUE_GLOW = '0 0 18px rgba(10,30,255,0.45)';
const BG = '#111111';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DexToken {
  id: string; name: string; symbol: string; imageUri: string;
  contractAddress: string; chain: string;
  price: number; marketCap: number; liquidity: number;
  volume24h: number; volume5m: number; change24h: number;
  createdAt: number; fdv: number; supply: number;
  holders: number; dexUrl: string; pairAddress: string;
}

type Chain = 'solana' | 'ethereum' | 'bsc' | 'base' | 'polygon' | 'avalanche' | 'tron' | 'arbitrum' | 'ton' | 'optimism' | 'fantom' | 'sui';
type AgeFilter = 'all' | '2m' | '5m' | '20m' | '1h' | '5h' | '12h';

const CHAINS: { id: Chain; label: string }[] = [
  { id: 'solana',    label: 'Solana'    },
  { id: 'ethereum',  label: 'Ethereum'  },
  { id: 'bsc',       label: 'BNB'       },
  { id: 'base',      label: 'Base'      },
  { id: 'polygon',   label: 'Polygon'   },
  { id: 'avalanche', label: 'Avalanche' },
  { id: 'arbitrum',  label: 'Arbitrum'  },
  { id: 'tron',      label: 'Tron'      },
  { id: 'ton',       label: 'TON'       },
  { id: 'optimism',  label: 'Optimism'  },
  { id: 'fantom',    label: 'Fantom'    },
  { id: 'sui',       label: 'Sui'       },
];

const AGE_OPTIONS: { id: AgeFilter; label: string; minutes: number }[] = [
  { id: 'all',  label: 'All',  minutes: Infinity },
  { id: '2m',   label: '2m',   minutes: 2        },
  { id: '5m',   label: '5m',   minutes: 5        },
  { id: '20m',  label: '20m',  minutes: 20       },
  { id: '1h',   label: '1h',   minutes: 60       },
  { id: '5h',   label: '5h',   minutes: 300      },
  { id: '12h',  label: '12h',  minutes: 720      },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ageInMinutes(ts: number): number { return (Date.now() - ts) / 60000; }

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function fmtPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return '$' + price.toFixed(4);
  const str = price.toFixed(20);
  const after = str.split('.')[1] || '';
  let zeros = 0;
  for (const ch of after) { if (ch === '0') zeros++; else break; }
  if (zeros < 4) return '$' + price.toPrecision(4);
  return '$0.0(' + zeros + ')' + after.slice(zeros, zeros + 4);
}

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

// ─── Token Logo ───────────────────────────────────────────────────────────────
function TokenLogo({ token, size = 40 }: { token: DexToken; size?: number }) {
  const [err, setErr] = useState(false);
  const colors = ['#9945FF','#627EEA','#F0B90B','#0A1EFF','#E84142','#2775CA'];
  const col = colors[(token.symbol.charCodeAt(0) || 0) % colors.length];
  if (err || !token.imageUri) return (
    <div style={{ width: size, height: size, borderRadius: 6, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
      {(token.symbol || '?').slice(0, 2)}
    </div>
  );
  return <img src={token.imageUri} alt={token.symbol} width={size} height={size} style={{ borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

// ─── Area Chart (synthetic, lightweight-charts) ───────────────────────────────
function DexChart({ token }: { token: DexToken }) {
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
          width: el.clientWidth, height: 220,
          layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
          grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
          rightPriceScale: { borderVisible: false },
          timeScale: { borderVisible: false, timeVisible: false },
          crosshair: { mode: 1 },
          handleScale: false, handleScroll: false,
        });
        const isPos = token.change24h >= 0;
        const lineColor = isPos ? BLUE : '#EF4444';
        const series = chart.addAreaSeries({
          lineColor, topColor: isPos ? 'rgba(10,30,255,0.2)' : 'rgba(239,68,68,0.2)',
          bottomColor: isPos ? 'rgba(10,30,255,0.01)' : 'rgba(239,68,68,0.01)', lineWidth: 2,
        });
        const endPrice = token.price || 1;
        const startPrice = endPrice / (1 + token.change24h / 100) || endPrice;
        const now = Math.floor(Date.now() / 1000);
        const pts: { time: any; value: number }[] = [];
        let cur = startPrice;
        for (let i = 47; i >= 0; i--) {
          const progress = (47 - i) / 47;
          const trend = (endPrice - startPrice) * progress / 20;
          cur = Math.max(cur + trend + (Math.random() - 0.5) * endPrice * 0.015, endPrice * 0.001);
          pts.push({ time: (now - i * 1800) as any, value: cur });
        }
        pts[47].value = endPrice;
        series.setData(pts);
        chart.timeScale().fitContent();
        const ro = new ResizeObserver(() => { if (ref.current && chart) chart.applyOptions({ width: ref.current.clientWidth }); });
        ro.observe(el);
      } catch {}
    })();

    return () => { cancelled = true; try { chart?.remove(); } catch {} };
  }, [token.id]);

  return <div ref={ref} style={{ width: '100%' }} />;
}

// ─── Buy / Sell Modal ─────────────────────────────────────────────────────────
function BuySellModal({ token, mode, onClose }: { token: DexToken; mode: 'buy' | 'sell'; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState('0');
  const isBuy = mode === 'buy';
  const accent = isBuy ? BLUE : '#EF4444';

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
        style={{ background: '#0D0D14', borderRadius: '16px 16px 0 0', paddingBottom: 36, border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ color: accent, fontWeight: 700, fontSize: 20, marginBottom: 18 }}>{isBuy ? 'Buy' : 'Sell'} {token.symbol}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
            <span style={{ fontSize: 52, fontWeight: 700, color: input === '0' ? '#333' : '#fff' }}>${input}</span>
            <button style={{ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={15} color="#9CA3AF" />
            </button>
          </div>
          <input type="range" min={0} max={100} defaultValue={0} style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginBottom: 4 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            {['0%','25%','50%','75%','MAX'].map(l => <span key={l} style={{ fontSize: 11, color: '#6B7280' }}>{l}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>Available</span>
            <span style={{ color: '#6B7280', fontSize: 13 }}>$0.00</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => press(k)}
                style={{ padding: '16px 0', borderRadius: 8, fontSize: k === '⌫' ? 18 : 22, fontWeight: 600, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {k}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button onClick={() => { onClose(); router.push(`/dashboard/swap?ca=${token.contractAddress}&chain=${token.chain}&amount=${input}`); }}
              style={{ flex: 1, padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${accent}, ${isBuy ? '#3d57ff' : '#ff3b3b'})`, color: '#fff', cursor: 'pointer', boxShadow: `0 0 18px ${isBuy ? 'rgba(10,30,255,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
              Connect Wallet
            </button>
            <button style={{ width: 52, borderRadius: 10, border: `1.5px solid ${isBuy ? '#EF4444' : BLUE}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={18} color={isBuy ? '#EF4444' : BLUE} />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>0.1% fee</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Token Detail View ────────────────────────────────────────────────────────
function TokenDetail({ token, onBack, onBuy, onSell }: { token: DexToken; onBack: () => void; onBuy: () => void; onSell: () => void }) {
  const [copied, setCopied] = useState(false);
  const [tf, setTf] = useState('1D');
  const pos = token.change24h >= 0;

  const copy = () => {
    navigator.clipboard.writeText(token.contractAddress).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}>
          <ChevronLeft size={22} />
        </button>
        <TokenLogo token={token} size={26} />
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{token.name}</div>
          <div style={{ color: '#6B7280', fontSize: 11 }}>{token.symbol} · {token.chain.toUpperCase()}</div>
        </div>
      </div>
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{fmtPrice(token.price)}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: pos ? BLUE : '#EF4444', marginTop: 4 }}>
          {pos ? '+' : ''}{token.change24h.toFixed(2)}%
        </div>
      </div>
      <DexChart token={token} />
      <div style={{ display: 'flex', padding: '8px 16px', gap: 2 }}>
        {['1H','6H','1D','1W','1M','1Y','ALL'].map(t => (
          <button key={t} onClick={() => setTf(t)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0, background: tf === t ? BLUE_DIM : 'transparent', color: tf === t ? '#fff' : '#6B7280', boxShadow: tf === t ? BLUE_GLOW : 'none' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase' }}>Key Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'LIQUIDITY',  value: fmtMcap(token.liquidity) },
            { label: 'MARKET CAP', value: fmtMcap(token.marketCap) },
            { label: 'FDV',        value: fmtMcap(token.fdv || token.marketCap) },
            { label: 'VOLUME 24H', value: fmtMcap(token.volume24h) },
            { label: 'VOL 5M',     value: fmtMcap(token.volume5m) },
            { label: '24H %',      value: (pos ? '+' : '') + token.change24h.toFixed(2) + '%' },
            { label: 'AGE',        value: formatAge(token.createdAt) },
            { label: 'HOLDERS',    value: token.holders > 0 ? token.holders.toLocaleString() : '—' },
            { label: 'CHAIN',      value: token.chain.toUpperCase().slice(0, 6) },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '10px 10px' }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.label === '24H %' ? (pos ? BLUE : '#EF4444') : '#fff' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      {token.contractAddress && (
        <div style={{ margin: '0 16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Contract Address</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>
              {token.contractAddress.slice(0, 10)}...{token.contractAddress.slice(-6)}
            </div>
          </div>
          <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? BLUE : '#6B7280', padding: 4, display: 'flex', flexShrink: 0 }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      )}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'linear-gradient(to top, #111111 80%, transparent)', display: 'flex', gap: 10, zIndex: 10 }}>
        <button onClick={onBuy} style={{ flex: 1, padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', cursor: 'pointer', boxShadow: BLUE_GLOW }}>Buy</button>
        <button onClick={onSell} style={{ flex: 1, padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 700, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}>Sell</button>
      </div>
    </div>
  );
}

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({ token, rank, onClick }: { token: DexToken; rank: number; onClick: () => void }) {
  const pos = token.change24h >= 0;
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 4, cursor: 'pointer', gap: 12, userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}>
      <span style={{ color: '#444', fontSize: 11, width: 18, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <TokenLogo token={token} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
        <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{formatAge(token.createdAt)} · {fmtMcap(token.marketCap)}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? BLUE : '#EF4444', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
          {pos ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Main DEX Page ────────────────────────────────────────────────────────────
export default function DexPage() {
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chain, setChain] = useState<Chain>('solana');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [selectedToken, setSelectedToken] = useState<DexToken | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTokens = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/dex-feed?chain=${chain}&limit=50`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const toks: DexToken[] = (data.tokens || []).map((t: any) => ({
        id: t.id || t.pairAddress || Math.random().toString(),
        name: t.name || t.symbol || 'Unknown',
        symbol: (t.symbol || '???').toUpperCase(),
        imageUri: t.imageUri || '',
        contractAddress: t.contractAddress || '',
        chain: t.chain || chain,
        price: Number(t.price ?? 0),
        marketCap: Number(t.marketCap ?? 0),
        liquidity: Number(t.liquidity ?? 0),
        volume24h: Number(t.volume24h ?? 0),
        volume5m: Number(t.volume5m ?? 0),
        change24h: Number(t.change24h ?? 0),
        createdAt: Number(t.createdAt ?? Date.now()),
        fdv: Number(t.fdv ?? 0),
        supply: Number(t.supply ?? 0),
        holders: Number(t.holders ?? 0),
        dexUrl: t.dexUrl || '',
        pairAddress: t.pairAddress || '',
      }));
      setTokens(toks);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [chain]);

  // Initial load + 5s auto-refresh
  useEffect(() => {
    setLoading(true);
    setTokens([]);
    setAgeFilter('all');
    fetchTokens();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchTokens(true), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTokens]);

  // Age filter applied client-side
  const ageConfig = AGE_OPTIONS.find(a => a.id === ageFilter)!;
  const filtered = tokens.filter(t =>
    ageConfig.minutes === Infinity || ageInMinutes(t.createdAt) <= ageConfig.minutes
  );

  if (selectedToken) {
    return (
      <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <TokenDetail token={selectedToken} onBack={() => setSelectedToken(null)} onBuy={() => setBuyOpen(true)} onSell={() => setSellOpen(true)} />
        <AnimatePresence>
          {buyOpen && <BuySellModal key="buy" token={selectedToken} mode="buy" onClose={() => setBuyOpen(false)} />}
        </AnimatePresence>
        <AnimatePresence>
          {sellOpen && <BuySellModal key="sell" token={selectedToken} mode="sell" onClose={() => setSellOpen(false)} />}
        </AnimatePresence>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>DEX Discovery</span>
        <button onClick={() => fetchTokens(true)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Chain tabs */}
      <div style={{ display: 'flex', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {CHAINS.map(c => (
          <button key={c.id} onClick={() => setChain(c.id)}
            style={{ paddingBottom: 10, paddingTop: 4, paddingLeft: 12, paddingRight: 12, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: chain === c.id ? '#fff' : '#6B7280', borderBottom: chain === c.id ? `2px solid ${BLUE}` : '2px solid transparent', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Age filters */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 6, overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {AGE_OPTIONS.map(a => (
          <button key={a.id} onClick={() => setAgeFilter(a.id)}
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${ageFilter === a.id ? BLUE : 'rgba(255,255,255,0.12)'}`, background: ageFilter === a.id ? BLUE_DIM : 'transparent', color: ageFilter === a.id ? '#fff' : '#9CA3AF', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Token list */}
      <div style={{ padding: '0 16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${BLUE_DIM}`, borderTop: `2px solid ${BLUE}`, animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#6B7280', fontSize: 13 }}>Loading new pairs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280', fontSize: 14 }}>
            {ageFilter !== 'all' ? `No pairs in last ${ageConfig.label}` : 'No pairs found'}
          </div>
        ) : (
          filtered.map((t, i) => (
            <TokenRow key={t.id || i} token={t} rank={i + 1} onClick={() => setSelectedToken(t)} />
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
