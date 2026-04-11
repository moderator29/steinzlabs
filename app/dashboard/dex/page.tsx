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
  imageUri: string;
  contractAddress: string;
  chain: string;
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  change24h: number;
  createdAt: number; // unix ms
  graduated: boolean;
  dexUrl: string;
  pairAddress: string;
  holders?: number;
  fdv?: number;
  supply?: number;
  volume5m?: number;
}

type Tab = 'pumpfun' | 'pumpswap' | 'bonk' | 'raydium' | 'new';
type AgeFilter = 'all' | '2m' | '5m' | '20m' | '1h' | '5h' | '12h';
type Timeframe = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function ageInMinutes(createdAt: number): number {
  return (Date.now() - createdAt) / 60000;
}

function filterByAge(tokens: DexToken[], filter: AgeFilter): DexToken[] {
  if (filter === 'all') return tokens;
  const limits: Record<string, number> = {
    '2m': 2,
    '5m': 5,
    '20m': 20,
    '1h': 60,
    '5h': 300,
    '12h': 720,
  };
  const limit = limits[filter];
  return tokens.filter((t) => ageInMinutes(t.createdAt) <= limit);
}

function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;

  // Count leading zeros after decimal point
  const str = price.toFixed(20);
  const afterDot = str.split('.')[1] || '';
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === '0') zeros++;
    else break;
  }

  if (zeros < 4) {
    return `$${price.toPrecision(4)}`;
  }

  // Build subscript representation as plain text
  const sigStr = afterDot.slice(zeros);
  const sig = sigStr.slice(0, 4);
  return `$0.0\u2080${zeros}\u2080${sig}`;
}

// Actually we'll render a JSX element for subscript zeros
function PriceDisplay({ price }: { price: number }) {
  if (price === 0) return <span>$0.00</span>;
  if (price >= 1)
    return (
      <span>
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  if (price >= 0.01) return <span>${price.toFixed(4)}</span>;

  const str = price.toFixed(20);
  const afterDot = str.split('.')[1] || '';
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === '0') zeros++;
    else break;
  }

  if (zeros < 4) return <span>${price.toPrecision(4)}</span>;

  const sig = afterDot.slice(zeros, zeros + 4);
  return (
    <span>
      $0.0<sub style={{ fontSize: '0.6em', lineHeight: 1 }}>{zeros}</sub>
      {sig}
    </span>
  );
}

function formatCompact(n: number): string {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function changeColor(change: number): string {
  return change >= 0 ? '#0A1EFF' : '#EF4444';
}

function truncateCA(ca: string, head = 6, tail = 4): string {
  if (!ca || ca.length <= head + tail + 3) return ca;
  return `${ca.slice(0, head)}...${ca.slice(-tail)}`;
}

// ─── CoinLogo ─────────────────────────────────────────────────────────────────

function CoinLogo({ token, size = 40 }: { token: DexToken; size?: number }) {
  const [err, setErr] = useState(false);
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
  const color = colors[(token.symbol?.charCodeAt(0) || 65) % colors.length];
  const initials = (token.symbol || token.name || '?').slice(0, 2).toUpperCase();

  if (!token.imageUri || err) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: size * 0.35,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={token.imageUri}
      alt={token.symbol}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

// ─── Chain Badge ──────────────────────────────────────────────────────────────

function ChainBadge({ chain }: { chain: string }) {
  const map: Record<string, { label: string; color: string }> = {
    solana: { label: 'SOL', color: '#9945FF' },
    bsc: { label: 'BSC', color: '#F0B90B' },
    eth: { label: 'ETH', color: '#627EEA' },
    base: { label: 'BASE', color: '#0052FF' },
  };
  const info = map[chain?.toLowerCase()] || { label: chain?.toUpperCase() || '?', color: '#6B7280' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: `${info.color}22`,
        color: info.color,
        border: `1px solid ${info.color}44`,
      }}
    >
      {info.label}
    </span>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }, [text]);

  return (
    <button
      onClick={handle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 8,
        background: copied ? 'rgba(10,30,255,0.15)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${copied ? 'rgba(10,30,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
        color: copied ? '#0A1EFF' : '#9CA3AF',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────

function AreaChart({ token, tf }: { token: DexToken; tf: Timeframe }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const seriesRef = useRef<unknown>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      if (!containerRef.current) return;

      const { createChart } = await import('lightweight-charts');

      const isGreen = token.change24h >= 0;
      const lineColor = isGreen ? '#0A1EFF' : '#EF4444';
      const topColor = isGreen ? 'rgba(10,30,255,0.2)' : 'rgba(239,68,68,0.2)';
      const bottomColor = isGreen ? 'rgba(10,30,255,0)' : 'rgba(239,68,68,0)';

      if (destroyed) return;

      const chart = createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: 200,
        layout: {
          background: { color: 'transparent' },
          textColor: '#6B7280',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        crosshair: {
          mode: 1,
        },
        handleScroll: false,
        handleScale: false,
      });

      const series = chart.addAreaSeries({ lineColor, topColor, bottomColor, lineWidth: 2 });
      chartRef.current = chart;
      seriesRef.current = series;

      // Fetch or generate data
      try {
        const res = await fetch(`/api/coin-chart?id=${token.contractAddress}&tf=${tf}`);
        if (res.ok) {
          const raw: [number, number][] = await res.json();
          if (raw && raw.length > 0) {
            // lightweight-charts v4 UTCTimestamp is just a branded number
            const data = raw
              .map(([ts, price]) => ({ time: (Math.floor(ts / 1000)) as unknown as number, value: price }))
              .sort((a, b) => (a.time as number) - (b.time as number));
            if (!destroyed) series.setData(data);
          } else {
            throw new Error('no data');
          }
        } else {
          throw new Error('fetch failed');
        }
      } catch {
        // Generate synthetic data
        const now = Math.floor(Date.now() / 1000);
        const tfSeconds: Record<Timeframe, number> = {
          '1H': 3600,
          '6H': 21600,
          '1D': 86400,
          '1W': 604800,
          '1M': 2592000,
          '1Y': 31536000,
          'ALL': 31536000,
        };
        const duration = tfSeconds[tf];
        const points = 60;
        const start = token.price * (1 - token.change24h / 100);
        const synth = Array.from({ length: points }, (_, i) => {
          const t = now - duration + Math.floor((duration / points) * i);
          const progress = i / (points - 1);
          const noise = (Math.random() - 0.5) * token.price * 0.1;
          const value = Math.max(0, start + (token.price - start) * progress + noise);
          return { time: t as unknown as number, value };
        });
        if (!destroyed) series.setData(synth);
      }

      if (!destroyed) chart.timeScale().fitContent();

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!destroyed && containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
      };
    }

    init();

    return () => {
      destroyed = true;
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
        chartRef.current = null;
      }
    };
  }, [token, tf]);

  return <div ref={containerRef} style={{ width: '100%', height: 200 }} />;
}

