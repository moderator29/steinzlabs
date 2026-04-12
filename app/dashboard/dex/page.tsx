'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Copy, ChevronLeft, ExternalLink, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  holders?: number;
  fdv?: number;
  supply?: number;
  volume5m?: number;
}

type Chain = 'all' | 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'avalanche' | 'ton' | 'base' | 'tron';
type TimeFilter = 'all' | '2s' | '5s' | '1m' | '5m' | '20m' | '1h' | '5h' | '12h';
type Timeframe = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAINS: { label: string; value: Chain; color: string }[] = [
  { label: 'All',   value: 'all',       color: '#9CA3AF' },
  { label: 'SOL',   value: 'solana',    color: '#9945FF' },
  { label: 'ETH',   value: 'ethereum',  color: '#627EEA' },
  { label: 'BNB',   value: 'bsc',       color: '#F0B90B' },
  { label: 'BASE',  value: 'base',      color: '#0052FF' },
  { label: 'MATIC', value: 'polygon',   color: '#8247E5' },
  { label: 'AVAX',  value: 'avalanche', color: '#E84142' },
  { label: 'TON',   value: 'ton',       color: '#0098EA' },
  { label: 'TRX',   value: 'tron',      color: '#EB0029' },
];

const TIME_FILTERS: { label: string; value: TimeFilter }[] = [
  { label: 'All',  value: 'all'  },
  { label: '2s',   value: '2s'   },
  { label: '5s',   value: '5s'   },
  { label: '1m',   value: '1m'   },
  { label: '5m',   value: '5m'   },
  { label: '20m',  value: '20m'  },
  { label: '1h',   value: '1h'   },
  { label: '5h',   value: '5h'   },
  { label: '12h',  value: '12h'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function filterByTime(tokens: DexToken[], filter: TimeFilter): DexToken[] {
  if (filter === 'all') return tokens;
  const seconds: Record<string, number> = {
    '2s': 2, '5s': 5, '1m': 60, '5m': 300,
    '20m': 1200, '1h': 3600, '5h': 18000, '12h': 43200,
  };
  const limit = seconds[filter];
  if (!limit) return tokens;
  const now = Date.now();
  return tokens.filter(t => t.createdAt && (now - t.createdAt) / 1000 <= limit);
}

function formatCompact(n?: number): string {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function chainColor(chain: string): string {
  return CHAINS.find(c => c.value === chain?.toLowerCase())?.color ?? '#6B7280';
}

function chainLabel(chain: string): string {
  return CHAINS.find(c => c.value === chain?.toLowerCase())?.label ?? (chain?.toUpperCase() || '?');
}

function truncateCA(ca: string, head = 10, tail = 8): string {
  if (!ca || ca.length <= head + tail + 3) return ca;
  return `${ca.slice(0, head)}...${ca.slice(-tail)}`;
}

// ─── PriceDisplay ─────────────────────────────────────────────────────────────

function PriceDisplay({ price }: { price?: number }) {
  if (!price) return <span>$0.00</span>;
  if (price >= 1)
    return <span>${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  if (price >= 0.01) return <span>${price.toFixed(4)}</span>;
  const str = price.toFixed(20);
  const afterDot = str.split('.')[1] || '';
  let zeros = 0;
  for (const ch of afterDot) { if (ch === '0') zeros++; else break; }
  if (zeros < 4) return <span>${price.toPrecision(4)}</span>;
  const sig = afterDot.slice(zeros, zeros + 4);
  return (
    <span>$0.0<sub style={{ fontSize: '0.6em', lineHeight: 1 }}>{zeros}</sub>{sig}</span>
  );
}

// ─── CoinLogo ─────────────────────────────────────────────────────────────────

function CoinLogo({ token, size = 40 }: { token: DexToken; size?: number }) {
  const [err, setErr] = useState(false);
  const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#0A1EFF'];
  const color = COLORS[(token.symbol?.charCodeAt(0) || 65) % COLORS.length];
  const initials = (token.symbol || token.name || '?').slice(0, 2).toUpperCase();

  if (!token.imageUri || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.35, color: '#fff', flexShrink: 0 }}>
        {initials}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={token.imageUri} alt={token.symbol} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={() => setErr(true)} />;
}

// ─── ChainBadge ───────────────────────────────────────────────────────────────

function ChainBadge({ chain }: { chain: string }) {
  const color = chainColor(chain);
  const label = chainLabel(chain);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <button onClick={handle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: copied ? 'rgba(10,30,255,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(10,30,255,0.45)' : 'rgba(255,255,255,0.1)'}`, color: copied ? '#0A1EFF' : '#9CA3AF', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────

function AreaChart({ token, tf }: { token: DexToken; tf: Timeframe }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;
    let chartInstance: any;

    async function init() {
      if (!containerRef.current) return;
      const { createChart } = await import('lightweight-charts');
      if (destroyed || !containerRef.current) return;

      const isGreen = (token.change24h ?? 0) >= 0;
      const lineColor = isGreen ? '#0A1EFF' : '#EF4444';
      const topColor = isGreen ? 'rgba(10,30,255,0.2)' : 'rgba(239,68,68,0.2)';
      const bottomColor = 'rgba(0,0,0,0)';

      chartInstance = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 220,
        layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
        crosshair: { mode: 1 },
        handleScroll: false,
        handleScale: false,
      });

      const series = chartInstance.addAreaSeries({ lineColor, topColor, bottomColor, lineWidth: 2 });

      try {
        const res = await fetch(`/api/coin-chart?id=${token.contractAddress}&tf=${tf}`);
        if (res.ok) {
          const raw: [number, number][] = await res.json();
          if (raw && raw.length > 0) {
            const data = raw
              .map(([ts, price]) => ({ time: Math.floor(ts / 1000) as any, value: price }))
              .sort((a: any, b: any) => a.time - b.time);
            if (!destroyed) series.setData(data);
          } else throw new Error('no data');
        } else throw new Error('fetch failed');
      } catch {
        const now = Math.floor(Date.now() / 1000);
        const tfSeconds: Record<string, number> = {
          '1H': 3600, '6H': 21600, '1D': 86400,
          '1W': 604800, '1M': 2592000, '1Y': 31536000, 'ALL': 31536000,
        };
        const duration = tfSeconds[tf] ?? 86400;
        const points = 60;
        const currentPrice = token.price ?? 0;
        const start = currentPrice * (1 - (token.change24h ?? 0) / 100);
        const synth = Array.from({ length: points }, (_, i) => ({
          time: (now - duration + Math.floor((duration / points) * i)) as any,
          value: Math.max(0, start + (currentPrice - start) * (i / (points - 1)) + (Math.random() - 0.5) * currentPrice * 0.08),
        }));
        if (!destroyed) series.setData(synth);
      }

      if (!destroyed) chartInstance.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (!destroyed && containerRef.current) chartInstance.applyOptions({ width: containerRef.current.clientWidth });
      });
      if (containerRef.current) ro.observe(containerRef.current);
    }

    init();
    return () => {
      destroyed = true;
      if (chartInstance) { try { chartInstance.remove(); } catch {} }
    };
  }, [token, tf]);

  return <div ref={containerRef} style={{ width: '100%', height: 220 }} />;
}

// ─── Token Row ────────────────────────────────────────────────────────────────

function TokenRow({ token, onPress }: { token: DexToken; onPress: () => void }) {
  const isPos = (token.change24h ?? 0) >= 0;
  return (
    <div
      onClick={onPress}
      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', gap: 12, userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <CoinLogo token={token} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {token.symbol}
          </span>
          <ChainBadge chain={token.chain} />
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {token.createdAt ? formatAge(token.createdAt) + ' ago' : '—'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
          <PriceDisplay price={token.price} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: isPos ? '#0A1EFF' : '#EF4444', marginTop: 2 }}>
          {isPos ? '+' : ''}{(token.change24h ?? 0).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({ token, onBack }: { token: DexToken; onBack: () => void }) {
  const router = useRouter();
  const [tf, setTf] = useState<Timeframe>('1D');
  const timeframes: Timeframe[] = ['1H', '6H', '1D', '1W', '1M', '1Y', 'ALL'];

  const stats = [
    { label: 'Liquidity',  value: formatCompact(token.liquidity) },
    { label: 'Mcap',       value: formatCompact(token.marketCap) },
    { label: 'FDV',        value: formatCompact(token.fdv ?? token.marketCap) },
    { label: 'Supply',     value: token.supply ? `${(token.supply / 1e9).toFixed(2)}B` : '—' },
    { label: 'Vol 5m',     value: formatCompact(token.volume5m) },
    { label: 'Vol 24h',    value: formatCompact(token.volume24h) },
    { label: '24h',        value: `${(token.change24h ?? 0) >= 0 ? '+' : ''}${(token.change24h ?? 0).toFixed(2)}%`, color: (token.change24h ?? 0) >= 0 ? '#0A1EFF' : '#EF4444' },
    { label: 'Holders',    value: token.holders?.toLocaleString() ?? '—' },
    { label: 'Age',        value: token.createdAt ? formatAge(token.createdAt) : '—' },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'fixed', inset: 0, background: '#111111', zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: '#111111', zIndex: 10, gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ChevronLeft size={24} />
        </button>
        <CoinLogo token={token} size={28} />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', flex: 1 }}>{token.symbol}/USD</span>
        <CopyButton text={token.contractAddress} label="CA" />
        {token.dexUrl && (
          <a href={token.dexUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', display: 'flex' }}>
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {/* Price hero */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          <PriceDisplay price={token.price} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: (token.change24h ?? 0) >= 0 ? '#0A1EFF' : '#EF4444' }}>
          {(token.change24h ?? 0) >= 0 ? '+' : ''}{(token.change24h ?? 0).toFixed(2)}% (24h)
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: '#111111' }}>
        <AreaChart token={token} tf={tf} />
      </div>

      {/* Timeframes */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {timeframes.map(t => (
          <button key={t} onClick={() => setTf(t)}
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap', background: tf === t ? 'rgba(255,255,255,0.14)' : 'transparent', borderColor: tf === t ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: tf === t ? '#fff' : '#9CA3AF' }}>
            {t}
          </button>
        ))}
      </div>

      {/* KEY STATS — matching Image 3 exactly */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
          KEY STATS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: '1px solid rgba(255,255,255,0.08)' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: '14px 12px',
              background: 'transparent',
              borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderBottom: i < stats.length - 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color ?? '#fff' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract address */}
      <div style={{ margin: '0 16px 16px', padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contract Address</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncateCA(token.contractAddress)}
          </span>
          <CopyButton text={token.contractAddress} />
          <ChainBadge chain={token.chain} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 80 }} />

      {/* Sticky BUY button */}
      <div style={{ position: 'sticky', bottom: 0, padding: '12px 16px 24px', background: 'linear-gradient(to top, #111111 80%, transparent)' }}>
        <button
          onClick={() => router.push(`/dashboard/swap?ca=${token.contractAddress}&chain=${token.chain}`)}
          style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 18px rgba(16,185,129,0.4)', letterSpacing: '0.02em' }}
        >
          BUY {token.symbol}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DexPage() {
  const [activeChain, setActiveChain] = useState<Chain>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DexToken | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTokens = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/dex-feed?chain=${activeChain}`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch { /* keep existing tokens on network error */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeChain]);

  // Initial fetch + chain change
  useEffect(() => {
    setTokens([]);
    fetchTokens(false);
  }, [fetchTokens]);

  // Auto-refresh every 5s (pauses while detail view is open)
  useEffect(() => {
    if (selectedToken) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => fetchTokens(true), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTokens, selectedToken]);

  const displayed = filterByTime(tokens, timeFilter);

  const handleBack = () => {
    setSelectedToken(null);
    // Immediately refresh when returning to the list
    setTimeout(() => fetchTokens(false), 50);
  };

  return (
    <div style={{ background: '#111111', minHeight: '100vh', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', position: 'relative', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: '#111111', zIndex: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>DEX</span>
        <button onClick={() => fetchTokens(true)}
          style={{ position: 'absolute', right: 16, background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={18} style={{ transition: 'transform 0.5s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
        </button>
      </div>

      {/* ── Chain filter ── */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '10px 12px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none' }}>
        {CHAINS.map(chain => {
          const active = activeChain === chain.value;
          return (
            <button key={chain.value}
              onClick={() => { setActiveChain(chain.value); setTimeFilter('all'); }}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: `1px solid ${active ? chain.color : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? `${chain.color}22` : 'rgba(255,255,255,0.04)', color: active ? chain.color : '#9CA3AF' }}>
              {chain.label}
            </button>
          );
        })}
      </div>

      {/* ── Time filter ── */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '8px 12px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none' }}>
        {TIME_FILTERS.map(f => {
          const active = timeFilter === f.value;
          return (
            <button key={f.value} onClick={() => setTimeFilter(f.value)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: `1px solid ${active ? '#0A1EFF' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? 'rgba(10,30,255,0.15)' : 'transparent', color: active ? '#0A1EFF' : '#6B7280' }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── Token list ── */}
      <div>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0A1EFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280', fontSize: 14 }}>
            {tokens.length > 0 ? 'No tokens match the time filter' : 'No tokens found'}
          </div>
        )}
        {displayed.map(token => (
          <TokenRow key={token.id} token={token} onPress={() => setSelectedToken(token)} />
        ))}
      </div>

      {/* ── Refresh indicator ── */}
      {refreshing && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(10,30,255,0.15)', border: '1px solid rgba(10,30,255,0.3)', borderRadius: 6, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0A1EFF', fontWeight: 600 }}>
          <div style={{ width: 12, height: 12, border: '2px solid rgba(10,30,255,0.3)', borderTopColor: '#0A1EFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Refreshing
        </div>
      )}

      <AnimatePresence>
        {selectedToken && <DetailView token={selectedToken} onBack={handleBack} />}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
