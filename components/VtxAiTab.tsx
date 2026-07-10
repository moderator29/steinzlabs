'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
// Naka Labs brand icons — broad swap. BarChart3 aliased to ChartBar.
// Briefcase, Radio, Globe, Loader2, History stay on lucide.
import {
  BarChart3, AlertTriangle, Send, User, Crown, Lock, Plus, Settings,
  X, Clock, TrendingUp, TrendingDown, Shield, ExternalLink, RefreshCw, Copy,
  CheckCircle as Check,
  Briefcase, Radio, Loader2, Globe, History,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';
import { StreamingCursor } from '@/components/vtx/StreamingCursor';
import { MessageActions } from '@/components/vtx/MessageActions';
import { SuggestionPills } from '@/components/vtx/SuggestionPills';
import { VtxModelPicker, type VtxModelId } from '@/components/vtx/ModelPicker';
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge';
import { tokenLogoCandidates } from '@/lib/wallet/tokenLogoCandidates';

// §11 — Replace DexScreener / TradingView iframes with native
// lightweight-charts. Lazy-loaded so the lightweight-charts bundle
// (~50KB min+gz) only ships when the inline chart actually renders.
const AdvancedChart = dynamic(
  () => import('@/components/trading/AdvancedChart').then(m => m.AdvancedChart),
  { ssr: false, loading: () => <div className="w-full h-44 rounded-lg border border-white/10 flex items-center justify-center text-[11px] text-gray-500">Loading chart…</div> },
);

interface ChartInfo {
  type: 'price' | 'bubble' | 'portfolio' | 'holders';
  token?: string;
  address?: string;
  data?: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  chart?: ChartInfo;
  suggestions?: string[];
}

interface ChatHistoryEntry {
  id: string;
  date: string;
  messages: Message[];
  preview: string;
}

interface VtxSettings {
  personality: 'professional' | 'degen' | 'conservative' | 'neutral';
  defaultChain: 'solana' | 'ethereum' | 'bsc' | 'base' | 'polygon';
  language: string;
  depth: 'Quick' | 'Standard' | 'Deep';
  riskAppetite: 'Conservative' | 'Balanced' | 'Aggressive';
  autoCharts: boolean;
  webSearch: boolean;
  focusMode: boolean;
  messageSound: boolean;
}

const STORAGE_KEY = 'vtx-ai-chat-history';
const HISTORY_KEY = 'vtx_chat_history';
const SETTINGS_KEY = 'vtx_settings';
const TIER_KEY = 'steinz_user_tier';
const USAGE_KEY = 'vtx-ai-daily-usage';
const MODEL_KEY = 'naka_vtx_model';
// Records which authenticated user these VTX localStorage caches belong to, so a
// shared browser can detect an account switch and purge BEFORE loading cache into
// React state — mirrors the guard in app/dashboard/vtx-ai/page.tsx. The global
// syncCurrentUser() wipe also covers these keys, but it fires asynchronously from
// the auth listener; this synchronous mount guard closes the window where this
// tab could paint account A's history to account B before that wipe lands.
const CACHE_OWNER_KEY = 'vtx_cache_owner';
const VTX_LOCAL_KEYS = [STORAGE_KEY, HISTORY_KEY, SETTINGS_KEY, TIER_KEY, USAGE_KEY, MODEL_KEY];
function purgeVtxLocalCache() {
  for (const k of VTX_LOCAL_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}

function loadChatHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* Malformed JSON — return default */ }
  return [];
}

function saveChatHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch { /* localStorage unavailable — silently ignore */ }
}

function loadAllHistory(): ChatHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* Malformed JSON — return default */ }
  return [];
}

function saveAllHistory(entries: ChatHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30)));
  } catch { /* localStorage unavailable — silently ignore */ }
}

const DEFAULT_SETTINGS: VtxSettings = {
  personality: 'neutral',
  defaultChain: 'solana',
  language: 'English',
  depth: 'Standard',
  riskAppetite: 'Balanced',
  autoCharts: true,
  webSearch: false,
  focusMode: false,
  messageSound: false,
};

function loadSettings(): VtxSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.personality) return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch { /* Malformed JSON — return default */ }
  return { ...DEFAULT_SETTINGS };
}

function playChime() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* Provider rejected — silently ignore */ }
}

function saveSettings(s: VtxSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* localStorage unavailable — silently ignore */ }
}

function getUserTier(): string {
  try {
    return localStorage.getItem(TIER_KEY) || 'free';
  } catch {
    return 'free';
  }
}

function getDailyUsage(): { used: number; limit: number; remaining: number } {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.used === 'number') return parsed;
    }
  } catch { /* Malformed JSON — return default */ }
  // Free tier is 25/day (matches FREE_TIER_LIMIT in app/api/vtx-ai/route.ts and
  // the pricing page). The server's dailyUsage payload overrides this anyway.
  return { used: 0, limit: 25, remaining: 25 };
}