// ─── Token Row ────────────────────────────────────────────────────────────────

function TokenRow({ token, onPress }: { token: DexToken; onPress: () => void }) {
  const isPos = token.change24h >= 0;
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [longPressed, setLongPressed] = useState(false);

  const handlePointerDown = () => {
    const t = setTimeout(() => {
      setLongPressed(true);
    }, 500);
    setPressTimer(t);
  };

  const handlePointerUp = () => {
    if (pressTimer) clearTimeout(pressTimer);
    if (!longPressed) onPress();
    setLongPressed(false);
  };

  const handlePointerLeave = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        background: longPressed ? 'rgba(255,255,255,0.04)' : 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'background 0.15s',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* Logo */}
      <div style={{ position: 'relative', marginRight: 12 }}>
        <CoinLogo token={token} size={40} />
        {token.graduated && (
          <span
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              fontSize: 12,
              lineHeight: 1,
            }}
            title="Graduated"
          >
            🎓
          </span>
        )}
      </div>

      {/* Name + age */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {token.symbol}
          </span>
          <ChainBadge chain={token.chain} />
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          {formatAge(token.createdAt)} ago
        </div>
      </div>

      {/* Price + change */}
      <div style={{ textAlign: 'right', marginRight: longPressed ? 8 : 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#FFFFFF' }}>
          <PriceDisplay price={token.price} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: changeColor(token.change24h), marginTop: 2 }}>
          {isPos ? '+' : ''}{token.change24h.toFixed(2)}%
        </div>
      </div>

      {/* Copy CA button on long press */}
      {longPressed && (
        <div onClick={(e) => e.stopPropagation()}>
          <CopyButton text={token.contractAddress} />
        </div>
      )}
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({ token, onBack }: { token: DexToken; onBack: () => void }) {
  const router = useRouter();
  const [tf, setTf] = useState<Timeframe>('1D');
  const timeframes: Timeframe[] = ['1H', '6H', '1D', '1W', '1M', '1Y', 'ALL'];

  const stats = [
    { label: 'Liquidity', value: formatCompact(token.liquidity) },
    { label: 'Mcap', value: formatCompact(token.marketCap) },
    { label: 'FDV', value: formatCompact(token.fdv || token.marketCap) },
    { label: 'Supply', value: token.supply ? `${(token.supply / 1e9).toFixed(2)}B` : '—' },
    { label: 'Vol 5m', value: formatCompact(token.volume5m || 0) },
    { label: 'Vol 24h', value: formatCompact(token.volume24h) },
    { label: '24h%', value: `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`, color: changeColor(token.change24h) },
    { label: 'Holders', value: token.holders ? token.holders.toLocaleString() : '—' },
    { label: 'Age', value: formatAge(token.createdAt) },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#111111',
        zIndex: 50,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          background: '#111111',
          zIndex: 10,
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <ChevronLeft size={24} />
        </button>
        <CoinLogo token={token} size={28} />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#FFFFFF', flex: 1 }}>
          {token.symbol}/USD
        </span>
        <CopyButton text={token.contractAddress} label="CA" />
        {token.dexUrl && (
          <a
            href={token.dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6B7280', display: 'flex' }}
          >
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {/* Price hero */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
          <PriceDisplay price={token.price} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: changeColor(token.change24h) }}>
          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}% (24h)
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '0 0 8px', background: '#111111' }}>
        <AreaChart token={token} tf={tf} />
      </div>

      {/* Timeframe selector */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 16px 16px',
          overflowX: 'auto',
        }}
      >
        {timeframes.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            style={{
              padding: '5px 12px',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background: tf === t ? 'rgba(255,255,255,0.14)' : 'transparent',
              borderColor: tf === t ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              color: tf === t ? '#fff' : '#9CA3AF',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Key stats grid */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 14,
          }}
        >
          KEY STATS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '14px 12px',
                background: 'transparent',
                borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderBottom: i < stats.length - 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color || '#FFFFFF' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract address */}
      <div
        style={{
          margin: '0 16px 16px',
          padding: 14,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Contract Address
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              color: '#9CA3AF',
              fontFamily: 'monospace',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncateCA(token.contractAddress, 10, 8)}
          </span>
          <CopyButton text={token.contractAddress} />
          <ChainBadge chain={token.chain} />
        </div>
      </div>

      {/* Spacer for sticky button */}
      <div style={{ flex: 1, minHeight: 80 }} />

      {/* Sticky BUY button */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 16px 24px',
          background: 'linear-gradient(to top, #111111 80%, transparent)',
        }}
      >
        <button
          onClick={() =>
            router.push(`/dashboard/swap?ca=${token.contractAddress}&chain=${token.chain}`)
          }
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)',
            border: 'none',
            color: '#fff',
            fontSize: 16,
            boxShadow: '0 0 18px rgba(10,30,255,0.45)',
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.88')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        >
          BUY {token.symbol}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { label: string; value: Tab }[] = [
  { label: 'pump.fun', value: 'pumpfun' },
  { label: 'PumpSwap', value: 'pumpswap' },
  { label: 'BONK', value: 'bonk' },
  { label: 'Raydium', value: 'raydium' },
  { label: 'New Pairs', value: 'new' },
];

