'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  Search, X, Copy, ExternalLink, TrendingUp, TrendingDown,
  Flame, Zap, BarChart2, Layers, ChevronDown, Loader2,
  ArrowLeft, CheckCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
}

type TabId = 'trending' | 'launches' | 'cex' | 'all';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'launches', label: 'New Launches', icon: Zap },
  { id: 'cex', label: 'CEX', icon: BarChart2 },
  { id: 'all', label: 'All Tokens', icon: Layers },
];

const CHAIN_FILTERS = ['all', 'eth', 'sol', 'bsc', 'base', 'arb'];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function fmtPrice(p: number): string {
  if (!p && p !== 0) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  if (p >= 0.000001) return `$${p.toFixed(8)}`;
  return `$${p.toFixed(10)}`;
}

function fmtVol(n: number): string {
  if (!n && n !== 0) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtChange(v: number): string {
  if (!v && v !== 0) return '0.00%';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Source Badge
// ---------------------------------------------------------------------------
const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  binance: { bg: '#F0B90B22', text: '#F0B90B', label: 'Binance' },
  okx: { bg: '#FFFFFF15', text: '#CCCCCC', label: 'OKX' },
  coingecko: { bg: '#8DC63F22', text: '#8DC63F', label: 'CoinGecko' },
  dexscreener: { bg: '#0A1EFF22', text: '#6B8AFF', label: 'DexScreener' },
  pumpfun: { bg: '#A855F722', text: '#A855F7', label: 'pump.fun' },
  pumpswap: { bg: '#EC489922', text: '#EC4899', label: 'PumpSwap' },
};

function SourceBadge({ source }: { source: MarketToken['source'] }) {
  const cfg = SOURCE_COLORS[source] || { bg: '#ffffff15', text: '#aaa', label: source };
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chain Badge
// ---------------------------------------------------------------------------
const CHAIN_LABELS: Record<string, string> = {
  sol: 'SOL', eth: 'ETH', bsc: 'BSC', base: 'Base',
  arb: 'ARB', polygon: 'MATIC', avax: 'AVAX', multi: '', cex: '',
};

function ChainBadge({ chain }: { chain: string }) {
  const label = CHAIN_LABELS[chain.toLowerCase()] ?? chain.toUpperCase().slice(0, 4);
  if (!label) return null;
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-400 font-mono whitespace-nowrap">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Token Logo
// ---------------------------------------------------------------------------
function TokenLogo({ token, size = 36 }: { token: MarketToken; size?: number }) {
  const [error, setError] = useState(false);

  if (!error && token.logo) {
    return (
      <img
        src={token.logo}
        alt={token.symbol}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback: colored initial circle
  const colors = ['#0A1EFF', '#7C3AED', '#0891B2', '#059669', '#D97706'];
  const color = colors[token.symbol.charCodeAt(0) % colors.length];
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coin Row
// ---------------------------------------------------------------------------
function CoinRow({ token, onClick }: { token: MarketToken; onClick: () => void }) {
  const isUp = token.change24h >= 0;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors border-b border-white/[0.04] text-left"
    >
      <TokenLogo token={token} size={38} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-white text-sm truncate">{token.symbol}</span>
          <ChainBadge chain={token.chain} />
        </div>
        <span className="text-gray-500 text-xs truncate block">{token.name}</span>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="font-mono font-semibold text-white text-sm">{fmtPrice(token.price)}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? <span className="inline-block">&#9650;</span> : <span className="inline-block">&#9660;</span>}
            {' '}{Math.abs(token.change24h).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[70px]">
        <span className="text-xs text-gray-400">{fmtVol(token.volume24h)}</span>
        <SourceBadge source={token.source} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Coin Detail Modal (bottom sheet / right slide-over)
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-gray-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-white font-mono">{value}</span>
    </div>
  );
}

function CoinDetailModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const router = useRouter();
  const isUp = token.change24h >= 0;
  const hasDex = token.source === 'dexscreener' || token.source === 'pumpfun' || token.source === 'pumpswap';
  const dexChain = token.dexChain || token.chain;
  const dexAddress = token.pairAddress || token.address;
  const dexUrl = hasDex && dexAddress
    ? `https://dexscreener.com/${dexChain}/${dexAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;

  // TradingView symbol for CEX/CoinGecko
  const tvSymbol = `BINANCE:${token.symbol}USDT`;

  const handleBuy = () => {
    onClose();
    router.push(`/dashboard/swap?buy=${encodeURIComponent(token.symbol)}`);
  };

  const handleTrack = () => {
    onClose();
    router.push(`/dashboard/alerts?token=${encodeURIComponent(token.symbol)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:w-[420px] sm:h-full bg-[#0D1117] rounded-t-2xl sm:rounded-none sm:rounded-l-2xl border-t sm:border-t-0 sm:border-l border-white/[0.08] z-10 flex flex-col max-h-[90vh] sm:max-h-full overflow-hidden">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <TokenLogo token={token} size={40} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">{token.symbol}</span>
                <ChainBadge chain={token.chain} />
                <SourceBadge source={token.source} />
              </div>
              <span className="text-gray-400 text-xs">{token.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price Hero */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono text-white">{fmtPrice(token.price)}</span>
            <span className={`text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtChange(token.change24h)}
            </span>
          </div>
          {token.marketCap > 0 && (
            <span className="text-xs text-gray-500 mt-1 block">MCap: {fmtVol(token.marketCap)}</span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Chart */}
          <div className="mx-5 mt-4 rounded-xl overflow-hidden border border-white/[0.06]" style={{ height: 220 }}>
            {dexUrl ? (
              <iframe
                src={dexUrl}
                width="100%"
                height="220"
                style={{ border: 'none', display: 'block' }}
                title={`${token.symbol} DexScreener chart`}
              />
            ) : (
              <iframe
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=D&theme=dark&style=1&locale=en&enable_publishing=false&hide_top_toolbar=true&hide_legend=true&save_image=false`}
                width="100%"
                height="220"
                style={{ border: 'none', display: 'block' }}
                title={`${token.symbol} TradingView chart`}
              />
            )}
          </div>

          {/* Stats */}
          <div className="px-5 py-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Stats</div>
            {token.volume24h > 0 && <StatRow label="24h Volume" value={fmtVol(token.volume24h)} />}
            {token.marketCap > 0 && <StatRow label="Market Cap" value={fmtVol(token.marketCap)} />}
            {token.liquidity != null && token.liquidity > 0 && (
              <StatRow label="Liquidity" value={fmtVol(token.liquidity)} />
            )}
            <StatRow label="Price" value={fmtPrice(token.price)} />
            <StatRow label="24h Change" value={fmtChange(token.change24h)} />
          </div>

          {/* Contract address */}
          {token.address && (
            <div className="px-5 pb-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {hasDex ? 'Contract Address' : 'Ticker / ID'}
              </div>
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2.5 border border-white/[0.06]">
                <span className="text-xs text-gray-300 font-mono truncate flex-1">{token.address}</span>
                <CopyButton text={token.address} />
                {hasDex && (
                  <a
                    href={`https://dexscreener.com/${dexChain}/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.06] flex-shrink-0 bg-[#0D1117]">
          <button
            onClick={handleBuy}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-black transition-all"
          >
            Buy {token.symbol}
          </button>
          <button
            onClick={handleTrack}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.10] transition-all"
          >
            Track
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Market Page
// ---------------------------------------------------------------------------
function MarketPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>('trending');
  const [chainFilter, setChainFilter] = useState('all');
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MarketToken | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadTokens = useCallback(async (tab: TabId, chain: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tab, chain });
      const res = await fetch(`/api/market?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setTokens(data.tokens || []);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Failed to load market data.');
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens(activeTab, chainFilter);
    const interval = setInterval(() => loadTokens(activeTab, chainFilter), 30_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [activeTab, chainFilter, loadTokens]);

  const filtered = tokens.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.address?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-2 flex-shrink-0">
        <h1 className="text-xl font-bold text-white mb-1">Markets</h1>
        <p className="text-xs text-gray-500">Live prices across DEX, CEX &amp; new launches</p>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tokens, symbols, addresses…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0 px-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch(''); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold relative transition-colors ${
              activeTab === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
            {activeTab === id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0A1EFF] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Chain filter (only for All Tokens and Trending) */}
      {(activeTab === 'all' || activeTab === 'trending') && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-white/[0.04]">
          {CHAIN_FILTERS.map(c => (
            <button
              key={c}
              onClick={() => setChainFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                chainFilter === c
                  ? 'border-[#0A1EFF]/60 bg-[#0A1EFF]/20 text-white'
                  : 'border-white/[0.06] text-gray-500 hover:text-white'
              }`}
            >
              {c === 'all' ? 'All Chains' : c.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Token list */}
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
            <button
              onClick={() => loadTokens(activeTab, chainFilter)}
              className="text-xs text-[#0A1EFF] hover:underline"
            >
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

        {filtered.map((token, idx) => (
          <CoinRow
            key={`${token.symbol}__${token.source}__${idx}`}
            token={token}
            onClick={() => setSelected(token)}
          />
        ))}

        {/* Refresh indicator */}
        {tokens.length > 0 && (
          <div className="py-4 text-center">
            <span className="text-[10px] text-gray-600">
              {filtered.length} tokens · refreshes every 30s
              {loading && <span> · updating…</span>}
            </span>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <CoinDetailModal token={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
        </div>
      }
    >
      <MarketPageContent />
    </Suspense>
  );
}
