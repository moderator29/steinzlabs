'use client';

import { ArrowLeft, Send, Sparkles, TrendingUp, Shield, BarChart3, User, Copy, Check, Trash2, Globe, Lock, Settings, Wrench, Search, Target, Eye, ChevronDown, X, Wallet, Network, MessageSquarePlus, History, ChevronRight, Clock } from 'lucide-react';
import SteinzLogo from '@/components/SteinzLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect, Suspense } from 'react';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { supabase } from '@/lib/supabase';
import { VtxConversationsRail } from '@/components/vtx/VtxConversationsRail';
import { VtxToolSidecar, type SidecarTokenCard, type SidecarToolEvent, type SidecarPendingSwap } from '@/components/vtx/VtxToolSidecar';

// FIX 5A.1 / Phase 5: TokenCardData now accepts both legacy string fields (parsed from reply text)
// and the richer server shape (numbers + contractAddress + chain), so the Nansen-style card
// can route Buy/Swap to the real on-chain address.
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

// FIX 5A.1 / Phase 5: Nansen-style card — adds an embedded price chart, timeframe pills,
// and Buy / Swap / Analyze action row. Falls back gracefully for legacy string-only cards
// (those parsed from text without a contract address can't fetch chart data).
function TokenCard({ token }: { token: TokenCardData }) {
  const router = useRouter();
  const isPositive = token.change24h >= 0;
  const logoUrl = token.logo || `https://ui-avatars.com/api/?name=${token.symbol}&background=0A1EFF&color=fff&size=64&bold=true&format=svg`;
  const [tf, setTf] = useState<'1h' | '24h' | '7d'>('24h');
  const [chart, setChart] = useState<{ points: number[]; changePct: number } | null>(null);

  useEffect(() => {
    if (!token.address) return;
    let cancelled = false;
    fetch(`/api/vtx/token-card?address=${encodeURIComponent(token.address)}&chain=${token.chain || ''}&tf=${tf}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.points) setChart({ points: d.points, changePct: d.changePct || 0 }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token.address, token.chain, tf]);

  const handleBuy = () => {
    if (!token.address) { router.push(`/dashboard/swap?symbol=${token.symbol}`); return; }
    router.push(`/dashboard/swap?token=${token.address}&chain=${token.chain || ''}&buy=1`);
  };
  const handleSwap = () => {
    if (!token.address) { router.push(`/dashboard/swap?symbol=${token.symbol}`); return; }
    router.push(`/dashboard/swap?token=${token.address}&chain=${token.chain || ''}`);
  };

  return (
    <div className="p-3 bg-[#0D1117] border border-white/[0.08] rounded-xl hover:border-[#0A1EFF]/30 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <img src={logoUrl} alt={token.symbol} className="w-8 h-8 rounded-full bg-[#1a1f2e]" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=0A1EFF&color=fff&size=64&bold=true`; }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{token.symbol}</span>
            {token.name !== token.symbol && <span className="text-[10px] text-gray-500 truncate">{token.name}</span>}
            {token.chain && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400 uppercase">{token.chain}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-white font-mono">{token.price}</div>
          <div className={`text-[10px] font-semibold ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Embedded chart — only when server supplied a real contract address. */}
      {token.address && (
        <div className="mb-3">
          <div className="h-16 w-full rounded-lg bg-white/[0.02] flex items-center justify-center overflow-hidden">
            {chart && chart.points.length > 1 ? (
              <CardSparkline points={chart.points} positive={chart.changePct >= 0} />
            ) : (
              <span className="text-[10px] text-gray-600">Loading chart…</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            {(['1h', '24h', '7d'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`text-[9px] px-2 py-0.5 rounded ${tf === t ? 'bg-[#0A1EFF] text-white' : 'bg-white/[0.04] text-gray-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
          <div className="text-[8px] text-gray-600 uppercase">MCap</div>
          <div className="text-[10px] font-semibold text-white">{token.marketCap}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
          <div className="text-[8px] text-gray-600 uppercase">Volume</div>
          <div className="text-[10px] font-semibold text-white">{token.volume}</div>
        </div>
        {token.liquidity ? (
          <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">Liquidity</div>
            <div className="text-[10px] font-semibold text-white">{token.liquidity}</div>
          </div>
        ) : token.fdv ? (
          <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">FDV</div>
            <div className="text-[10px] font-semibold text-white">{token.fdv}</div>
          </div>
        ) : (
          <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">Chain</div>
            <div className="text-[10px] font-semibold text-white capitalize">{token.chain}</div>
          </div>
        )}
      </div>

      {/* Action row — Buy / Swap. One-tap routing into the swap page with pre-filled token + chain. */}
      <div className="flex gap-1.5">
        <button
          onClick={handleBuy}
          className="flex-1 py-1.5 bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 text-white text-[10px] font-bold rounded-lg transition-opacity"
        >
          Buy {token.symbol}
        </button>
        <button
          onClick={handleSwap}
          className="flex-1 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-[10px] font-bold rounded-lg transition-colors"
        >
          Swap
        </button>
        {token.dexUrl && (
          <a
            href={token.dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 text-[10px] font-bold rounded-lg transition-colors"
          >
            DEX
          </a>
        )}
      </div>
    </div>
  );
}

// Minimal inline-SVG sparkline — dependency-free.
function CardSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 280;
  const h = 60;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = positive ? '#10B981' : '#EF4444';
  const fill = positive ? '#10B98115' : '#EF444415';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      return { ...DEFAULT_PAGE_SETTINGS, ...parsed };
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tier, setTier] = useState('free');
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 25, remaining: 25 });
  const [rateLimited, setRateLimited] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
      // Background: load conversation history from Supabase
      fetch('/api/vtx/conversations')
        .then(r => r.json())
        .then(({ conversations }) => {
          if (conversations && conversations.length > 0) {
            const entries: ChatHistoryEntry[] = conversations.map((c: { id: string; title: string; messages: Message[]; updated_at: string }) => ({
              id: c.id,
              date: c.updated_at,
              messages: c.messages || [],
              preview: c.title || 'VTX Conversation',
            }));
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
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      preview: userMsgs[0].content.slice(0, 40),
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

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          history: messages.slice(-10),
          tier,
          responseStyle: settings.responseStyle,
          autoContext: settings.autoContext,
          personality: settings.personality,
          language: settings.language,
          depth: settings.depth,
          riskAppetite: settings.riskAppetite,
          context: {
            walletAddress: typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null,
            currentPage: 'vtx-ai',
          },
        }),
      });
      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Daily free limit of 25 messages reached. Upgrade to STEINZ Pro for unlimited VTX Agent access.', timestamp: Date.now() }]);
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
          change: `${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%`,
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
          summary: m.tokenCards.map(t => t.symbol).join(', '),
        });
      }
    }
    return out;
  })();

  const sidecarPendingSwap: SidecarPendingSwap | null = null; // wired in by API once prepare_swap streams

  return (
    <div className="h-screen max-h-screen bg-[#060A12] text-white flex flex-col lg:flex-row overflow-hidden">
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-[#0A1EFF]/90 text-white text-[11px] font-semibold rounded-full shadow-lg pointer-events-none">
          Settings saved
        </div>
      )}
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-xl border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 border border-[#0A1EFF]/20">
            <SteinzLogo size={22} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold tracking-tight">VTX Agent</span>
              {isPro && (
                <span className="px-1.5 py-0.5 bg-[#0A1EFF]/15 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-bold">PRO</span>
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
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
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
                  className="px-2 py-1 bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-semibold hover:bg-[#0A1EFF]/30 transition-colors"
                >
                  + New Chat
                </button>
                <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/[0.06] rounded ml-1"><X className="w-3.5 h-3.5 text-gray-500" /></button>
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
                    className="w-full text-left p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:border-[#0A1EFF]/20 transition-all flex items-center gap-2"
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
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/[0.06] rounded"><X className="w-3.5 h-3.5 text-gray-500" /></button>
            </div>

            {/* Section: Response Style */}
            <div className="mb-3">
              <p className="text-[9px] text-[#0A1EFF] uppercase tracking-widest font-bold mb-2">Response Style</p>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Personality</label>
                  <select
                    value={settings.personality}
                    onChange={(e) => updateSettings({ personality: e.target.value as AgentSettings['personality'] })}
                    className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/40"
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
                        className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${settings.depth === d ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
                    className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/40"
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
                        className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${settings.riskAppetite === value ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
                    className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/40"
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
              <p className="text-[9px] text-[#0A1EFF] uppercase tracking-widest font-bold mb-2">Features</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Web Search</p>
                    <p className="text-[9px] text-gray-500">Include live web results in context</p>
                  </div>
                  <button onClick={() => updateSettings({ webSearch: !settings.webSearch })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.webSearch ? 'bg-[#0A1EFF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.webSearch ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Auto-show Charts</p>
                    <p className="text-[9px] text-gray-500">Render inline charts when AI signals them</p>
                  </div>
                  <button onClick={() => updateSettings({ autoCharts: !settings.autoCharts })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.autoCharts ? 'bg-[#0A1EFF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.autoCharts ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Focus Mode</p>
                    <p className="text-[9px] text-gray-500">Expand chat view while messaging</p>
                  </div>
                  <button onClick={() => updateSettings({ focusMode: !settings.focusMode })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.focusMode ? 'bg-[#0A1EFF]' : 'bg-white/10'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${settings.focusMode ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Message Sound</p>
                    <p className="text-[9px] text-gray-500">Chime when VTX replies</p>
                  </div>
                  <button onClick={() => updateSettings({ messageSound: !settings.messageSound })} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings.messageSound ? 'bg-[#0A1EFF]' : 'bg-white/10'}`}>
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

      <div className="flex-1 overflow-y-auto min-h-0" style={settings.focusMode ? { minHeight: '80vh' } : undefined}>
        {messages.length <= 1 && (
          <div className="px-4 pt-6 pb-2">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 rounded-2xl flex items-center justify-center border border-[#0A1EFF]/10 overflow-hidden">
                <SteinzLogo size={40} animated={false} />
              </div>
              <h2 className="text-lg font-bold mb-1">What do you need analyzed?</h2>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Real-time market data, on-chain intelligence, and security analysis. Powered by NAKA LABS.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => handleSend(action.query)} className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/[0.05] transition-all whitespace-nowrap flex-shrink-0">
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
                  className="text-left p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-[#0A1EFF]/30 hover:bg-slate-900/80 transition-all group"
                >
                  <card.icon className="w-4 h-4 text-gray-500 group-hover:text-[#0A1EFF] mb-1.5 transition-colors" />
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
                  <button key={tool.label} onClick={() => handleSend(tool.query)} className="text-left p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/[0.03] transition-all group">
                    <tool.icon className="w-4 h-4 text-gray-500 group-hover:text-[#0A1EFF] mb-1.5 transition-colors" />
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
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2 shadow-sm shadow-[#0A1EFF]/10 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 border border-[#0A1EFF]/15">
                  <SteinzLogo size={18} animated={false} />
                </div>
              )}
              <div className={`max-w-[82%] min-w-0 rounded-2xl px-4 py-3 text-xs leading-relaxed relative overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-[#0A1EFF]/10 border border-[#0A1EFF]/15 text-white'
                  : 'bg-white/[0.02] border border-white/[0.06] text-gray-300'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3 h-3 text-[#0A1EFF]" />
                    <span className="text-[10px] font-semibold text-[#0A1EFF]">VTX Agent</span>
                    {msg.timestamp && <span className="text-[9px] text-gray-700 ml-auto">{formatTime(msg.timestamp)}</span>}
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
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && i === messages.length - 1 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((s, si) => (
                        <button key={si} onClick={() => handleSend(s)} className="px-2.5 py-1.5 bg-[#0A1EFF]/[0.06] border border-[#0A1EFF]/15 rounded-lg text-[10px] text-[#0A1EFF] hover:bg-[#0A1EFF]/10 transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && msg.timestamp && (
                  <div className="text-[9px] text-gray-600 mt-1 text-right">{formatTime(msg.timestamp)}</div>
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
                <div className="w-7 h-7 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ml-2 border border-white/[0.06]">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2 overflow-hidden bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 border border-[#0A1EFF]/15">
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
          <div className="flex items-center gap-3 p-3 bg-[#0A1EFF]/[0.05] border border-[#0A1EFF]/15 rounded-xl">
            <Lock className="w-4 h-4 text-[#0A1EFF] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] text-white font-semibold">Daily limit reached</p>
              <p className="text-[10px] text-gray-500">Upgrade to Pro for unlimited messages</p>
            </div>
            <button onClick={() => router.push('/dashboard/pricing')} className="px-3 py-1.5 bg-[#0A1EFF] rounded-lg text-[10px] font-bold hover:bg-[#0918D0] transition-colors">
              Upgrade
            </button>
          </div>
        )}

        <div className="flex gap-2 items-start">
          <button onClick={() => setShowTools(!showTools)} className={`p-3 rounded-xl transition-all flex-shrink-0 border ${showTools ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/20 text-[#0A1EFF]' : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
            <Wrench className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-start bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl px-3 py-2 focus-within:border-[#0A1EFF]/40 focus-within:shadow-[0_0_0_3px_rgba(10,30,255,0.08)] transition-all">
            {settings.webSearch && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0A1EFF]/10 rounded text-[9px] text-[#0A1EFF] font-semibold mr-2 mt-1.5 flex-shrink-0">
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
              className="ml-2 mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] text-white flex items-center justify-center hover:shadow-[0_0_0_3px_rgba(10,30,255,0.25)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
    </div>
  );
}

export default function VtxAiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0E1A]" />}>
      <VtxAiPageInner />
    </Suspense>
  );
}