const AGE_FILTERS: { label: string; value: AgeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: '2m', value: '2m' },
  { label: '5m', value: '5m' },
  { label: '20m', value: '20m' },
  { label: '1h', value: '1h' },
  { label: '5h', value: '5h' },
  { label: '12h', value: '12h' },
];

export default function DexPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pumpfun');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DexToken | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTokens = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/dex-feed?tab=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setTokens(data.tokens || []);
        }
      } catch {
        // network error — keep existing tokens
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab],
  );

  // Initial fetch + tab change
  useEffect(() => {
    setTokens([]);
    fetchTokens(false);
  }, [fetchTokens]);

  // Auto-refresh every 20s (only when list is shown)
  useEffect(() => {
    if (selectedToken) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => fetchTokens(true), 20000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTokens, selectedToken]);

  const displayed = filterByAge(tokens, ageFilter);

  return (
    <div
      style={{
        background: '#111111',
        minHeight: '100vh',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          background: '#111111',
          zIndex: 20,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>DEX</span>
        <button
          onClick={() => fetchTokens(true)}
          style={{
            position: 'absolute',
            right: 16,
            background: 'none',
            border: 'none',
            color: '#6B7280',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshCw
            size={18}
            style={{
              transition: 'transform 0.5s',
              transform: refreshing ? 'rotate(360deg)' : 'none',
            }}
          />
        </button>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '10px 12px',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value);
                setAgeFilter('all');
              }}
              style={{
                padding: '6px 16px',
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                background: active ? 'linear-gradient(135deg, #0A1EFF, #3d57ff)' : 'rgba(255,255,255,0.04)',
                borderColor: active ? '#0A1EFF' : 'rgba(255,255,255,0.1)',
                color: active ? '#fff' : '#9CA3AF',
                boxShadow: active ? '0 0 14px rgba(10,30,255,0.4)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Age filter row ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '8px 12px',
          gap: 6,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        {AGE_FILTERS.map((f) => {
          const active = ageFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setAgeFilter(f.value)}
              style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                background: active ? 'rgba(10,30,255,0.15)' : 'transparent',
                borderColor: active ? '#0A1EFF' : 'rgba(255,255,255,0.1)',
                color: active ? '#0A1EFF' : '#6B7280',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── Token list ──────────────────────────────────────────── */}
      <div>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#0A1EFF',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280', fontSize: 14 }}>
            No tokens found
          </div>
        )}

        {displayed.map((token) => (
          <TokenRow key={token.id} token={token} onPress={() => setSelectedToken(token)} />
        ))}
      </div>

      {/* ── Pull-to-refresh spinner overlay ─────────────────────── */}
      {refreshing && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(10,30,255,0.15)',
            border: '1px solid rgba(10,30,255,0.3)',
            borderRadius: 99,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#0A1EFF',
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              border: '2px solid rgba(10,30,255,0.3)',
              borderTopColor: '#0A1EFF',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          Refreshing
        </div>
      )}

      {/* ── Detail slide panel ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedToken && (
          <DetailView token={selectedToken} onBack={() => setSelectedToken(null)} />
        )}
      </AnimatePresence>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