function saveDailyUsage(usage: { used: number; limit: number; remaining: number }) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch { /* localStorage unavailable — silently ignore */ }
}

// Token card data fetcher + renderer
interface TokenCardData {
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  pairAddress?: string;
  chain?: string;
  address?: string;
  logo?: string | null;
  /** TW/CMC identity verification (real "listed/verified" signal, not a heuristic). */
  verified?: boolean;
  dexUrl?: string;
}

function formatCompact(n: number): string {
  // Honest em-dash for unknown/zero — never a fake "$0.00" on a real token.
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(4)}`;
}

function formatPrice(n: number): string {
  if (!n || isNaN(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(4)}`;
}

function TokenStatsCard({ token, address }: { token?: string; address?: string }) {
  const [cardData, setCardData] = useState<TokenCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Real logo cascade: server-provided image → Trust Wallet asset registry →
  // lettered monogram (never a generated ui-avatars placeholder).
  const [logoIdx, setLogoIdx] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    setLogoIdx(0);
    try {
      // Route through /api/vtx/token-card — the ONE resolver that returns real,
      // cross-checked data (DexScreener + Trust Wallet verified market cap +
      // CoinMarketCap FDV/logo backstop) and honest empties. No client-side
      // heuristic trust score, no fabricated numbers.
      const isSolana = !!address && !address.startsWith('0x') && address.length >= 32;
      const chainGuess = isSolana ? 'solana' : 'ethereum';
      const url = address
        ? `/api/vtx/token-card?address=${encodeURIComponent(address)}&chain=${chainGuess}&tf=24h`
        : `/api/vtx/token-card?symbol=${encodeURIComponent(token || '')}&tf=24h`;
      const res = await fetch(url);
      if (!res.ok) { setError(true); setLoading(false); return; }
      const d = await res.json();
      // Unresolved token → explicit empty shape (source 'none'/'error'): show
      // nothing rather than a fake $0 card.
      if (!d || d.source === 'none' || d.source === 'error' || (!d.price && !d.marketCap)) {
        setError(true); setLoading(false); return;
      }
      setCardData({
        name: d.name || token || 'Unknown',
        symbol: (d.symbol || token || '').toUpperCase().replace(/^\$/, ''),
        price: d.price || 0,
        priceChange24h: d.change24h || 0,
        volume24h: d.volume24h || 0,
        liquidity: d.liquidity || 0,
        marketCap: d.marketCap || 0,
        fdv: d.fdv || 0,
        pairAddress: d.pairAddress,
        chain: d.chain || (address ? chainGuess : undefined),
        address: address || undefined,
        logo: d.logo ?? null,
        verified: Boolean(d.twVerified || d.cmcVerified),
        dexUrl: d.dexUrl,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token, address]);

  if (loading) {
    return (
      <div className="mt-2 p-3 bg-[#0d1117] rounded-xl border border-white/10 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066FF]" />
        <span className="text-[11px] text-gray-500">Fetching live token data...</span>
      </div>
    );
  }

  if (error || !cardData) return null;

  const isPositive = cardData.priceChange24h >= 0;
  const logoCandidates = tokenLogoCandidates({ primary: cardData.logo, address: cardData.address, chain: cardData.chain });
  const currentLogo = logoCandidates[logoIdx];

  return (
    <div className="mt-2 bg-[#0d1117] rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          {currentLogo ? (
            <img
              src={currentLogo}
              alt={cardData.symbol}
              className="w-8 h-8 rounded-full bg-[#0D1117] object-cover flex-shrink-0 border border-white/10"
              onError={() => setLogoIdx((i) => i + 1)}
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center border border-white/10 flex-shrink-0">
              <span className="text-[10px] font-bold text-[#0066FF]">{cardData.symbol.slice(0, 2)}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{cardData.symbol}</span>
              {/* Real §7 Naka Trust Score when we have a CA+chain (risk), else a
                  TW/CMC "Verified" identity chip. Never a heuristic label. */}
              {cardData.address && cardData.chain ? (
                <TrustScoreBadge chain={cardData.chain} address={cardData.address} size="sm" showLabel={false} />
              ) : cardData.verified ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20">Verified</span>
              ) : null}
            </div>
            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{cardData.name}</span>
          </div>
        </div>
        <div className="text-end">
          <div className="text-base font-bold text-white">{formatPrice(cardData.price)}</div>
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold justify-end ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{cardData.priceChange24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.04] border-t border-white/[0.06]">
        {[
          { label: '24h Volume', value: formatCompact(cardData.volume24h) },
          { label: 'Liquidity', value: formatCompact(cardData.liquidity) },
          { label: 'Market Cap', value: formatCompact(cardData.marketCap) },
          { label: 'FDV', value: formatCompact(cardData.fdv) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0d1117] px-3.5 py-2.5">
            <div className="text-[9px] text-gray-600 mb-0.5">{label}</div>
            <div className="text-[12px] font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {cardData.chain && (
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.06]">
          <span className="text-[9px] text-gray-600 capitalize">{cardData.chain} network</span>
          {cardData.dexUrl && (
            <a
              href={cardData.dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] text-[#0066FF] hover:text-[#6B7FFF] transition-colors font-semibold"
            >
              See on DEX <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function InlineChart({ type, token, address, data }: ChartInfo) {
  // Price chart — §11: replaced DexScreener and TradingView iframes
  // with native lightweight-charts via AdvancedChart. The OHLCV API
  // (/api/market/ohlcv/[chain]/[token]) accepts either a contract
  // address or a symbol; AdvancedChart shows a graceful error state
  // if the lookup fails (vs a broken iframe that just hangs).
  if (type === 'price') {
    if (address) {
      const isSolana = !address.startsWith('0x') && address.length >= 32;
      const chain = isSolana ? 'solana' : 'ethereum';
      return (
        <div className="mt-2 space-y-2">
          <TokenStatsCard address={address} token={token} />
          <div className="w-full rounded-lg overflow-hidden border border-white/10">
            <AdvancedChart
              chain={chain}
              token={address}
              tf="1h"
              chartType="candlestick"
              indicators={{ ema21: true, volume: true }}
              height={176}
              staticChart
            />
          </div>
        </div>
      );
    }
    return (
      <div className="mt-2 space-y-2">
        <TokenStatsCard token={token} />
        <div className="w-full rounded-lg overflow-hidden border border-white/10">
          <AdvancedChart
            chain="ethereum"
            token={token ?? 'ETH'}
            tf="1h"
            chartType="candlestick"
            indicators={{ ema21: true, volume: true }}
            height={176}
            staticChart
          />
        </div>
      </div>
    );
  }

  // Holder bar chart
  if (type === 'holders') {
    const holders: Array<{ label?: string; percentage: number }> = Array.isArray(data) && data.length > 0
      ? data.slice(0, 5)
      : [];
    return (
      <div className="mt-2 p-3 bg-[#0d1117] rounded-lg border border-white/10">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Top Holders Distribution</p>
        {holders.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">
            {address ? (
              <a
                href={`/dashboard/bubble-map?address=${address}`}
                className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
              >
                Open the full Bubble Map for live holder data →
              </a>
            ) : (
              'Holder distribution is not available for this token right now.'
            )}
          </div>
        ) : (
          holders.map((holder, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-gray-400 w-20 truncate flex-shrink-0">
                {holder.label || `Wallet ${i + 1}`}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2.5">
                <div
                  className="bg-purple-500 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-white w-10 text-end flex-shrink-0">
                {holder.percentage.toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    );
  }

  // Portfolio pie chart
  if (type === 'portfolio') {
    const gradientColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    const items: Array<{ label?: string; percentage: number }> = Array.isArray(data) && data.length > 0
      ? data.slice(0, 5)
      : [];

    if (items.length === 0) {
      return (
        <div className="mt-2 p-3 bg-[#0d1117] rounded-lg border border-white/10 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
          Loading portfolio breakdown...
        </div>
      );
    }

    // Build conic-gradient slices
    let cumulative = 0;
    const slices = items.map((item, i) => {
      const start = cumulative;
      cumulative += item.percentage;
      return { ...item, startDeg: (start / 100) * 360, endDeg: (cumulative / 100) * 360, color: gradientColors[i] };
    });

    const gradient = slices
      .map(s => `${s.color} ${s.startDeg.toFixed(1)}deg ${s.endDeg.toFixed(1)}deg`)
      .join(', ');

    return (
      <div className="mt-2 p-3 bg-[#0d1117] rounded-lg border border-white/10">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-3">Portfolio Breakdown</p>
        <div className="flex items-center gap-4">
          <div
            className="w-28 h-28 rounded-full flex-shrink-0"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          <div className="flex-1 space-y-1.5">
            {slices.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[10px] text-gray-300 flex-1 truncate">{s.label || `Token ${i + 1}`}</span>
                <span className="text-[10px] text-white">{s.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bubble map
  if (type === 'bubble') {
    const holders: Array<{ label?: string; percentage: number; address?: string }> = Array.isArray(data) && data.length > 0
      ? data.slice(0, 8)
      : [];

    // Pre-calculated positions for up to 8 bubbles in a cluster
    const positions = [
      { x: 50, y: 50 },
      { x: 20, y: 30 },
      { x: 75, y: 25 },
      { x: 15, y: 65 },
      { x: 70, y: 70 },
      { x: 40, y: 15 },
      { x: 85, y: 50 },
      { x: 35, y: 75 },
    ];

    return (
      <div className="mt-2 p-3 bg-[#0d1117] rounded-lg border border-white/10">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Holder Bubble Map</p>
        {holders.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">
            {address ? (
              <a
                href={`/dashboard/bubble-map?address=${address}`}
                className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
              >
                Open the full Bubble Map for live holder data →
              </a>
            ) : (
              'Holder distribution is not available for this token right now.'
            )}
          </div>
        ) : (
          <>
            <div className="relative w-full h-40 overflow-hidden">
              {holders.map((h, i) => {
                const pct = h.percentage || 1;
                const size = Math.max(24, Math.min(pct * 2.5, 64));
                const pos = positions[i] || { x: 50, y: 50 };
                return (
                  <div
                    key={i}
                    title={h.label || `Wallet ${i + 1}`}
                    style={{
                      width: size,
                      height: size,
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="rounded-full bg-purple-600/80 flex items-center justify-center text-[8px] text-white font-bold absolute border border-purple-400/30 cursor-default overflow-hidden"
                  >
                    {pct.toFixed(0)}%
                  </div>
                );
              })}
            </div>
            {address && (
              <a
                href={`/dashboard/bubble-map?address=${address}`}
                className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors mt-1"
              >
                View full Bubble Map →
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

export default function VtxAiTab() {
  const router = useRouter();
  const naka = useNakaWallet();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState('free');
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 25, remaining: 25 });
  const [rateLimited, setRateLimited] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // §model-picker — Fast/Balanced/Deepest reasoning depth, persisted per device.
  const [vtxModel, setVtxModel] = useState<VtxModelId>('balanced');
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState<VtxSettings>({ ...DEFAULT_SETTINGS });
  const [allHistory, setAllHistory] = useState<ChatHistoryEntry[]>([]);
  const [settingsToast, setSettingsToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // §5.3 — Stop button. Holds the live AbortController for the in-flight
  // SSE / fetch so the user can interrupt long-running replies. Cleared
  // after every send (success or failure).
  const abortRef = useRef<AbortController | null>(null);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);

  // §11.1 — preload the AdvancedChart bundle the moment the VTX tab
  // mounts so the first chart render skips the dynamic-import wait.
  // Without this, the user sees "Loading chart…" for ~600-1200ms while
  // the lightweight-charts chunk downloads. Pre-warming it on tab open
  // means by the time the user sends a token query the chunk is in the
  // browser's module cache and the chart appears instantly.
  useEffect(() => {
    void import('@/components/trading/AdvancedChart');
  }, []);

  const handleModelChange = (id: VtxModelId) => {
    setVtxModel(id);
    try { localStorage.setItem(MODEL_KEY, id); } catch { /* storage disabled — session-only */ }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      // ── Cross-account isolation guard ──────────────────────────────────────
      // Confirm the cached VTX state belongs to the CURRENT authenticated user
      // before loading any of it. If this browser last cached a DIFFERENT user
      // (or nobody), purge first so account B never sees account A's VTX
      // conversations / history / settings / model choice on a shared device.
      let uid: string | null = null;
      try { const { data } = await supabase.auth.getUser(); uid = data?.user?.id ?? null; } catch { uid = null; }
      let owner: string | null = null;
      try { owner = localStorage.getItem(CACHE_OWNER_KEY); } catch { owner = null; }
      if (owner !== uid) {
        purgeVtxLocalCache();
        try { if (uid) localStorage.setItem(CACHE_OWNER_KEY, uid); else localStorage.removeItem(CACHE_OWNER_KEY); } catch { /* ignore */ }
      }

      const saved = loadChatHistory();
      if (saved.length > 0) setMessages(saved);
      setTier(getUserTier());
      setDailyUsage(getDailyUsage());
      setSettings(loadSettings());
      setAllHistory(loadAllHistory());

      // §model-picker — restore the persisted reasoning-depth choice.
      try {
        const stored = localStorage.getItem(MODEL_KEY);
        if (stored === 'fast' || stored === 'balanced' || stored === 'deepest') setVtxModel(stored);
      } catch { /* storage disabled — keep the default */ }
    })();
  }, []);

  useEffect(() => {
    if (initialized.current && messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickActions = [
    { icon: BarChart3, label: 'Market Overview', prompt: 'Give me a quick overview of the current crypto market. What are the major trends today?' },
    { icon: Briefcase, label: 'Portfolio Check', prompt: 'What are the best strategies for diversifying a crypto portfolio right now?' },
    { icon: AlertTriangle, label: 'Risk Analysis', prompt: 'What are the biggest risks in the crypto market right now? Any red flags to watch?' },
    { icon: Radio, label: 'Signal Analysis', prompt: 'What on-chain signals are showing the most bullish or bearish activity right now?' },
  ];

  const saveCurrentToHistory = () => {
    if (messages.length === 0) return;
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0) return;
    const entry: ChatHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      messages,
      preview: userMsgs[0].content.slice(0, 40),
    };
    const updated = [entry, ...allHistory].slice(0, 30);
    setAllHistory(updated);
    saveAllHistory(updated);
  };

  const startNewChat = () => {
    saveCurrentToHistory();
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setShowHistory(false);
  };

  const loadHistoryEntry = (entry: ChatHistoryEntry) => {
    setMessages(entry.messages);
    saveChatHistory(entry.messages);
    setShowHistory(false);
  };

  const updateSettings = (partial: Partial<VtxSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    saveSettings(updated);
    // Show "Settings saved" toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSettingsToast(true);
    toastTimerRef.current = setTimeout(() => setSettingsToast(false), 1800);
  };

  const isPro = tier === 'pro' || tier === 'max';

  const personalityLabels: Record<string, string> = {
    professional: 'Professional Analyst',
    degen: 'Degen Trader',
    conservative: 'Conservative Advisor',
    neutral: 'Neutral',
  };

  const chainLabels: Record<string, string> = {
    solana: 'Solana',
    ethereum: 'Ethereum',
    bsc: 'BSC',
    base: 'Base',
    polygon: 'Polygon',
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!isPro && rateLimited) return;

    let finalMessage = text.trim();
    if (settings.webSearch) {
      finalMessage = finalMessage + ' [WEB_SEARCH]';
    }

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      // Phase D — opt into streaming for plain-text replies. Backend
      // route at /api/vtx-ai already supports SSE via {stream: true}.
      // We use a heuristic: if the message likely needs tool-use
      // (price/swap/buy/sell/chart keywords), fall back to the
      // non-streaming path so charts + tool results land correctly.
      // Otherwise stream tokens for instant feedback. Industry parity
      // with Claude.ai / ChatGPT / Perplexity: visible token streaming
      // is now table stakes for AI chat UX.
      // Must mirror the route's card triggers EXACTLY, or a card-worthy
      // message streams and silently drops its card (the streaming `done`
      // event returns only text, not chart/tokenCard/swapCard). The route
      // builds a swap card on swap|convert|trade|exchange, and a token card on
      // any $SYMBOL mention OR a raw EVM/Solana address (detectTokenAddress).
      // The address regex stays case-sensitive (base58) — kept separate from
      // the case-insensitive keyword/symbol test.
      const TOOL_USE_KEYWORDS = /\b(buy|sell|swap|convert|exchange|chart|price of|price for|trade|send|approve)\b|\$[A-Za-z]{2,10}\b/i;
      // Common token names — mirrors the route's symbolQuery KNOWN list so a
      // bare "eth" / "price of sol" / "tell me about bonk" still takes the
      // card path (the route builds a token card for any of these).
      const TOKEN_NAMES = /\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|binance coin|xrp|usdt|tether|usdc|doge(coin)?|pepe|shiba?( inu)?|avax|avalanche|matic|polygon|arbitrum|arb|sui|ton|chainlink|link|uniswap|uni|aave|bonk|wif|jupiter|jup)\b/i;
      const TOKEN_ADDRESS = /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/;
      const needsCard = TOOL_USE_KEYWORDS.test(finalMessage) || TOKEN_NAMES.test(finalMessage) || TOKEN_ADDRESS.test(finalMessage);
      const useStream = !needsCard;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: finalMessage,
          history: messages.slice(-10),
          tier,
          personality: settings.personality,
          language: settings.language,
          depth: settings.depth,
          riskAppetite: settings.riskAppetite,
          autoCharts: settings.autoCharts,
          focusMode: settings.focusMode,
          defaultChain: settings.defaultChain,
          model: vtxModel,
          stream: useStream,
          context: {
            walletAddress: naka.address,
            currentPage: 'vtx-tab',
          },
        }),
      });

      // ── Streaming branch ────────────────────────────────────────────
      if (useStream && response.ok && response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedText = '';
        let streamDone = false;
        let finalReply = '';
        // Push an empty assistant message we'll progressively fill.
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE is event-delimited by blank lines (\n\n).
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const event = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf('\n\n');
            const dataLine = event.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const json = JSON.parse(dataLine.slice(5).trim()) as { delta?: string; done?: boolean; reply?: string; error?: string; suggestions?: unknown; chartType?: string; chartData?: unknown; chartAddress?: string; chartToken?: string };
              if (json.error) {
                throw new Error(json.error);
              }
              if (typeof json.delta === 'string' && json.delta.length > 0) {
                streamedText += json.delta;
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: streamedText };
                  }
                  return next;
                });
              }
              if (json.done) {
                streamDone = true;
                finalReply = json.reply ?? streamedText;
                // Run the same chart-tag scan we use on the non-streaming
                // path so embedded [CHART:type] tags activate the inline
                // chart panel.
                const chartTagMatch = finalReply.match(/\[CHART:(price|bubble|portfolio|holders)\]/i);
                const cleanReply = finalReply.replace(/\[CHART:(price|bubble|portfolio|holders)\]/gi, '').trim();
                let chartInfo: ChartInfo | undefined;
                if (chartTagMatch) {
                  chartInfo = { type: chartTagMatch[1].toLowerCase() as ChartInfo['type'] };
                }
                // The route may stream structured chart fields alongside the
                // reply (e.g. holder/bubble token-card data). When present,
                // use them so those charts render with real data instead of an
                // empty panel; otherwise the [CHART:...] tag behaviour stands.
                if (!chartInfo && typeof json.chartType === 'string') {
                  chartInfo = { type: json.chartType.toLowerCase() as ChartInfo['type'] };
                }
                if (chartInfo) {
                  if (json.chartData !== undefined) chartInfo.data = json.chartData;
                  if (typeof json.chartAddress === 'string') chartInfo.address = json.chartAddress;
                  if (typeof json.chartToken === 'string') chartInfo.token = json.chartToken;
                }
                const streamedSuggestions: string[] | undefined = Array.isArray(json.suggestions)
                  ? (json.suggestions as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 4)
                  : undefined;
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    next[next.length - 1] = {
                      ...last,
                      content: cleanReply,
                      chart: chartInfo && settings.autoCharts ? chartInfo : undefined,
                      suggestions: streamedSuggestions,
                    };
                  }
                  return next;
                });
                if (settings.messageSound) playChime();
              }
            } catch (parseErr) {
              console.warn('[vtx-stream] event parse failed:', parseErr);
            }
          }
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setMessages(prev => [...prev, { role: 'assistant', content: `Daily free limit of ${dailyUsage.limit} messages reached. Upgrade to Naka Pro for unlimited VTX Agent access and web search.` }]);
        if (data.usage) {
          const usage = { used: data.usage.used, limit: data.usage.limit, remaining: data.usage.remaining };
          setDailyUsage(usage);
          saveDailyUsage(usage);
        }
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        // Parse chart signals from the API response
        let chartInfo: ChartInfo | undefined;

        // 1. Check if the API explicitly returned a chart field. The route
        //    returns an object ({ type, token, address, data }); older shapes
        //    may still send a bare type string, so handle both.
        if (data.chart) {
          if (typeof data.chart === 'object') {
            chartInfo = {
              type: data.chart.type as ChartInfo['type'],
              token: data.chart.token ?? data.chartToken,
              address: data.chart.address ?? data.chartAddress,
              data: data.chart.data ?? data.chartData,
            };
          } else {
            chartInfo = {
              type: data.chart as ChartInfo['type'],
              token: data.chartToken,
              address: data.chartAddress,
              data: data.chartData,
            };
          }
        }

        // 2. Scan reply text for [CHART:type] tags
        if (!chartInfo) {
          const chartTagMatch = data.reply?.match(/\[CHART:(price|bubble|portfolio|holders)\]/i);
          if (chartTagMatch) {
            chartInfo = {
              type: chartTagMatch[1].toLowerCase() as ChartInfo['type'],
              token: data.chartToken,
              address: data.chartAddress,
              data: data.chartData,
            };
          }
        }

        // Strip any remaining [CHART:...] tags from displayed content
        const cleanReply = (data.reply || '').replace(/\[CHART:(price|bubble|portfolio|holders)\]/gi, '').trim();

        const assistantMsg: Message = { role: 'assistant', content: cleanReply };
        if (chartInfo && settings.autoCharts) assistantMsg.chart = chartInfo;
        if (Array.isArray(data.suggestions)) {
          assistantMsg.suggestions = (data.suggestions as unknown[])
            .filter((s): s is string => typeof s === 'string')
            .slice(0, 4);
        }

        setMessages(prev => [...prev, assistantMsg]);
        if (settings.messageSound) playChime();
        if (data.dailyUsage) {
          setDailyUsage(data.dailyUsage);
          saveDailyUsage(data.dailyUsage);
          if (data.dailyUsage.remaining <= 0) setRateLimited(true);
        }
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      if (!aborted) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please try again.' }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const copyMessage = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAt(idx);
      setTimeout(() => setCopiedAt((v) => (v === idx ? null : v)), 1500);
    } catch {
      /* clipboard denied — non-fatal */
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="glass rounded-xl p-3 border border-white/10 flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <SteinzLogo size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold">VTX Agent</div>
            {isPro && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded text-[9px] text-amber-400 font-bold">
                <Crown className="w-2.5 h-2.5" /> PRO
              </span>
            )}
          </div>
          {!isPro && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${dailyUsage.remaining <= 3 ? 'bg-red-500' : dailyUsage.remaining <= 7 ? 'bg-amber-500' : 'bg-[#0066FF]'}`}
                  style={{ width: `${(dailyUsage.used / dailyUsage.limit) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-gray-500">{dailyUsage.remaining} left</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startNewChat}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="New chat"
          >
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setShowSettings(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-[#0066FF]/20 text-[#0066FF]' : 'hover:bg-white/10 text-gray-400'}`}
            title="Chat history"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-[#0066FF]/20 text-[#0066FF]' : 'hover:bg-white/10 text-gray-400'}`}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Toast */}
      {settingsToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-[#0066FF]/90 text-white text-[11px] font-semibold rounded-full shadow-lg pointer-events-none animate-fade-in">
          Settings saved
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass rounded-xl border border-white/10 p-3 mb-4 flex-shrink-0 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-300">Agent Settings</span>
            <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          {/* Section: Response Style */}
          <div className="mb-3">
            <p className="text-[9px] text-[#0066FF] uppercase tracking-widest font-bold mb-2">Response Style</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Personality</label>
                <select
                  value={settings.personality}
                  onChange={(e) => updateSettings({ personality: e.target.value as VtxSettings['personality'] })}
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0066FF]/40"
                >
                  <option value="professional">Professional Analyst</option>
                  <option value="degen">Degen Trader</option>
                  <option value="conservative">Conservative Advisor</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Analysis Depth</label>
                <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
                  {(['Quick', 'Standard', 'Deep'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateSettings({ depth: d })}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${settings.depth === d ? 'bg-[#0066FF] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Response Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0066FF]/40"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Korean">Korean</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Risk Appetite</label>
                <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
                  {([
                    { value: 'Conservative', icon: 'C' },
                    { value: 'Balanced', icon: 'B' },
                    { value: 'Aggressive', icon: 'A' },
                  ] as const).map(({ value, icon }) => (
                    <button
                      key={value}
                      onClick={() => updateSettings({ riskAppetite: value })}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-1 ${settings.riskAppetite === value ? 'bg-[#0066FF] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <span>{icon}</span>
                      <span className="hidden sm:inline">{value}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-600 mt-1">
                  {settings.riskAppetite === 'Conservative' && 'Emphasizes downside risks and safer alternatives'}
                  {settings.riskAppetite === 'Balanced' && 'Balanced view of risks and opportunities'}
                  {settings.riskAppetite === 'Aggressive' && 'Focus on high-risk/high-reward opportunities'}
                </p>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Default Chain</label>
                <select
                  value={settings.defaultChain}
                  onChange={(e) => updateSettings({ defaultChain: e.target.value as VtxSettings['defaultChain'] })}
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0066FF]/40"
                >
                  <option value="solana">Solana</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="bsc">BSC</option>
                  <option value="base">Base</option>
                  <option value="polygon">Polygon</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Features */}
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-[9px] text-[#0066FF] uppercase tracking-widest font-bold mb-2">Features</p>
            <div className="space-y-2.5">
              {/* Web Search */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">Web Search</p>
                  <p className="text-[9px] text-gray-600">Include live web results in context</p>
                </div>
                <button
                  onClick={() => updateSettings({ webSearch: !settings.webSearch })}
                  className={`w-8 sm:w-9 h-5 rounded-md transition-colors relative flex-shrink-0 ${settings.webSearch ? 'bg-[#0066FF]' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-[3px] absolute top-[3px] transition-all ${settings.webSearch ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>

              {/* Auto Charts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">Auto-show Charts</p>
                  <p className="text-[9px] text-gray-600">Render inline charts when AI signals them</p>
                </div>
                <button
                  onClick={() => updateSettings({ autoCharts: !settings.autoCharts })}
                  className={`w-8 sm:w-9 h-5 rounded-md transition-colors relative flex-shrink-0 ${settings.autoCharts ? 'bg-[#0066FF]' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-[3px] absolute top-[3px] transition-all ${settings.autoCharts ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>

              {/* Focus Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">Focus Mode</p>
                  <p className="text-[9px] text-gray-600">Expand chat area while messaging</p>
                </div>
                <button
                  onClick={() => updateSettings({ focusMode: !settings.focusMode })}
                  className={`w-8 sm:w-9 h-5 rounded-md transition-colors relative flex-shrink-0 ${settings.focusMode ? 'bg-[#0066FF]' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-[3px] absolute top-[3px] transition-all ${settings.focusMode ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>

              {/* Message Sound */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">Message Sound</p>
                  <p className="text-[9px] text-gray-600">Chime when VTX replies</p>
                </div>
                <button
                  onClick={() => updateSettings({ messageSound: !settings.messageSound })}
                  className={`w-8 sm:w-9 h-5 rounded-md transition-colors relative flex-shrink-0 ${settings.messageSound ? 'bg-[#0066FF]' : 'bg-white/10'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-[3px] absolute top-[3px] transition-all ${settings.messageSound ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] mt-3">
            <p className="text-[9px] text-gray-600">Active: {personalityLabels[settings.personality]} · {chainLabels[settings.defaultChain]} · {settings.depth} · {settings.riskAppetite}</p>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="glass rounded-xl border border-white/10 p-3 mb-4 flex-shrink-0 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-300">Chat History</span>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewChat}
                className="px-2 py-1 bg-[#0066FF]/20 border border-[#0066FF]/30 rounded text-[9px] text-[#0066FF] font-semibold hover:bg-[#0066FF]/30 transition-colors"
              >
                + New Chat
              </button>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/10 rounded ms-1">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>
          {allHistory.length === 0 ? (
            <p className="text-[10px] text-gray-600 text-center py-3">No previous chats saved</p>
          ) : (
            <div className="space-y-1.5">
              {allHistory.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadHistoryEntry(entry)}
                  className="w-full text-start p-2.5 nl-glass rounded-lg hover:border-[#0066FF]/20 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                    <span className="text-[9px] text-gray-600">{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{entry.preview}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <p className="text-sm text-gray-300 text-center mb-6 leading-relaxed px-2">
            Ask me anything. I search for real-time prices, trends, and on-chain data before answering. Try asking about current BTC price or market trends.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#0066FF]/20 transition-all text-start"
                >
                  <Icon className="w-5 h-5 text-[#0066FF] mb-2" />
                  <div className="text-xs font-semibold">{action.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-hide min-h-0" style={{ maxHeight: settings.focusMode ? '70vh' : '45vh' }}>
          {messages.map((msg, i) => {
            const isLastAssistant =
              msg.role === 'assistant' && i === messages.length - 1;
            const isStreamingHere = loading && isLastAssistant;
            const cleanedAssistant =
              msg.role === 'assistant'
                ? msg.content
                    // Strip emphasis to a space so inline bold with no leading
                    // space ("now.**Straight**") doesn't glue into "now.Straight".
                    .replace(/\*\*/g, ' ')
                    .replace(/\*/g, ' ')
                    .replace(/^#{1,6}\s/gm, '')
                    .replace(/^[-]+\s/gm, '')
                    .replace(/^—\s/gm, '')
                    .replace(/[ \t]{2,}/g, ' ')
                    .replace(/[ \t]+\n/g, '\n')
                    .replace(/\n[ \t]+/g, '\n')
                : msg.content;
            return (
              <div
                key={i}
                className={`group flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <SteinzLogo size={18} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#0066FF]/20 to-[#7C3AED]/20 border border-[#0066FF]/20'
                      : 'glass border border-white/10'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {cleanedAssistant}
                    {isStreamingHere && <StreamingCursor />}
                  </div>
                  {msg.role === 'assistant' && msg.chart && (
                    <InlineChart
                      type={msg.chart.type}
                      token={msg.chart.token}
                      address={msg.chart.address}
                      data={msg.chart.data}
                    />
                  )}
                  {msg.content && (
                    <MessageActions
                      text={msg.content}
                      role={msg.role}
                      streaming={isStreamingHere}
                      onStop={isStreamingHere ? stopGeneration : undefined}
                      onCopyMarkdown={msg.role === 'assistant' ? () => copyMessage(msg.content, i) : undefined}
                      onRegenerate={
                        msg.role === 'assistant' && !isStreamingHere
                          ? () => {
                              const prevUser = [...messages.slice(0, i)].reverse().find(m => m.role === 'user');
                              if (prevUser) sendMessage(prevUser.content);
                            }
                          : undefined
                      }
                      onEdit={
                        msg.role === 'user' && !loading
                          ? () => setMessage(msg.content)
                          : undefined
                      }
                    />
                  )}
                  {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !isStreamingHere && (
                    <SuggestionPills
                      suggestions={msg.suggestions}
                      onPick={(s) => sendMessage(s)}
                    />
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-[#1A2235] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-7 h-7 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <SteinzLogo size={18} />
              </div>
              <div className="glass border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching Sargon Data Archive...
                </div>
              </div>
              <button
                type="button"
                onClick={stopGeneration}
                className="ms-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg border border-white/15 text-slate-300 hover:bg-white/[0.05]"
                title="Stop generating"
              >
                Stop
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {rateLimited && !isPro && (
        <div className="flex items-center gap-3 p-3 mb-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl flex-shrink-0">
          <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] text-amber-300 font-semibold">Daily limit reached</p>
            <p className="text-[10px] text-gray-400">Upgrade to Naka Pro for unlimited messages</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/pricing')}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-[10px] font-bold text-black hover:scale-105 transition-transform"
          >
            Upgrade
          </button>
        </div>
      )}

      <div className="flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#111827] border border-white/10 rounded-xl px-3">
            {/* §model-picker — reasoning depth (Fast / Balanced / Deepest). */}
            <VtxModelPicker value={vtxModel} onChange={handleModelChange} />
            <button
              type="button"
              onClick={() => updateSettings({ webSearch: !settings.webSearch })}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all flex-shrink-0 ${settings.webSearch ? 'bg-[#0066FF]/20 text-[#0066FF] border border-[#0066FF]/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={settings.webSearch ? 'Web search enabled' : 'Enable web search'}
            >
              <Globe className="w-3 h-3" />
              Web
            </button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask VTX Agent about markets, signals, risk..."
              className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500 py-3"
              disabled={loading || (rateLimited && !isPro)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !message.trim() || (rateLimited && !isPro)}
            className="w-10 h-10 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] rounded-xl flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
