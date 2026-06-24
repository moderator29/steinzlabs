'use client';

import { Send, Sparkles, TrendingUp, Shield, BarChart3, User, Copy, Check, Trash2, Globe, Lock, Settings, Wrench, Search, Target, Eye, ChevronDown, X, Wallet, Network, MessageSquarePlus, History, ChevronRight, Clock } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect, Suspense } from 'react';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';
import { supabase } from '@/lib/supabase';
import { VtxConversationsRail } from '@/components/vtx/VtxConversationsRail';
import { VtxToolSidecar, type SidecarTokenCard, type SidecarToolEvent, type SidecarPendingSwap } from '@/components/vtx/VtxToolSidecar';
import { VtxSettingsDrawer } from '@/components/vtx/VtxSettingsDrawer';
import { SwapCard, type SwapCardData } from '@/components/vtx/SwapCard';
import { PriceCard } from '@/components/market/PriceCard';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';
import { useFeatureUsageLog } from '@/lib/hooks/useFeatureUsageLog';

// TokenCardData accepts both legacy string fields (parsed from reply text)
// and the richer server shape (numbers + contractAddress + chain) so the
// rich token card can route Buy/Swap to the real on-chain address.
interface TokenCardData {
  symbol: string;
  name: string;
  price: string;
  change24h: number;
  volume: string;
  marketCap: string;
  chain: string;
  logo?: string;
  rank?: number;
  liquidity?: string;
  fdv?: string;
  holders?: string;
  // New (from server `tokenCard`)
  address?: string;
  pairAddress?: string;
  dexUrl?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  tokenCards?: TokenCardData[];
  swapCard?: SwapCardData & { walletAddress?: string; needsWallet?: boolean };
  suggestions?: string[];
}

const STORAGE_KEY = 'vtx-ai-page-history';
const HISTORY_INDEX_KEY = 'vtx_chat_history';
const TIER_KEY = 'steinz_user_tier';
const USAGE_KEY = 'vtx-ai-daily-usage';
const SETTINGS_KEY = 'vtx_settings';

interface AgentSettings {
  webSearch: boolean;
  responseStyle: 'concise' | 'detailed';
  autoContext: boolean;
  personality: 'professional' | 'degen' | 'conservative' | 'neutral';
  defaultChain: 'solana' | 'ethereum' | 'bsc' | 'base' | 'polygon';
  language: string;
  depth: 'Quick' | 'Standard' | 'Deep';
  riskAppetite: 'Conservative' | 'Balanced' | 'Aggressive';
  autoCharts: boolean;
  focusMode: boolean;
  messageSound: boolean;
}

interface ChatHistoryEntry {
  id: string;
  date: string;
  messages: Message[];
  preview: string;
}

function loadHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* Malformed JSON — return default */ }
  return [
    { role: 'assistant', content: 'VTX Agent online. I pull live market data, on-chain intelligence, and security analysis before every response. What do you need?', timestamp: Date.now() },
  ];
}

function saveHistory(messages: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch { /* localStorage unavailable — silently ignore */ }
}

async function syncHistoryToSupabase(messages: Message[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recent = messages.slice(-50);
    const title = recent.find(m => m.role === 'user')?.content?.slice(0, 60) || 'VTX Conversation';
    await fetch('/api/vtx/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, messages: recent }),
    });
  } catch (err) {
    console.error('[VTX] Failed to sync history to Supabase:', err instanceof Error ? err.message : err);
  }
}

function getUserTier(): string {
  try { return localStorage.getItem(TIER_KEY) || 'free'; } catch { return 'free'; }
}

function getDailyUsage(): { used: number; limit: number; remaining: number } {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    if (stored) { const p = JSON.parse(stored); if (p && typeof p.used === 'number') return p; }
  } catch { /* Malformed JSON — return default */ }
  return { used: 0, limit: 25, remaining: 25 };
}

function saveDailyUsage(u: { used: number; limit: number; remaining: number }) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* localStorage unavailable — silently ignore */ }
}

// FIX 5A.1 / Phase 5: shared number formatter for server-shape token cards.
function fmtNum(n: unknown): string {
  const v = typeof n === 'number' ? n : parseFloat(String(n || 0));
  if (!v || !isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function parseTokenCards(content: string): TokenCardData[] {
  const cards: TokenCardData[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z]{2,10}):\s*\$([0-9,.]+)\s*\(24h:\s*([+-]?[0-9.]+)%.*?MCap:\s*\$([0-9.]+[BMK]?).*?Vol:\s*\$([0-9.]+[BMK]?)/);
    if (match) {
      const sym = match[1];
      cards.push({
        symbol: sym,
        name: sym,
        price: `$${match[2]}`,
        change24h: parseFloat(match[3]),
        marketCap: `$${match[4]}`,
        volume: `$${match[5]}`,
        chain: 'multi',
        logo: `https://assets.coingecko.com/coins/images/1/small/bitcoin.png`,
      });
    }
  }
  return cards.slice(0, 8);
}

