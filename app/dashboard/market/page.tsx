'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Search, SlidersHorizontal, ChevronDown, X, ArrowLeftRight, RefreshCw } from 'lucide-react';
import TradingViewChart, { getTradingViewSymbol } from '@/components/TradingViewChart';
import { useRouter } from 'next/navigation';

// ─── Brand color ──────────────────────────────────────────────────────────────
const BLUE = '#0A1EFF';
const BLUE_DIM = 'rgba(10,30,255,0.15)';
const BLUE_GLOW = '0 0 18px rgba(10,30,255,0.45)';

interface MarketToken {
  name: string; symbol: string; price: number; change24h: number;
  volume24h: number; marketCap: number; logo: string; chain: string;
  source: string; address?: string; pairAddress?: string;
}

interface Filters {
  blockchain: string;
  marketCap: string;
  priceChange: string;
}

// Known chain membership for filter
const SOL_TOKENS = new Set(['SOL','RAY','JUP','BONK','WIF','MEME','ORCA','SRM','PYTH','MNGO','SAMO','COPE','STEP','GENE','SLIM','DFL']);
const BSC_TOKENS = new Set(['BNB','CAKE','XVS','ALPACA','BAKE','BURGER','EGG']);
const ETH_TOKENS = new Set(['ETH','LINK','UNI','AAVE','MKR','COMP','CRV','SNX','YFI','SUSHI','BAL','REN','LRC','MATIC','ARB','OP','INJ','GRT','1INCH','LDO','RPL','ENS','IMX']);

function chainOf(t: MarketToken): string {
  if (SOL_TOKENS.has(t.symbol)) return 'solana';
  if (BSC_TOKENS.has(t.symbol)) return 'bnb';
  if (ETH_TOKENS.has(t.symbol)) return 'ethereum';
  return 'other';
}

function applyFilters(tokens: MarketToken[], f: Filters, search: string): MarketToken[] {
  let list = tokens;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(t => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q));
  }
  if (f.blockchain !== 'all') {
    list = list.filter(t => chainOf(t) === f.blockchain || (f.blockchain === 'ethereum' && t.symbol === 'MATIC') || (f.blockchain === 'ethereum' && !SOL_TOKENS.has(t.symbol) && !BSC_TOKENS.has(t.symbol)));
    if (f.blockchain === 'solana') list = tokens.filter(t => SOL_TOKENS.has(t.symbol));
    if (f.blockchain === 'bnb') list = tokens.filter(t => BSC_TOKENS.has(t.symbol));
    if (f.blockchain === 'ethereum') list = tokens.filter(t => ETH_TOKENS.has(t.symbol));
  }
  if (f.marketCap !== 'all') {
    if (f.marketCap === 'large') list = list.filter(t => t.marketCap >= 10e9);
    if (f.marketCap === 'mid') list = list.filter(t => t.marketCap >= 1e9 && t.marketCap < 10e9);
    if (f.marketCap === 'small') list = list.filter(t => t.marketCap > 0 && t.marketCap < 1e9);
  }
  if (f.priceChange !== 'all') {
    if (f.priceChange === 'gainers') list = list.filter(t => t.change24h > 0);
    if (f.priceChange === 'losers') list = list.filter(t => t.change24h < 0);
    if (f.priceChange === 'top_gainers') list = list.filter(t => t.change24h >= 5).sort((a, b) => b.change24h - a.change24h);
    if (f.priceChange === 'top_losers') list = list.filter(t => t.change24h <= -5).sort((a, b) => a.change24h - b.change24h);
  }
  return list;
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

