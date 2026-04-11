'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowLeft, Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';

interface MarketToken {
  name: string; symbol: string; price: number; change24h: number;
  volume24h: number; marketCap: number; logo: string; chain: string;
  source: string; address?: string; pairAddress?: string;
}

const LOGO_COLORS = ['#0A1EFF','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899'];

function CoinLogo({ token, size = 44 }: { token: MarketToken; size?: number }) {
  const [err, setErr] = useState(false);
  const color = LOGO_COLORS[token.symbol.charCodeAt(0) % LOGO_COLORS.length];
  if (err || !token.logo) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.35, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
      {token.symbol.slice(0, 2)}
    </div>
  );
  return <img src={token.logo} alt={token.symbol} width={size} height={size} style={{ borderRadius: size * 0.35, flexShrink: 0, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

function fmtPrice(p: number) {
  if (!p) return '$0.00';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(10)}`;
}
function fmtMcap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return n > 0 ? `$${n.toFixed(0)}` : '';
}
function fmtChange(c: number) { return `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`; }

// ─── Chart ────────────────────────────────────────────────────────────────────
function CoinChart({ tokenId, isPositive }: { tokenId: string; isPositive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tf, setTf] = useState('1D');
  const color = isPositive ? '#22C55E' : '#EF4444';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let chart: any;
    let cancelled = false;

    (async () => {
      const { createChart } = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;
      chart = createChart(el, {
        width: el.clientWidth, height: 220,
        layout: { background: { color: 'transparent' }, textColor: '#6B7280' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        crosshair: { mode: 1 },
        handleScale: false, handleScroll: false,
      });
      const series = chart.addAreaSeries({
        lineColor: color, topColor: `${color}40`, bottomColor: `${color}05`,
        lineWidth: 2, priceLineVisible: false,
      });
      try {
        const res = await fetch(`/api/coin-chart?id=${encodeURIComponent(tokenId)}&tf=${tf}`);
        const data: [number, number][] = await res.json();
        if (Array.isArray(data) && data.length) {
          series.setData(data.map(([ts, val]) => ({ time: Math.floor(ts / 1000) as any, value: val })));
          chart.timeScale().fitContent();
        }
      } catch {}
      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      ro.observe(el);
    })();

    return () => { cancelled = true; try { chart?.remove(); } catch {} };
  }, [tokenId, tf, color]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, padding: '8px 16px', overflowX: 'auto' }}>
        {['1H','6H','1D','1W','1M','1Y','ALL'].map(t => (
          <button key={t} onClick={() => setTf(t)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: tf === t ? '#fff' : 'transparent', color: tf === t ? '#111' : '#6B7280', whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const [input, setInput] = useState('0');
  const [pct, setPct] = useState<number | null>(null);
  const press = (k: string) => {
    if (k === '⌫') { setInput(p => p.length <= 1 ? '0' : p.slice(0, -1)); return; }
    if (k === '.' && input.includes('.')) return;
    setInput(p => p === '0' ? k : p + k);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        style={{ background: '#1A1A1A', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Buy {token.symbol}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: '#fff', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 52, fontWeight: 900, color: '#fff', marginBottom: 8 }}>${input}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {[0, 25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => setPct(p)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.12)',
              background: pct === p ? '#22C55E' : 'rgba(255,255,255,0.06)',
              color: pct === p ? '#fff' : '#6B7280', cursor: 'pointer',
            }}>{p === 100 ? 'MAX' : `${p}%`}</button>
          ))}
        </div>
        <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, marginBottom: 20 }}>Available $0.00</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
            <button key={k} onClick={() => press(k)} style={{
              padding: '18px', borderRadius: 14, fontSize: 20, fontWeight: 700, border: 'none',
              background: k === '⌫' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)',
              color: k === '⌫' ? '#EF4444' : '#fff', cursor: 'pointer',
            }}>{k}</button>
          ))}
        </div>
        <button style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#fff', cursor: 'pointer' }}>
          Connect Wallet
        </button>
        <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 11, marginTop: 10 }}>0.1% fee</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState('Crypto');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        style={{ background: '#1A1A1A', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Filters</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: '#fff', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          {['Crypto', 'Stocks', 'Commodities', 'Forex'].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: 'transparent', color: cat === c ? '#fff' : '#6B7280',
              borderBottom: cat === c ? '2px solid #22C55E' : '2px solid transparent', marginBottom: -1,
            }}>{c}</button>
          ))}
        </div>
        {[['Blockchain', 'All Chains'], ['Market Cap', 'All'], ['Price Change', 'All'], ['Timeframe', '24H']].map(([lbl, val]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#fff', fontSize: 14 }}>{lbl}</span>
            <span style={{ color: '#6B7280', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>{val} <ChevronDown size={14} /></span>
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#fff', cursor: 'pointer' }}>
          Apply Filters
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Coin Row ─────────────────────────────────────────────────────────────────
function CoinRow({ token, rank, onClick }: { token: MarketToken; rank: number; onClick: () => void }) {
  const pos = token.change24h >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.015, 0.45) }}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', gap: 12, userSelect: 'none' }}>
      <span style={{ color: '#4B5563', fontSize: 11, width: 22, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <CoinLogo token={token} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
        <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{token.marketCap > 0 ? fmtMcap(token.marketCap) : token.symbol}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{fmtChange(token.change24h)}</div>
      </div>
    </motion.div>
  );
}

// ─── Coin Detail ──────────────────────────────────────────────────────────────
function CoinDetail({ token, favs, onToggleFav, onClose, onBuy }: {
  token: MarketToken; favs: Set<string>; onToggleFav: (s: string) => void;
  onClose: () => void; onBuy: () => void;
}) {
  const pos = token.change24h >= 0;
  const isFav = favs.has(token.symbol);
  const chartId = token.address || token.symbol.toLowerCase();

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'fixed', inset: 0, background: '#111111', zIndex: 100, overflowY: 'auto', paddingBottom: 90 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#111111', zIndex: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <CoinLogo token={token} size={30} />
        <div style={{ flex: 1 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{token.name} </span>
          <span style={{ color: '#6B7280', fontSize: 13 }}>{token.symbol}</span>
        </div>
        <button onClick={() => onToggleFav(token.symbol)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Star size={20} fill={isFav ? '#F59E0B' : 'none'} color={isFav ? '#F59E0B' : '#6B7280'} />
        </button>
      </div>

      {/* Price hero */}
      <div style={{ padding: '20px 16px 4px' }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? '#22C55E' : '#EF4444', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
          {pos ? '▲' : '▼'} {fmtChange(token.change24h)}
        </div>
      </div>

      {/* Chart */}
      <CoinChart tokenId={chartId} isPositive={pos} />

      {/* KEY STATS */}
      <div style={{ padding: '16px' }}>
        <div style={{ color: '#6B7280', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' }}>Key Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            ['Market Cap', token.marketCap > 0 ? fmtMcap(token.marketCap) : '—'],
            ['Volume 24h', token.volume24h > 0 ? fmtMcap(token.volume24h) : '—'],
            ['24h Change', fmtChange(token.change24h)],
            ['Chain', token.chain.toUpperCase()],
            ['Price', fmtPrice(token.price)],
            ['Symbol', token.symbol],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 10px' }}>
              <div style={{ color: '#6B7280', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky BUY */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 20px', background: 'linear-gradient(to top, #111111 80%, transparent)' }}>
        <button onClick={onBuy} style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, border: 'none', background: '#22C55E', color: '#fff', cursor: 'pointer' }}>
          BUY {token.symbol}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MarketToken | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'prices' | 'trade'>('prices');
  const [totalMcap, setTotalMcap] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/market?tab=trending');
      const d = await r.json();
      const toks: MarketToken[] = d.tokens || [];
      setTokens(toks);
      setTotalMcap(toks.reduce((s, t) => s + (t.marketCap || 0), 0));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFav = (sym: string) => setFavs(p => { const n = new Set(p); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const filtered = tokens.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background: '#111111', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Tab strip */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 0', gap: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Star size={17} color="#6B7280" style={{ flexShrink: 0 }} />
        {(['prices', 'trade'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12,
            fontSize: 15, fontWeight: 700,
            color: activeTab === tab ? '#fff' : '#6B7280',
            borderBottom: activeTab === tab ? '2px solid #fff' : '2px solid transparent',
          }}>{tab === 'prices' ? 'Prices' : 'Trade'}</button>
        ))}
      </div>

      {activeTab === 'trade' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', color: '#6B7280', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Trade</div>
          <p style={{ marginBottom: 24 }}>Use the Swap page for instant multi-chain trading.</p>
          <a href="/dashboard/swap" style={{ padding: '12px 28px', borderRadius: 14, background: '#22C55E', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
            Go to Swap →
          </a>
        </div>
      ) : (
        <>
          {/* Search + filter */}
          <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 24, padding: '10px 14px' }}>
              <Search size={15} color="#6B7280" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or CA"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, minWidth: 0 }} />
            </div>
            <button onClick={() => setFilterOpen(true)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 24, padding: '0 14px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {/* Total mcap */}
          {totalMcap > 0 && (
            <div style={{ padding: '0 16px 10px', color: '#6B7280', fontSize: 12 }}>
              Total: {fmtMcap(totalMcap)}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 22 }} />
                <div style={{ width: 44, height: 44, borderRadius: 15, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.07)', marginBottom: 6 }} />
                  <div style={{ width: '25%', height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ width: 70, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.07)', marginLeft: 'auto', marginBottom: 6 }} />
                  <div style={{ width: 50, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginLeft: 'auto' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
              {search ? `No results for "${search}"` : 'No coins found'}
            </div>
          ) : (
            filtered.map((t, i) => (
              <CoinRow key={`${t.symbol}-${i}`} token={t} rank={i + 1} onClick={() => setSelected(t)} />
            ))
          )}
        </>
      )}

      {/* Detail slide-in */}
      <AnimatePresence>
        {selected && (
          <CoinDetail key={selected.symbol} token={selected} favs={favs} onToggleFav={toggleFav}
            onClose={() => setSelected(null)} onBuy={() => setBuyOpen(true)} />
        )}
      </AnimatePresence>

      {/* Buy modal */}
      <AnimatePresence>
        {buyOpen && selected && <BuyModal key="buy" token={selected} onClose={() => setBuyOpen(false)} />}
      </AnimatePresence>

      {/* Filter modal */}
      <AnimatePresence>
        {filterOpen && <FilterModal key="filter" onClose={() => setFilterOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