function generateSuggestions(content: string): string[] {
  const lower = content.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc')) {
    return ['Show me ETH analysis', 'What about SOL?', 'Compare BTC vs ETH'];
  }
  if (lower.includes('ethereum') || lower.includes('eth')) {
    return ['Show me SOL analysis', 'Top DeFi tokens', 'ETH gas tracker'];
  }
  if (lower.includes('solana') || lower.includes('sol')) {
    return ['Trending Solana tokens', 'SOL whale activity', 'Compare SOL vs ETH'];
  }
  if (lower.includes('market') || lower.includes('overview')) {
    return ['Trending tokens now', 'Fear & Greed breakdown', 'Top gainers today'];
  }
  if (lower.includes('scam') || lower.includes('risk') || lower.includes('danger')) {
    return ['How to spot rug pulls', 'Check another address', 'Security best practices'];
  }
  if (lower.includes('whale') || lower.includes('smart money')) {
    return ['Biggest moves today', 'Track specific whale', 'Smart money flows'];
  }
  return ['Market overview', 'Trending tokens', 'Check a wallet'];
}

// Lana-AI-style token card — chain logo, big price + change, wide line chart,
// and a spec row (Volume / Holders / MCap / Liquidity / FDV). No Buy/Swap
// buttons on the card — this is an intel surface, not a trade surface. If
// the user wants to swap, they ask VTX and get a separate Swap Card.
// Bug §4 — VTX TokenCard used to render 'Loading chart…' text while a
// per-card fetch ran. Watchlist tiles felt instant because they receive
// pre-computed sparkline data in props. Two changes here:
//   1. Module-level in-memory cache (per session) keyed on address|symbol.
//      Second + subsequent renders of the same token render instantly.
//   2. Replace the textual 'Loading chart…' placeholder with a subtle
//      animated skeleton so even a first-time render feels populated
//      while the real points stream in.
const VTX_CHART_CACHE: Map<string, { points: number[]; changePct: number; price: number | null; change24h: number | null; volume24h?: number; liquidity?: number; marketCap?: number; fdv?: number; supply?: number | null; name?: string; cachedAt: number }> = new Map();
const VTX_CHART_TTL_MS = 5 * 60 * 1000;

function chartCacheKey(token: TokenCardData): string {
  // Crash fix — when both token.address and token.symbol were undefined
  // (server-shape tokenCard from /api/vtx-ai missing fields), this threw
  // 'Cannot read properties of undefined (reading toLowerCase)' which
  // crashed the entire messages.map() render. That's the source of the
  // 'empty middle column' bug — every TokenCard inside any prior message
  // would explode and React would bail on the whole map.
  const key = String(token.address ?? token.symbol ?? 'unknown');
  return `${key.toLowerCase()}:${String(token.chain ?? '').toLowerCase()}`;
}