// ─── TF → TradingView interval mapping ───────────────────────────────────────
const TF_TO_TV_INTERVAL: Record<string, string> = {
  '1H': '1',
  '1D': '60',
  '1W': 'D',
  '1M': 'W',
  '1Y': 'M',
};

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState('0');
  const [sliderVal, setSliderVal] = useState(0);

  const press = (k: string) => {
    if (k === '⌫') { setInput(p => p.length <= 1 ? '0' : p.slice(0, -1)); return; }
    if (k === '.' && input.includes('.')) return;
    setInput(p => p === '0' ? k : p + k);
  };

  const goSwap = () => {
    onClose();
    router.push(`/dashboard/swap?token=${token.symbol}&amount=${input}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ background: '#0D1020', borderRadius: '20px 20px 0 0', paddingBottom: 32, border: `1px solid ${BLUE_DIM}`, borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ color: BLUE, fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Buy {token.symbol}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: input === '0' ? '#444' : '#fff' }}>${input}</span>
            <button style={{ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={16} color="#9CA3AF" />
            </button>
          </div>
          <div style={{ marginBottom: 6 }}>
            <input type="range" min={0} max={100} value={sliderVal} onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: BLUE, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['0%','25%','50%','75%','MAX'].map(l => <span key={l} style={{ fontSize: 11, color: '#6B7280' }}>{l}</span>)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, marginTop: 6 }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>Available</span>
            <span style={{ color: '#6B7280', fontSize: 13 }}>$0.00</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => press(k)} style={{ padding: '18px 0', borderRadius: 12, fontSize: k === '⌫' ? 18 : 22, fontWeight: 600, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button onClick={goSwap} style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', cursor: 'pointer', boxShadow: BLUE_GLOW }}>
              Connect Wallet
            </button>
            <button style={{ width: 52, borderRadius: 14, border: '1.5px solid #EF4444', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={18} color="#EF4444" />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>0.1% fee</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Sell Modal ───────────────────────────────────────────────────────────────
function SellModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const [input, setInput] = useState('0');
  const [sliderVal, setSliderVal] = useState(0);

  const press = (k: string) => {
    if (k === '⌫') { setInput(p => p.length <= 1 ? '0' : p.slice(0, -1)); return; }
    if (k === '.' && input.includes('.')) return;
    setInput(p => p === '0' ? k : p + k);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ background: '#0D1020', borderRadius: '20px 20px 0 0', paddingBottom: 32, border: '1px solid rgba(239,68,68,0.2)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ color: '#EF4444', fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Sell {token.symbol}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: input === '0' ? '#444' : '#fff' }}>${input}</span>
            <button style={{ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={16} color="#9CA3AF" />
            </button>
          </div>
          <div style={{ marginBottom: 6 }}>
            <input type="range" min={0} max={100} value={sliderVal} onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#EF4444', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['0%','25%','50%','75%','MAX'].map(l => <span key={l} style={{ fontSize: 11, color: '#6B7280' }}>{l}</span>)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, marginTop: 6 }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>Available</span>
            <span style={{ color: '#6B7280', fontSize: 13 }}>$0.00</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => press(k)} style={{ padding: '18px 0', borderRadius: 12, fontSize: k === '⌫' ? 18 : 22, fontWeight: 600, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff', cursor: 'pointer', boxShadow: '0 0 18px rgba(239,68,68,0.4)' }}>
              Connect Wallet to Sell
            </button>
            <button style={{ width: 52, borderRadius: 14, border: `1.5px solid ${BLUE}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeftRight size={18} color={BLUE} />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>0.1% fee</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({ filters, onApply, onClose }: { filters: Filters; onApply: (f: Filters) => void; onClose: () => void }) {
  const [cat, setCat] = useState('Crypto');
  const [local, setLocal] = useState<Filters>({ ...filters });

  const BLOCKCHAIN_OPTIONS = [
    { label: 'All Chains', value: 'all' },
    { label: 'Ethereum', value: 'ethereum' },
    { label: 'Solana', value: 'solana' },
    { label: 'BNB Chain', value: 'bnb' },
  ];
  const MCAP_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Large Cap (>$10B)', value: 'large' },
    { label: 'Mid Cap ($1B-$10B)', value: 'mid' },
    { label: 'Small Cap (<$1B)', value: 'small' },
  ];
  const CHANGE_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Gainers', value: 'gainers' },
    { label: 'Losers', value: 'losers' },
    { label: 'Top Gainers (>5%)', value: 'top_gainers' },
    { label: 'Top Losers (<-5%)', value: 'top_losers' },
  ];

  const labelFor = (opts: {label:string;value:string}[], val: string) => opts.find(o => o.value === val)?.label || 'All';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{ background: '#0D1020', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', border: '1px solid rgba(10,30,255,0.2)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ width: 28 }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Filters</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
          {['Crypto','Stocks','Commodities','Forex'].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ flex: 1, paddingBottom: 12, paddingTop: 4, fontSize: 13, fontWeight: cat === c ? 700 : 400, border: 'none', cursor: 'pointer', background: 'transparent', color: cat === c ? '#fff' : '#9CA3AF', borderBottom: cat === c ? `2px solid ${BLUE}` : '2px solid transparent', marginBottom: -1 }}>{c}</button>
          ))}
        </div>

        {/* Blockchain */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fff', fontSize: 15 }}>Blockchain</span>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>{labelFor(BLOCKCHAIN_OPTIONS, local.blockchain)}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BLOCKCHAIN_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setLocal(p => ({ ...p, blockchain: o.value }))} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${local.blockchain === o.value ? BLUE : 'rgba(255,255,255,0.12)'}`, background: local.blockchain === o.value ? BLUE_DIM : 'transparent', color: local.blockchain === o.value ? '#fff' : '#9CA3AF', cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* Market Cap */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fff', fontSize: 15 }}>Market Cap</span>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>{labelFor(MCAP_OPTIONS, local.marketCap)}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MCAP_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setLocal(p => ({ ...p, marketCap: o.value }))} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${local.marketCap === o.value ? BLUE : 'rgba(255,255,255,0.12)'}`, background: local.marketCap === o.value ? BLUE_DIM : 'transparent', color: local.marketCap === o.value ? '#fff' : '#9CA3AF', cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* Price Change */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fff', fontSize: 15 }}>Price Change</span>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>{labelFor(CHANGE_OPTIONS, local.priceChange)}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CHANGE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setLocal(p => ({ ...p, priceChange: o.value }))} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${local.priceChange === o.value ? BLUE : 'rgba(255,255,255,0.12)'}`, background: local.priceChange === o.value ? BLUE_DIM : 'transparent', color: local.priceChange === o.value ? '#fff' : '#9CA3AF', cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </div>

        <button onClick={() => { onApply(local); onClose(); }} style={{ width: '100%', marginTop: 20, padding: '17px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', cursor: 'pointer', boxShadow: BLUE_GLOW }}>
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
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', gap: 14, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <span style={{ color: '#444', fontSize: 12, width: 18, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <CoinLogo token={token} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
        <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{token.marketCap > 0 ? fmtMcap(token.marketCap) : token.symbol}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmtPrice(token.price)}</div>
        <div style={{ color: pos ? '#3B82F6' : '#EF4444', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
          {pos ? '▲' : '▼'} {Math.abs(token.change24h).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Trade View ───────────────────────────────────────────────────────────────
function TradeView({ token, onCoinPick, onBuy, onSell }: { token: MarketToken; onCoinPick: () => void; onBuy: () => void; onSell: () => void }) {
  const [tf, setTf] = useState('1D');
  const [panel, setPanel] = useState<'portfolio' | 'history' | 'trades' | 'stats'>('portfolio');
  const pos = token.change24h >= 0;

  const keyStats = [
    { label: 'Mcap',    value: fmtMcap(token.marketCap) },
    { label: '24h Vol', value: fmtMcap(token.volume24h) },
    { label: 'FDV',     value: fmtMcap(token.marketCap) },
    { label: 'Supply',  value: '—' },
    { label: '24h%',    value: `${pos ? '+' : ''}${token.change24h.toFixed(2)}%`, color: pos ? BLUE : '#EF4444' },
    { label: 'Price',   value: fmtPrice(token.price) },
  ];

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CoinLogo token={token} size={28} />
        <button onClick={onCoinPick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{token.symbol}/USD</span>
          <ChevronDown size={16} color="#9CA3AF" />
        </button>
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>{fmtPrice(token.price)}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: pos ? BLUE : '#EF4444' }}>
          {pos ? '+' : ''}{token.change24h.toFixed(2)}%
        </span>
      </div>
      <div style={{ background: '#0A0E1A' }}>
        <TradingViewChart
          symbol={getTradingViewSymbol(token.symbol) ?? `BINANCE:${token.symbol.toUpperCase()}USDT`}
          interval={TF_TO_TV_INTERVAL[tf] ?? '60'}
          height={300}
        />
      </div>
      <div style={{ display: 'flex', padding: '10px 16px', gap: 4 }}>
        {['1H','1D','1W','1M','1Y'].map(t => (
          <button key={t} onClick={() => setTf(t)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: tf === t ? 'rgba(10,30,255,0.25)' : 'transparent', color: tf === t ? '#fff' : '#6B7280', boxShadow: tf === t ? BLUE_GLOW : 'none' }}>{t}</button>
        ))}
      </div>

      {/* KEY STATS — matching Image 3 layout */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>KEY STATS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: '1px solid rgba(255,255,255,0.08)' }}>
          {keyStats.map((s, i) => (
            <div key={i} style={{ padding: '12px 10px', background: 'transparent', borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color ?? '#fff' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 16px' }}>
        {(['portfolio','history','trades','stats'] as const).map(p => (
          <button key={p} onClick={() => setPanel(p)} style={{ paddingBottom: 10, paddingTop: 4, marginRight: 14, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: panel === p ? '#fff' : '#6B7280', borderBottom: panel === p ? `2px solid ${BLUE}` : '2px solid transparent', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {p === 'history' ? 'Trade History' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        Connect wallet to see {panel}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: 'linear-gradient(to top, #0A0E1A 85%, transparent)', display: 'flex', gap: 10 }}>
        <button onClick={onBuy} style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: `linear-gradient(135deg, ${BLUE}, #3d57ff)`, color: '#fff', cursor: 'pointer', boxShadow: BLUE_GLOW }}>Buy</button>
        <button onClick={onSell} style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: 'none', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff', cursor: 'pointer', boxShadow: '0 0 18px rgba(239,68,68,0.4)' }}>Sell</button>
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ blockchain: 'all', marketCap: 'all', priceChange: 'all' });
  const [totalMcap, setTotalMcap] = useState(0);
  const [totalChange, setTotalChange] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch('/api/market?tab=trending', { cache: 'no-store' });
      const d = await r.json();
      const toks: MarketToken[] = d.tokens || [];
      setTokens(toks);
      const cap = toks.reduce((s, t) => s + (t.marketCap || 0), 0);
      setTotalMcap(cap);
      const weighted = toks.filter(t => t.marketCap > 0).reduce((s, t) => s + t.change24h * t.marketCap, 0);
      setTotalChange(cap > 0 ? weighted / cap : 0);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCoinClick = (token: MarketToken) => { setSelectedToken(token); setActiveTab('trade'); };
  const tradeCoin = selectedToken || tokens[0] || null;
  const totalPos = totalChange >= 0;
  const filtered = applyFilters(tokens, filters, search);
  const hasActiveFilters = filters.blockchain !== 'all' || filters.marketCap !== 'all' || filters.priceChange !== 'all';

  return (
    <div style={{ background: '#0A0E1A', minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

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
        <button onClick={() => setActiveTab('prices')} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4, fontSize: 15, fontWeight: 700, color: activeTab === 'prices' ? '#fff' : '#6B7280', borderBottom: activeTab === 'prices' ? `2px solid ${BLUE}` : '2px solid transparent' }}>Prices</button>
        <button onClick={() => setActiveTab('trade')} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, paddingTop: 4, fontSize: 15, fontWeight: 700, color: activeTab === 'trade' ? '#fff' : '#6B7280', borderBottom: activeTab === 'trade' ? `2px solid ${BLUE}` : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 5 }}>
          Trade <span style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, display: 'inline-block', marginBottom: 1, boxShadow: BLUE_GLOW }} />
        </button>
      </div>

      {/* ── PRICES TAB ── */}
      {activeTab === 'prices' && (
        <>
          <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.09)' }}>
              <Search size={15} color="#6B7280" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or CA"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, minWidth: 0 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>}
            </div>
            <button onClick={() => setFilterOpen(true)} style={{ width: 46, background: hasActiveFilters ? BLUE_DIM : 'rgba(255,255,255,0.06)', border: `1px solid ${hasActiveFilters ? BLUE : 'rgba(255,255,255,0.09)'}`, borderRadius: 14, cursor: 'pointer', color: hasActiveFilters ? BLUE : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SlidersHorizontal size={17} />
            </button>
          </div>

          {totalMcap > 0 && (
            <div style={{ padding: '0 16px 10px', color: '#9CA3AF', fontSize: 13 }}>
              Total: {fmtMcap(totalMcap)}{' '}
              <span style={{ color: totalPos ? '#3B82F6' : '#EF4444' }}>{totalPos ? '▲' : '▼'} {Math.abs(totalChange).toFixed(2)}%</span>
            </div>
          )}

          {hasActiveFilters && (
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {filters.blockchain !== 'all' && <span style={{ padding: '3px 10px', borderRadius: 20, background: BLUE_DIM, border: `1px solid ${BLUE}`, color: '#fff', fontSize: 11 }}>Chain: {filters.blockchain}</span>}
              {filters.marketCap !== 'all' && <span style={{ padding: '3px 10px', borderRadius: 20, background: BLUE_DIM, border: `1px solid ${BLUE}`, color: '#fff', fontSize: 11 }}>Cap: {filters.marketCap}</span>}
              {filters.priceChange !== 'all' && <span style={{ padding: '3px 10px', borderRadius: 20, background: BLUE_DIM, border: `1px solid ${BLUE}`, color: '#fff', fontSize: 11 }}>Change: {filters.priceChange}</span>}
              <button onClick={() => setFilters({ blockchain: 'all', marketCap: 'all', priceChange: 'all' })} style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>Clear all</button>
            </div>
          )}

          {loading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 18 }} />
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '42%', height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.06)', marginBottom: 7 }} />
                  <div style={{ width: '26%', height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }} />
                </div>
                <div>
                  <div style={{ width: 80, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.06)', marginLeft: 'auto', marginBottom: 7 }} />
                  <div style={{ width: 55, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginLeft: 'auto' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
              {search || hasActiveFilters ? 'No coins match your filters' : 'No coins found'}
            </div>
          ) : (
            filtered.map((t, i) => <CoinRow key={`${t.symbol}-${i}`} token={t} rank={i + 1} onClick={() => handleCoinClick(t)} />)
          )}
        </>
      )}

      {/* ── TRADE TAB ── */}
      {activeTab === 'trade' && (
        tradeCoin
          ? <TradeView token={tradeCoin} onCoinPick={() => setActiveTab('prices')} onBuy={() => setBuyOpen(true)} onSell={() => setSellOpen(true)} />
          : <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
              <button onClick={() => setActiveTab('prices')} style={{ color: BLUE, background: 'none', border: 'none', fontSize: 15, cursor: 'pointer' }}>← Pick a coin from Prices</button>
            </div>
      )}

      <AnimatePresence>
        {buyOpen && tradeCoin && <BuyModal key="buy" token={tradeCoin} onClose={() => setBuyOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {sellOpen && tradeCoin && <SellModal key="sell" token={tradeCoin} onClose={() => setSellOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {filterOpen && <FilterModal key="filter" filters={filters} onApply={setFilters} onClose={() => setFilterOpen(false)} />}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
