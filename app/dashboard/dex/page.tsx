'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, ExternalLink, RefreshCw, X, TrendingUp, TrendingDown,
  Layers, Zap, ChevronRight, BarChart2, ArrowLeft,
} from 'lucide-react';
import type { DexToken } from '@/app/api/dex-feed/route';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ms?: number): string {
  if (!ms) return '--';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtPrice(p?: number): string {
  if (p == null || isNaN(p)) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtNum(n?: number): string {
  if (n == null || isNaN(n)) return '--';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const CHAIN_COLOURS: Record<string, string> = {
  solana: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ethereum: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bsc: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  base: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
  arbitrum: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  polygon: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
};

function chainBadge(chain: string) {
  const cls = CHAIN_COLOURS[chain.toLowerCase()] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${cls}`}>
      {chain}
    </span>
  );
}

// ── Copy-to-clipboard button ──────────────────────────────────────────────────
function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [text]);
  return (
    <button
      onClick={handle}
      className={`p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white ${className}`}
      title="Copy address"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Token card ────────────────────────────────────────────────────────────────
interface TokenCardProps {
  token: DexToken;
  isNew: boolean;
  onClick: (t: DexToken) => void;
}

function TokenCard({ token, isNew, onClick }: TokenCardProps) {
  const positive = (token.change24h ?? 0) >= 0;

  return (
    <button
      onClick={() => onClick(token)}
      className={`w-full text-left rounded-xl border transition-all duration-200 p-3
        bg-[#0D1120] border-white/[0.06] hover:border-[#0A1EFF]/30 hover:bg-[#111827]
        ${isNew ? 'animate-new-token' : ''}
      `}
    >
      {/* Row 1: logo + name + chain */}
      <div className="flex items-center gap-2.5 mb-2">
        {token.imageUri ? (
          <img
            src={token.imageUri}
            alt={token.symbol}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-[#1a2035]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br from-[#0A1EFF] to-[#3d57ff] flex items-center justify-center text-[10px] font-bold text-white">
            {token.symbol.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold text-sm truncate">{token.name}</span>
            <span className="text-gray-500 text-xs flex-shrink-0">({token.symbol})</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {token.graduated && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30">
                Graduated
              </span>
            )}
            {chainBadge(token.chain)}
          </div>
        </div>
        {/* Price */}
        <div className="text-right flex-shrink-0">
          <div className="text-white font-mono text-sm">{fmtPrice(token.price)}</div>
          {token.change24h != null && (
            <div className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${positive ? 'text-green-400' : 'text-red-400'}`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {positive ? '+' : ''}{token.change24h.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Row 2: CA */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-gray-500 text-xs">CA:</span>
        <span className="text-gray-300 font-mono text-xs">{shortAddr(token.contractAddress)}</span>
        <CopyButton text={token.contractAddress} />
      </div>

      {/* Row 3: stats */}
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        {token.createdAt != null && (
          <span className="flex items-center gap-1">
            <span className="text-gray-600">Created</span>
            <span className="text-gray-400">{timeAgo(token.createdAt)}</span>
          </span>
        )}
        {token.marketCap != null && (
          <span className="flex items-center gap-1">
            <span className="text-gray-600">MCap:</span>
            <span className="text-gray-400">{fmtNum(token.marketCap)}</span>
          </span>
        )}
        {token.liquidity != null && (
          <span className="flex items-center gap-1">
            <span className="text-gray-600">Liq:</span>
            <span className="text-gray-400">{fmtNum(token.liquidity)}</span>
          </span>
        )}
        {token.volume24h != null && (
          <span className="flex items-center gap-1">
            <span className="text-gray-600">Vol:</span>
            <span className="text-gray-400">{fmtNum(token.volume24h)}</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ── Lightweight Chart for DEX tokens ─────────────────────────────────────────
function DexTokenChart({ token }: { token: DexToken }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: any = null;

    (async () => {
      const { createChart, CrosshairMode } = await import('lightweight-charts');
      const el = containerRef.current!;
      const isUp = (token.change24h ?? 0) >= 0;
      const color = isUp ? '#10B981' : '#EF4444';

      chart = createChart(el, {
        width: el.clientWidth,
        height: 300,
        layout: { background: { color: '#070B14' }, textColor: '#9CA3AF' },
        grid: { vertLines: { visible: false }, horzLines: { color: '#1F2937' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#374151' }, horzLine: { color: '#374151' } },
        handleScroll: false,
        handleScale: false,
      });

      const area = chart.addAreaSeries({
        lineColor: color,
        topColor: isUp ? '#10B98125' : '#EF444425',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });

      // Generate representative price data from 24h change
      const now = Date.now();
      const price = token.price ?? 0;
      const change = token.change24h ?? 0;
      const startPrice = price / (1 + change / 100);
      const points = 48;
      const data = Array.from({ length: points }, (_, i) => {
        const t = Math.floor((now - (points - i) * 30 * 60 * 1000) / 1000);
        const pct = i / (points - 1);
        const noise = (Math.random() - 0.5) * 0.015 * price;
        const val = startPrice + (price - startPrice) * pct + noise;
        return { time: t as any, value: Math.max(0, val) };
      });
      data[data.length - 1] = { time: Math.floor(now / 1000) as any, value: price };

      area.setData(data);
      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (el && chart) chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);
    })();

    return () => { chart?.remove(); };
  }, [token]);

  return <div ref={containerRef} className="w-full" style={{ height: 300 }} />;
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function TokenModal({ token, onClose }: { token: DexToken; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const swapHref = `/dashboard/swap?token=${token.contractAddress}&chain=${token.chain}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl bg-[#0A0E1A] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          {token.imageUri ? (
            <img src={token.imageUri} alt={token.symbol} className="w-10 h-10 rounded-full object-cover bg-[#1a2035]" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A1EFF] to-[#3d57ff] flex items-center justify-center text-sm font-bold text-white">
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-lg leading-none">{token.name}</h2>
              <span className="text-gray-400 text-sm">({token.symbol})</span>
              {token.graduated && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30">
                  Graduated
                </span>
              )}
              {chainBadge(token.chain)}
            </div>
            {/* CA row */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-gray-500 text-xs">CA:</span>
              <span className="text-gray-300 font-mono text-xs break-all">{token.contractAddress}</span>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04]">
          {[
            { label: 'Price', value: fmtPrice(token.price) },
            { label: 'Market Cap', value: fmtNum(token.marketCap) },
            { label: 'Liquidity', value: fmtNum(token.liquidity) },
            { label: 'Volume 24h', value: fmtNum(token.volume24h) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0A0E1A] px-4 py-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
              <div className="text-white font-semibold text-sm mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* STEINZ Price Chart */}
        <div className="bg-[#070B14] border-t border-white/[0.04]">
          <DexTokenChart token={token} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-white/[0.06]">
          <a
            href={swapHref}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A1EFF] hover:bg-[#0818CC] text-white font-semibold text-sm transition-colors"
          >
            <Zap className="w-4 h-4" />
            Buy on Swap
          </a>
          <a
            href={`/dashboard/security?ca=${encodeURIComponent(token.contractAddress)}&chain=${token.chain}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-gray-300 hover:text-white font-semibold text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Scan Contract
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type TabId = 'pumpfun' | 'pumpswap' | 'bonk' | 'fourmeme' | 'raydium' | 'new';
type AgeFilter = 'all' | '2m' | '5m' | '20m' | '1h' | '5h' | '12h';

const AGE_FILTERS: { id: AgeFilter; label: string; ms: number }[] = [
  { id: 'all', label: 'All', ms: Infinity },
  { id: '2m', label: '2m', ms: 2 * 60_000 },
  { id: '5m', label: '5m', ms: 5 * 60_000 },
  { id: '20m', label: '20m', ms: 20 * 60_000 },
  { id: '1h', label: '1h', ms: 60 * 60_000 },
  { id: '5h', label: '5h', ms: 5 * 60 * 60_000 },
  { id: '12h', label: '12h', ms: 12 * 60 * 60_000 },
];

const TABS: { id: TabId; label: string; icon: React.ElementType; subtitle: string }[] = [
  { id: 'pumpfun', label: 'pump.fun', icon: Zap, subtitle: 'SOL launches' },
  { id: 'pumpswap', label: 'PumpSwap', icon: ChevronRight, subtitle: 'Graduated' },
  { id: 'bonk', label: 'BONK', icon: BarChart2, subtitle: 'SOL memes' },
  { id: 'fourmeme', label: 'FourMeme', icon: Layers, subtitle: 'BSC launches' },
  { id: 'raydium', label: 'Raydium', icon: TrendingUp, subtitle: 'SOL DEX' },
  { id: 'new', label: 'New Pairs', icon: Layers, subtitle: 'All chains' },
];

export default function DexDiscoveryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('pumpfun');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [selectedToken, setSelectedToken] = useState<DexToken | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Client-side age filter
  const displayTokens = ageFilter === 'all'
    ? tokens
    : tokens.filter(t => {
        if (!t.createdAt) return true; // keep tokens without timestamp
        const filterMs = AGE_FILTERS.find(f => f.id === ageFilter)?.ms ?? Infinity;
        return (Date.now() - t.createdAt) <= filterMs;
      });

  const fetchTokens = useCallback(async (tab: TabId, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dex-feed?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tokens: DexToken[] } = await res.json();
      const incoming = data.tokens ?? [];

      if (isRefresh) {
        const freshIds = new Set(incoming.map((t) => t.id));
        const addedIds = incoming
          .filter((t) => !prevIdsRef.current.has(t.id))
          .map((t) => t.id);

        if (addedIds.length > 0) {
          setNewCount(addedIds.length);
          setNewIds(new Set(addedIds));
          // Clear highlight after 2s
          setTimeout(() => setNewIds(new Set()), 2000);
          // Clear banner after 5s
          setTimeout(() => setNewCount(0), 5000);
        }
        prevIdsRef.current = freshIds;
      } else {
        prevIdsRef.current = new Set(incoming.map((t) => t.id));
      }

      setTokens(incoming);
      setLastFetch(Date.now());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // On tab change: fetch fresh, reset polling
  useEffect(() => {
    setTokens([]);
    setNewCount(0);
    setNewIds(new Set());
    prevIdsRef.current = new Set();
    fetchTokens(activeTab, false);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchTokens(activeTab, true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTab, fetchTokens]);

  return (
    <div className="min-h-screen bg-[#060912] text-white">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">DEX Discovery</h1>
              <p className="text-gray-400 text-sm mt-0.5">Live token launches &amp; trending pairs</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {lastFetch && (
              <span className="text-[11px] text-gray-500 hidden sm:block">
                Updated {timeAgo(lastFetch)}
              </span>
            )}
            <button
              onClick={() => fetchTokens(activeTab, false)}
              disabled={loading}
              className="p-2 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* "X new tokens" banner */}
        {newCount > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            {newCount} new token{newCount !== 1 ? 's' : ''} appeared
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 border-b border-white/[0.06]">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
                  isActive
                    ? 'border-[#0A1EFF] text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0A1EFF]' : 'text-gray-600'}`} />
                {tab.label}
                <span className="hidden sm:inline text-[11px] text-gray-600">· {tab.subtitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Age filter bar */}
      <div className="px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide border-b border-white/[0.04]">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest flex-shrink-0 mr-1">Age</span>
        {AGE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setAgeFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              ageFilter === f.id
                ? 'bg-[#0A1EFF] text-white'
                : 'text-gray-500 hover:text-white bg-white/[0.03] border border-white/[0.06]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-4">
        {loading && tokens.length === 0 && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading tokens…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-red-400 font-medium">Failed to load data</div>
            <div className="text-gray-500 text-sm">{error}</div>
            <button
              onClick={() => fetchTokens(activeTab, false)}
              className="mt-2 px-4 py-2 rounded-lg bg-[#0A1EFF]/20 hover:bg-[#0A1EFF]/30 text-[#6b7fff] text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && displayTokens.length === 0 && (
          <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
            {tokens.length > 0 ? 'No tokens match the selected age filter.' : 'No tokens found.'}
          </div>
        )}

        {displayTokens.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayTokens.map((token) => (
              <TokenCard
                key={token.id}
                token={token}
                isNew={newIds.has(token.id)}
                onClick={setSelectedToken}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedToken && (
        <TokenModal token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}

      {/* Keyframe styles injected via a style tag */}
      <style>{`
        @keyframes newTokenFlash {
          0%   { background-color: rgb(34 197 94 / 0.18); border-color: rgb(34 197 94 / 0.5); }
          100% { background-color: transparent; border-color: rgb(255 255 255 / 0.06); }
        }
        .animate-new-token {
          animation: newTokenFlash 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