function TokenCard({ token }: { token: TokenCardData }) {
  // Deep-dive fix — the price the LLM emitted (token.price) is whatever
  // was true the instant the model wrote the card, often 1-5s stale by
  // the time the card mounts. /api/vtx/token-card already returns a
  // fresh `price` and `change24h` alongside the chart points in the
  // SAME response we're already firing for the sparkline, so we just
  // pull them out of the same fetch — no second round-trip.
  // Token logo is rendered by <TokenLogo> inside <PriceCard> (handles fallback).

  // Unified: chart cache (Round-1 fix/vtx-card-instant-chart) AND live
  // price/change extracted from the same fetch (round-2 reliability fix).
  // Cache key + TTL guard means subsequent renders for the same token in
  // the same session paint with NO network round-trip; first render fires
  // /api/vtx/token-card once and pulls chart + price + change24h together.
  const cacheKey = chartCacheKey(token);
  const cached = VTX_CHART_CACHE.get(cacheKey);
  const cachedFresh = cached && Date.now() - cached.cachedAt < VTX_CHART_TTL_MS ? cached : null;
  const [chart, setChart] = useState<{ points: number[]; changePct: number } | null>(
    cachedFresh ? { points: cachedFresh.points, changePct: cachedFresh.changePct } : null,
  );
  const [livePrice, setLivePrice] = useState<number | null>(cachedFresh?.price ?? null);
  const [liveChange24h, setLiveChange24h] = useState<number | null>(cachedFresh?.change24h ?? null);
  const [stats, setStats] = useState<{ volume24h?: number; liquidity?: number; marketCap?: number; fdv?: number; supply?: number | null; name?: string } | null>(
    cachedFresh
      ? { volume24h: cachedFresh.volume24h, liquidity: cachedFresh.liquidity, marketCap: cachedFresh.marketCap, fdv: cachedFresh.fdv, supply: cachedFresh.supply, name: cachedFresh.name }
      : null,
  );

  useEffect(() => {
    if (cachedFresh) return;
    let cancelled = false;
    const q = token.address
      ? `/api/vtx/token-card?address=${encodeURIComponent(token.address)}&chain=${token.chain || ''}&tf=24h`
      : `/api/vtx/token-card?symbol=${encodeURIComponent(token.symbol)}&tf=24h`;
    fetch(q)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const nextChart = d.points ? { points: d.points as number[], changePct: (d.changePct as number) || 0 } : null;
        const nextPrice = typeof d.price === 'number' ? d.price : null;
        const nextChange = typeof d.change24h === 'number' ? d.change24h : null;
        if (nextChart) setChart(nextChart);
        if (nextPrice !== null) setLivePrice(nextPrice);
        if (nextChange !== null) setLiveChange24h(nextChange);
        setStats({
          volume24h: typeof d.volume24h === 'number' ? d.volume24h : undefined,
          liquidity: typeof d.liquidity === 'number' ? d.liquidity : undefined,
          marketCap: typeof d.marketCap === 'number' ? d.marketCap : undefined,
          fdv: typeof d.fdv === 'number' ? d.fdv : undefined,
          supply: typeof d.supply === 'number' ? d.supply : null,
          name: typeof d.name === 'string' ? d.name : undefined,
        });
        // Only cache when we have at least the chart points — partial
        // responses (price-only, error path) shouldn't replace a future
        // good fetch.
        if (nextChart) {
          VTX_CHART_CACHE.set(cacheKey, {
            points: nextChart.points,
            changePct: nextChart.changePct,
            price: nextPrice,
            change24h: nextChange,
            volume24h: typeof d.volume24h === 'number' ? d.volume24h : undefined,
            liquidity: typeof d.liquidity === 'number' ? d.liquidity : undefined,
            marketCap: typeof d.marketCap === 'number' ? d.marketCap : undefined,
            fdv: typeof d.fdv === 'number' ? d.fdv : undefined,
            supply: typeof d.supply === 'number' ? d.supply : null,
            name: typeof d.name === 'string' ? d.name : undefined,
            cachedAt: Date.now(),
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token.address, token.chain, token.symbol, cacheKey, cachedFresh]);

  // Live numeric price/change from the API fetch; fall back to the LLM's
  // streamed values during the brief pre-fetch window.
  const numericPrice = livePrice !== null
    ? livePrice
    : parseFloat(String(token.price).replace(/[$,]/g, '')) || 0;
  const numericChange = liveChange24h !== null ? liveChange24h : token.change24h;

  return (
    <PriceCard
      symbol={token.symbol}
      name={stats?.name || token.name}
      chain={token.chain}
      address={token.address}
      logo={token.logo}
      price={numericPrice}
      change24h={numericChange}
      points={chart?.points}
      volume24h={stats?.volume24h ?? null}
      marketCap={stats?.marketCap ?? null}
      liquidity={stats?.liquidity ?? null}
      fdv={stats?.fdv ?? null}
      supply={stats?.supply ?? null}
    />
  );
}

// (CardSparkline removed — PriceCard renders its own area chart with hour ticks.)

const DEFAULT_PAGE_SETTINGS: AgentSettings = {
  webSearch: false,
  responseStyle: 'detailed',
  autoContext: true,
  personality: 'neutral',
  defaultChain: 'solana',
  language: 'English',
  depth: 'Standard',
  riskAppetite: 'Balanced',
  autoCharts: true,
  focusMode: false,
  messageSound: false,
};

function loadSettings(): AgentSettings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      // §focusMode-scrub — a prior build applied style={{ minHeight: '80vh' }}
      // when focusMode was on, which broke the chat layout. The code is gone
      // but users who toggled it once still have focusMode:true persisted and
      // showed a "half-screen" chat until they cleared storage. Force-off on
      // load so the bad state self-heals on next visit.
      const merged = { ...DEFAULT_PAGE_SETTINGS, ...parsed, focusMode: false };
      return merged;
    }
  } catch { /* Malformed JSON — return default */ }
  return { ...DEFAULT_PAGE_SETTINGS };
}

function playPageChime() {
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

function saveSettings(s: AgentSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* localStorage unavailable — silently ignore */ }
}

const QUICK_ACTIONS = [
  { label: 'Trending Tokens', query: 'Show me the top trending tokens right now with prices, volume, and 24h changes.' },
  { label: 'Token Deep Dive', query: 'Give me a deep analysis of SOL including price action, volume trends, holders, and market sentiment.' },
  { label: 'Network Status', query: 'What is the current network status across Ethereum, Solana, and other major chains? Include gas prices and activity.' },
  { label: 'Market Overview', query: 'Give me a comprehensive market overview with BTC, ETH, SOL prices, fear & greed, and top movers.' },
];

const TOOLS = [
  { icon: TrendingUp, label: 'Market Analysis', desc: 'Real-time prices, trends, fear & greed', query: 'Give me a comprehensive market overview for today including BTC, ETH, SOL trends, DeFi activity, and any notable on-chain signals.' },
  { icon: Shield, label: 'Security Scan', desc: 'Contract audit & honeypot detection', query: 'What are the biggest security risks in the crypto market right now? Flag any red flags, scams, or potential rug pulls.' },
  { icon: Search, label: 'Token Research', desc: 'Deep dive into any token or project', query: 'What are the most promising tokens to research right now based on on-chain activity and smart money flows?' },
  { icon: Wallet, label: 'Wallet Analysis', desc: 'Analyze any wallet address', query: 'How should I analyze a wallet address to determine if it belongs to smart money or a potential scammer?' },
  { icon: Eye, label: 'Whale Tracking', desc: 'Monitor large wallet movements', query: 'What on-chain signals are showing the most bullish or bearish activity right now? Include whale movements and smart money flows.' },
  { icon: Target, label: 'Risk Assessment', desc: 'Portfolio risk & exposure analysis', query: 'What are the best strategies for managing risk in a crypto portfolio right now? Include position sizing and diversification.' },
  { icon: BarChart3, label: 'Trading Signals', desc: 'Entry/exit points & technical analysis', query: 'What trading setups look the strongest right now based on technical and on-chain analysis?' },
  { icon: Network, label: 'Network Intel', desc: 'Chain activity & gas analysis', query: 'Compare the current activity across Ethereum, Solana, Base, and other L2s. Which chains show the most growth?' },
];

function VtxAiPageInner() {
  useFeatureUsageLog('vtx_ai');
  const router = useRouter();
  const searchParams = useSearchParams();
  const naka = useNakaWallet();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tier, setTier] = useState('free');
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 25, remaining: 25 });
  const [rateLimited, setRateLimited] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatHistoryEntry[]>([]);
  const [settings, setSettings] = useState<AgentSettings>({ ...DEFAULT_PAGE_SETTINGS });
  const [settingsToast, setSettingsToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setMessages(loadHistory());
      setTier(getUserTier());
      setDailyUsage(getDailyUsage());
      setSettings(loadSettings());
      try {
        const sessions = localStorage.getItem(HISTORY_INDEX_KEY);
        if (sessions) {
          const parsed = JSON.parse(sessions);
          if (Array.isArray(parsed)) setChatSessions(parsed);
        }
      } catch { /* Malformed JSON — return default */ }
      // Background: load conversation history from Supabase.
      // Dedupe by conversation id — the API can return one row per message
      // tuple if the schema joins messages, which would stack 8 copies of
      // "tell me about squidgrow" in the rail (reported bug).
      fetch('/api/vtx/conversations')
        .then(r => r.json())
        .then(({ conversations }) => {
          if (conversations && conversations.length > 0) {
            const seen = new Set<string>();
            const entries: ChatHistoryEntry[] = [];
            for (const c of conversations as { id: string; title: string; messages: Message[]; updated_at: string }[]) {
              if (!c?.id || seen.has(c.id)) continue;
              seen.add(c.id);
              entries.push({
                id: c.id,
                date: c.updated_at,
                messages: c.messages || [],
                preview: c.title || 'VTX Conversation',
              });
            }
            setChatSessions(entries);
          }
        })
        .catch(err => console.error('[VTX] Failed to load Supabase history:', err instanceof Error ? err.message : err));

      // Seamless continuation from Mini VTX Panel: ?q= sends immediately,
      // ?conversation=<id> loads an existing session.
      const q = searchParams.get('q');
      const conversationId = searchParams.get('conversation');
      if (conversationId) {
        fetch(`/api/vtx/conversations?id=${encodeURIComponent(conversationId)}`)
          .then(r => r.json())
          .then(({ conversation }) => {
            if (conversation?.messages && Array.isArray(conversation.messages)) {
              setMessages(conversation.messages);
            }
          })
          .catch(() => { /* fall through to normal state */ });
      } else if (q) {
        // Defer send until state is mounted
        setTimeout(() => { void handleSend(q); }, 50);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initialized.current || messages.length === 0) return;
    saveHistory(messages);
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      syncHistoryToSupabase(messages);
    }
  }, [messages]);
  // §vtx-scroll-race — was scrollIntoView({ behavior: 'smooth' }) on every
  // messages change, INCLUDING the initial mount when loadHistory() hydrates
  // 50+ cached messages from localStorage / Supabase for existing accounts.
  // The smooth-scroll starts before layout completes, lands mid-chat, and
  // owners with long history saw a partial VTX page until they scrolled.
  // Fix: first paint = instant jump to bottom (no animation, layout-stable).
  // Subsequent appends = smooth-scroll as before. Track prev count via ref.
  const prevMsgCountRef = useRef<number>(0);
  useEffect(() => {
    const node = messagesEndRef.current;
    if (!node) return;
    const isFirstPaint = prevMsgCountRef.current === 0 && messages.length > 0;
    const grew = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    if (isFirstPaint) {
      // 'auto' = instant; double-RAF lets the messages container measure
      // its full height before we jump so the bottom is actually reachable.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'auto', block: 'end' });
      }));
    } else if (grew) {
      node.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const isPro = tier === 'pro';

  const updateSettings = (partial: Partial<AgentSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    saveSettings(updated);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSettingsToast(true);
    toastTimerRef.current = setTimeout(() => setSettingsToast(false), 1800);
  };

  const saveChatSession = () => {
    if (messages.length <= 1) return;
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0) return;
    const session: ChatHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      messages,
      preview: (userMsgs[0]?.content ?? 'VTX Conversation').slice(0, 40),
    };
    try {
      const updated = [session, ...chatSessions].slice(0, 30);
      setChatSessions(updated);
      localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(updated));
    } catch { /* localStorage unavailable — silently ignore */ }
  };

  const loadChatSession = (entry: ChatHistoryEntry) => {
    if (entry.messages && entry.messages.length > 0) {
      setMessages(entry.messages);
      saveHistory(entry.messages);
    }
    setShowHistory(false);
  };

  const clearChat = () => {
    saveChatSession();
    const fresh: Message[] = [{ role: 'assistant', content: 'New chat started. VTX Agent ready. What do you need?', timestamp: Date.now() }];
    setMessages(fresh);
    saveHistory(fresh);
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    if (tier !== 'pro' && rateLimited) return;

    let finalMessage = msg.trim();
    if (settings.webSearch) finalMessage += ' [WEB_SEARCH]';

    const userMessage: Message = { role: 'user', content: msg.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setShowTools(false);

    // Streaming opt-in: skip when the prompt likely needs tool-use (price,
    // chart, swap, buy/sell) so tool results + token cards still land via
    // the JSON branch. Mirrors VtxAiTab's heuristic so behaviour is parity.
    const TOOL_USE_KEYWORDS = /\b(buy|sell|swap|chart|price of|trade|send|approve)\b/i;
    const useStream = !TOOL_USE_KEYWORDS.test(finalMessage);

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          history: messages.slice(-10),
          tier,
          responseStyle: settings.responseStyle,
          defaultChain: settings.defaultChain,
          autoContext: settings.autoContext,
          personality: settings.personality,
          language: settings.language,
          depth: settings.depth,
          riskAppetite: settings.riskAppetite,
          stream: useStream,
          context: {
            walletAddress: naka.address ?? (typeof window !== 'undefined' ? (() => {
              const active = localStorage.getItem('wallet_address');
              if (active) return active;
              try {
                const stored = JSON.parse(localStorage.getItem('steinz_wallets') || '[]');
                if (Array.isArray(stored) && stored[0]?.address) return stored[0].address as string;
              } catch { /* ignore */ }
              return null;
            })() : null),
            currentPage: 'vtx-ai',
          },
        }),
      });

      // Streaming branch — progressively fills the assistant bubble as
      // SSE deltas arrive. Final `done` event carries the complete reply
      // for chart-tag parsing + suggestions.
      if (useStream && response.ok && response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedText = '';
        let finalReply = '';
        setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }]);
        let streamDone = false;
        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const event = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf('\n\n');
            const dataLine = event.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const json = JSON.parse(dataLine.slice(5).trim()) as { delta?: string; done?: boolean; reply?: string; error?: string; suggestions?: unknown; tokenCards?: unknown; swapCard?: unknown };
              if (json.error) throw new Error(json.error);
              if (typeof json.delta === 'string' && json.delta.length > 0) {
                streamedText += json.delta;
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content: streamedText };
                  return next;
                });
              }
              if (json.done) {
                streamDone = true;
                finalReply = json.reply ?? streamedText;
                const streamedSuggestions: string[] | undefined = Array.isArray(json.suggestions)
                  ? (json.suggestions as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 4)
                  : generateSuggestions(finalReply);
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: finalReply, suggestions: streamedSuggestions };
                  }
                  return next;
                });
                if (settings.messageSound) playPageChime();
              }
            } catch (parseErr) {
              // Best-effort SSE parsing — drop malformed events instead of aborting.
              if (parseErr instanceof Error && parseErr.message) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${parseErr.message}`, timestamp: Date.now() }]);
              }
            }
          }
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Daily free limit of 25 messages reached. Upgrade to NAKA Pro for unlimited VTX Agent access.', timestamp: Date.now() }]);
        if (data.usage) { const u = { used: data.usage.used, limit: data.usage.limit, remaining: data.usage.remaining }; setDailyUsage(u); saveDailyUsage(u); }
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}. Please try again.`, timestamp: Date.now() }]);
      } else {
        // FIX 5A.1 / Phase 5: server returns `tokenCard` (singular, rich) but client was only
        // reading `tokenCards` (plural). Normalise both — server's rich card wins when present.
        const serverCard = data.tokenCard
          ? [{
              symbol: data.tokenCard.symbol,
              name: data.tokenCard.name,
              address: data.tokenCard.address,
              chain: data.tokenCard.chain,
              price: typeof data.tokenCard.price === 'number'
                ? `$${data.tokenCard.price < 1 ? data.tokenCard.price.toFixed(6) : data.tokenCard.price.toFixed(2)}`
                : String(data.tokenCard.price || ''),
              change24h: Number(data.tokenCard.change24h) || 0,
              volume: fmtNum(data.tokenCard.volume24h),
              marketCap: fmtNum(data.tokenCard.marketCap),
              liquidity: fmtNum(data.tokenCard.liquidity),
              logo: data.tokenCard.logo || undefined,
              pairAddress: data.tokenCard.pairAddress,
              dexUrl: data.tokenCard.dexUrl,
            } as TokenCardData]
          : null;
        const tokenCards = serverCard || data.tokenCards || parseTokenCards(data.reply);
        const suggestions = generateSuggestions(data.reply);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now(),
          tokenCards: tokenCards.length > 0 ? tokenCards : undefined,
          swapCard: data.swapCard || undefined,
          suggestions,
        }]);
        if (settings.messageSound) playPageChime();
        if (data.dailyUsage) { setDailyUsage(data.dailyUsage); saveDailyUsage(data.dailyUsage); if (data.dailyUsage.remaining <= 0) setRateLimited(true); }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please check your connection and try again.', timestamp: Date.now() }]);
    } finally { setLoading(false); }
  };

  const copyMessage = (idx: number) => {
    const msg = messages[idx];
    if (msg) { navigator.clipboard.writeText(msg.content); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const cleanContent = (text: string) => {
    return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#{1,6}\s/gm, '').replace(/^[-]\s/gm, '').replace(/^[•]\s/gm, '').replace(/\s*---\s*/g, '\n\n').replace(/\s*--\s*/g, ' ');
  };

  // Aggregate sidecar data from current message stream.
  // tokens: every token card produced in this session (newest first, deduped by symbol).
  // toolEvents: timeline reconstructed from messages — when a token card or
  // chart appears we infer the underlying tool. Genuine streaming of tool
  // events from the API is a follow-up; this gives the desktop sidecar
  // useful content today without requiring API changes.
  const sidecarTokens: SidecarTokenCard[] = (() => {
    const seen = new Set<string>();
    const out: SidecarTokenCard[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.tokenCards) continue;
      for (const t of m.tokenCards) {
        const key = `${t.chain}:${t.symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          symbol: t.symbol,
          name: t.name,
          price: t.price,
          change: `${(t.change24h ?? 0) >= 0 ? '+' : ''}${(t.change24h ?? 0).toFixed(2)}%`,
          isPositive: t.change24h >= 0,
          marketCap: t.marketCap,
          volume: t.volume,
          liquidity: t.liquidity,
          chain: t.chain,
        });
        if (out.length >= 8) break;
      }
      if (out.length >= 8) break;
    }
    return out;
  })();

  const sidecarToolEvents: SidecarToolEvent[] = (() => {
    const out: SidecarToolEvent[] = [];
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      const ts = m.timestamp ?? Date.now();
      if (m.tokenCards && m.tokenCards.length > 0) {
        out.push({
          id: `tk-${ts}`,
          name: 'token_market_data',
          timestamp: ts,
          summary: (m.tokenCards ?? []).map(t => t?.symbol ?? 'UNKNOWN').join(', '),
        });
      }
    }
    return out;
  })();

  const sidecarPendingSwap: SidecarPendingSwap | null = null; // wired in by API once prepare_swap streams

  return (
    /* §VTX-layout — h-[100dvh] (dynamic viewport height) so iOS Safari and
       Chrome mobile chrome bars don't push 100vh past the visible area. */
    <div className="h-[100dvh] max-h-[100dvh] bg-[#060A12] text-white flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop only: persistent left rail with chat history */}
      <VtxConversationsRail
        sessions={chatSessions.map(s => ({ id: s.id, date: s.date, preview: s.preview }))}
        activeSessionId={null}
        onSelect={(s) => {
          const full = chatSessions.find(x => x.id === s.id);
          if (full) loadChatSession(full);
        }}
        onNewChat={clearChat}
        isPro={isPro}
        remainingMessages={dailyUsage.remaining}
        totalMessages={dailyUsage.limit}
      />

      {/* Center column — existing chat shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Settings Toast */}
      {settingsToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-[#0066FF]/90 text-white text-[11px] font-semibold rounded-full shadow-lg pointer-events-none">
          Settings saved
        </div>
      )}
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-xl border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />

          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#0066FF]/20 to-[#4F46E5]/20 border border-[#0066FF]/20">
            <SteinzLogo size={22} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold tracking-tight">VTX Agent</span>
              {isPro && (
                <span className="px-1.5 py-0.5 bg-[#0066FF]/15 border border-[#0066FF]/30 rounded text-[9px] text-[#0066FF] font-bold">PRO</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={clearChat} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors" title={!isPro ? `New chat · ${dailyUsage.remaining}/${dailyUsage.limit} messages left today` : "New chat"}>
              <MessageSquarePlus className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors" title="Chat history">
              <History className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={() => setShowSettingsDrawer(true)} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors" title="Settings">
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="px-4 py-3 border-t border-white/[0.04] bg-[#0A0E16] max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300">Chat History</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="px-2 py-1 bg-[#0066FF]/20 border border-[#0066FF]/30 rounded text-[9px] text-[#0066FF] font-semibold hover:bg-[#0066FF]/30 transition-colors"
                >
                  + New Chat
                </button>
                <button onClick={() => setShowHistory(false)} aria-label="Close chat history" className="p-1 hover:bg-white/[0.06] rounded ms-1"><X className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /></button>
              </div>
            </div>
            {chatSessions.length === 0 ? (
              <p className="text-[10px] text-gray-600 text-center py-3">No previous chats</p>
            ) : (
              <div className="space-y-1">
                {chatSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadChatSession(session)}
                    className="w-full text-start p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:border-[#0066FF]/20 transition-all flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Clock className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                        <span className="text-[9px] text-gray-600">{new Date(session.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[11px] font-medium text-gray-300 truncate">{session.preview}</div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showSettings && (
          <div className="px-4 py-3 border-t border-white/[0.04] bg-[#0A0E16] max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300">Agent Settings</span>
              <button onClick={() => setShowSettings(false)} aria-label="Close agent settings" className="p-1 hover:bg-white/[0.06] rounded"><X className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /></button>
            </div>

            {/* Section: Response Style */}
            <div className="mb-3">
              <p className="text-[9px] text-[#0066FF] uppercase tracking-widest font-bold mb-2">Response Style</p>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Personality</label>
                  <select
                    value={settings.personality}
                    onChange={(e) => updateSettings({ personality: e.target.value as AgentSettings['personality'] })}
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
                      { value: 'Conservative', label: 'Safe' },
                      { value: 'Balanced', label: 'Balanced' },
                      { value: 'Aggressive', label: 'Degen' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => updateSettings({ riskAppetite: value })}
                        className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${settings.riskAppetite === value ? 'bg-[#0066FF] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        {label}
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
                    onChange={(e) => updateSettings({ defaultChain: e.target.value as AgentSettings['defaultChain'] })}
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
            <div className="border-t border-white/[0.04] pt-3 mb-3">
              <p className="text-[9px] text-[#0066FF] uppercase tracking-widest font-bold mb-2">Features</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Web Search</p>
                    <p className="text-[9px] text-gray-500">Include live web results in context</p>
                  </div>
                  <button onClick={() => updateSettings({ webSearch: !settings.webSearch })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.webSearch ? 'bg-[#0066FF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.webSearch ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Auto-show Charts</p>
                    <p className="text-[9px] text-gray-500">Render inline charts when AI signals them</p>
                  </div>
                  <button onClick={() => updateSettings({ autoCharts: !settings.autoCharts })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.autoCharts ? 'bg-[#0066FF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.autoCharts ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Focus Mode</p>
                    <p className="text-[9px] text-gray-500">Expand chat view while messaging</p>
                  </div>
                  <button onClick={() => updateSettings({ focusMode: !settings.focusMode })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.focusMode ? 'bg-[#0066FF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.focusMode ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Message Sound</p>
                    <p className="text-[9px] text-gray-500">Chime when VTX replies</p>
                  </div>
                  <button onClick={() => updateSettings({ messageSound: !settings.messageSound })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.messageSound ? 'bg-[#0066FF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.messageSound ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04]">
              <button onClick={clearChat} className="flex items-center gap-2 text-xs text-red-400/70 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Clear current chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bug §1 / VTX half-render — the welcome card used to only render
          when messages.length <= 1. After a Supabase-synced session
          dropped two assistant-only seed messages into local state the
          UI showed an empty middle (no welcome + no user content to
          render). Derive `hasConversation` from whether ANY user
          message exists; the welcome carries us until the first real
          user prompt. */}
      {/* §VTX-layout — removed `style={{ minHeight: '80vh' }}` when focusMode
          was on. It forced the messages container to 80vh inside an h-[100dvh]
          parent with overflow-hidden, which pushed the sticky input box past
          the visible bottom (mobile) or compressed it to mid-screen (desktop).
          flex-1 + min-h-0 already gives the correct fillable scrollable area. */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!messages.some(m => m.role === 'user') && (
          <div className="px-4 pt-6 pb-2">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-[#0066FF]/20 to-[#4F46E5]/20 rounded-2xl flex items-center justify-center border border-[#0066FF]/10 overflow-hidden">
                <SteinzLogo size={40} animated={false} />
              </div>
              <h2 className="text-lg font-bold mb-1">What do you need analyzed?</h2>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Real-time market data, on-chain intelligence, and security analysis. Powered by NAKA LABS.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => handleSend(action.query)} className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-gray-400 hover:text-white hover:border-[#0066FF]/30 hover:bg-[#0066FF]/[0.05] transition-all whitespace-nowrap flex-shrink-0">
                  {action.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Top whale moves last 24h', icon: TrendingUp, query: 'What are the top whale moves in the last 24 hours?' },
                { label: 'Scan a token for rugpull risk', icon: Shield, query: 'Scan a token for rugpull risk. I\'ll give you the address.' },
                { label: 'Trending narratives today', icon: Sparkles, query: 'What narratives are trending in crypto today?' },
                { label: 'Analyze my portfolio', icon: BarChart3, query: 'Analyze my connected wallet portfolio and give me an overview.' },
              ].map((card) => (
                <button
                  key={card.label}
                  onClick={() => handleSend(card.query)}
                  className="text-start p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-[#0066FF]/30 hover:bg-slate-900/80 transition-all group"
                >
                  <card.icon className="w-4 h-4 text-gray-500 group-hover:text-[#0066FF] mb-1.5 transition-colors" />
                  <p className="text-xs font-semibold text-gray-200">{card.label}</p>
                </button>
              ))}
            </div>

            <button onClick={() => setShowTools(!showTools)} className="w-full mt-3 py-2 text-[10px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors">
              <Wrench className="w-3 h-3" />
              {showTools ? 'Hide tools' : 'Show all tools'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showTools ? 'rotate-180' : ''}`} />
            </button>

            {showTools && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {TOOLS.slice(4).map((tool) => (
                  <button key={tool.label} onClick={() => handleSend(tool.query)} className="text-start p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-[#0066FF]/30 hover:bg-[#0066FF]/[0.03] transition-all group">
                    <tool.icon className="w-4 h-4 text-gray-500 group-hover:text-[#0066FF] mb-1.5 transition-colors" />
                    <p className="text-xs font-semibold text-gray-300 mb-0.5">{tool.label}</p>
                    <p className="text-[10px] text-gray-600 leading-tight">{tool.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 me-2 shadow-sm shadow-[#0066FF]/10 overflow-hidden bg-gradient-to-br from-[#0066FF]/20 to-[#4F46E5]/20 border border-[#0066FF]/15">
                  <SteinzLogo size={18} animated={false} />
                </div>
              )}
              <div className={`max-w-[82%] min-w-0 rounded-2xl px-4 py-3 text-xs leading-relaxed relative overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-[#0066FF]/10 border border-[#0066FF]/15 text-white'
                  : 'bg-white/[0.02] border border-white/[0.06] text-gray-300'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3 h-3 text-[#0066FF]" />
                    <span className="text-[10px] font-semibold text-[#0066FF]">VTX Agent</span>
                    {msg.timestamp && <span className="text-[9px] text-gray-700 ms-auto">{formatTime(msg.timestamp)}</span>}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{cleanContent(msg.content)}</div>
                {msg.tokenCards && msg.tokenCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.tokenCards.map((token, ti) => (
                      <TokenCard key={ti} token={token} />
                    ))}
                  </div>
                )}
                {msg.swapCard && (
                  <div className="mt-3">
                    {/* Deep-dive fix — render the needsWallet warning FIRST
                        (above the card) when set, so users see the gate
                        before tapping the disabled-feeling sign button. */}
                    {msg.swapCard.needsWallet && (
                      <div className="mb-2 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-1.5">
                        Connect a wallet to execute this swap. Insufficient balance? Deposit first from the Wallet page.
                      </div>
                    )}
                    <SwapCard
                      swap={msg.swapCard}
                      walletAddress={msg.swapCard.walletAddress}
                      onCancel={() => {
                        // Strip the swap card from this message, keep the
                        // assistant reply visible so the user retains context.
                        setMessages((prev) => prev.map((m, j) =>
                          j === i ? { ...m, swapCard: undefined } : m,
                        ));
                      }}
                    />
                  </div>
                )}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && i === messages.length - 1 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((s, si) => (
                        <button key={si} onClick={() => handleSend(s)} className="px-2.5 py-1.5 bg-[#0066FF]/[0.06] border border-[#0066FF]/15 rounded-lg text-[10px] text-[#0066FF] hover:bg-[#0066FF]/10 transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && msg.timestamp && (
                  <div className="text-[9px] text-gray-600 mt-1 text-end">{formatTime(msg.timestamp)}</div>
                )}
                {msg.role === 'assistant' && i > 0 && (
                  <button
                    onClick={() => copyMessage(i)}
                    title="Copy reply"
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/[0.06] rounded-lg"
                  >
                    {copiedIdx === i ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-gray-600" />}
                  </button>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ms-2 border border-white/[0.06]">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 me-2 overflow-hidden bg-gradient-to-br from-[#0066FF]/20 to-[#4F46E5]/20 border border-[#0066FF]/15">
                <SteinzLogo size={18} animated={false} />
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
                <SteinzLogoSpinner size={32} message={settings.webSearch ? 'Querying Sargon Data Archive...' : 'Analyzing via Naka Intelligence...'} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-[#060A12]/95 backdrop-blur-xl border-t border-white/[0.04] p-3 space-y-2">
        {rateLimited && !isPro && (
          <div className="flex items-center gap-3 p-3 bg-[#0066FF]/[0.05] border border-[#0066FF]/15 rounded-xl">
            <Lock className="w-4 h-4 text-[#0066FF] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] text-white font-semibold">Daily limit reached</p>
              <p className="text-[10px] text-gray-500">Upgrade to Pro for unlimited messages</p>
            </div>
            <button onClick={() => router.push('/dashboard/pricing')} className="px-3 py-1.5 bg-[#0066FF] rounded-lg text-[10px] font-bold hover:bg-[#0918D0] transition-colors">
              Upgrade
            </button>
          </div>
        )}

        <div className="flex gap-2 items-start">
          <button onClick={() => setShowTools(!showTools)} className={`p-3 rounded-xl transition-all flex-shrink-0 border ${showTools ? 'bg-[#0066FF]/10 border-[#0066FF]/20 text-[#0066FF]' : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
            <Wrench className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-start bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl px-3 py-2 focus-within:border-[#0066FF]/40 focus-within:shadow-[0_0_0_3px_rgba(0,102,255,0.08)] transition-all">
            {settings.webSearch && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0066FF]/10 rounded text-[9px] text-[#0066FF] font-semibold me-2 mt-1.5 flex-shrink-0">
                <Globe className="w-2.5 h-2.5" /> WEB
              </div>
            )}
            <textarea
              ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 240) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading && input.trim() && !(rateLimited && !isPro)) {
                    void handleSend();
                    requestAnimationFrame(() => {
                      const el = e.currentTarget as HTMLTextAreaElement | null;
                      if (el) el.style.height = 'auto';
                    });
                  }
                }
              }}
              rows={1}
              placeholder="Ask VTX about any token, wallet, or whale..."
              className="flex-1 bg-transparent text-xs placeholder-gray-600 focus:outline-none resize-none leading-relaxed max-h-60 overflow-y-auto"
              disabled={loading || (rateLimited && !isPro)}
            />
            {/* FIX 5A.1: was no send button (only helper text); now a real tappable Send button,
                essential on mobile where Enter keys are inconsistent. */}
            <button
              type="button"
              onClick={() => {
                if (!loading && input.trim() && !(rateLimited && !isPro)) void handleSend();
              }}
              disabled={loading || !input.trim() || (rateLimited && !isPro)}
              aria-label="Send message"
              className="ms-2 mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#7C3AED] text-white flex items-center justify-center hover:shadow-[0_0_0_3px_rgba(0,102,255,0.25)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </div>
      {/* Desktop only: persistent right sidecar with token cards + tool timeline */}
      <VtxToolSidecar
        tokens={sidecarTokens}
        toolEvents={sidecarToolEvents}
        pendingSwap={sidecarPendingSwap}
      />

      {/* Cloud-backed settings drawer */}
      <VtxSettingsDrawer
        open={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        onClearChats={() => {
          setMessages([]);
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(HISTORY_INDEX_KEY);
          } catch { /* private mode */ }
          setShowSettingsDrawer(false);
        }}
      />
    </div>
  );
}

export default function VtxAiPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-[#060A12] text-slate-500 text-sm gap-3">
          <div className="w-5 h-5 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
          <span>Loading VTX Agent…</span>
        </div>
      }
    >
      <VtxAiPageInner />
    </Suspense>
  );
}
