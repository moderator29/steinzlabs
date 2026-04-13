'use client';

import { Bot, ArrowLeft, Send, Sparkles, TrendingUp, Shield, BarChart3, User, Copy, Check, Trash2, Globe, Lock, Settings, Wrench, Search, Target, Eye, ChevronDown, X, Wallet, Network, MessageSquarePlus, History, ChevronRight, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';

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
  } catch {}
  return [
    { role: 'assistant', content: 'VTX Agent online. I pull live market data, on-chain intelligence, and security analysis before every response. What do you need?', timestamp: Date.now() },
  ];
}

function saveHistory(messages: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
}

function getUserTier(): string {
  try { return localStorage.getItem(TIER_KEY) || 'free'; } catch { return 'free'; }
}

function getDailyUsage(): { used: number; limit: number; remaining: number } {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    if (stored) { const p = JSON.parse(stored); if (p && typeof p.used === 'number') return p; }
  } catch {}
  return { used: 0, limit: 25, remaining: 25 };
}

function saveDailyUsage(u: { used: number; limit: number; remaining: number }) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {}
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

function TokenCard({ token }: { token: TokenCardData }) {
  const isPositive = token.change24h >= 0;
  const logoUrl = token.logo || `https://ui-avatars.com/api/?name=${token.symbol}&background=0A1EFF&color=fff&size=64&bold=true&format=svg`;

  return (
    <div className="p-3 bg-[#0D1117] border border-white/[0.08] rounded-xl hover:border-[#0A1EFF]/30 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <img src={logoUrl} alt={token.symbol} className="w-8 h-8 rounded-full bg-[#1a1f2e]" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=0A1EFF&color=fff&size=64&bold=true`; }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{token.symbol}</span>
            {token.name !== token.symbol && <span className="text-[10px] text-gray-500 truncate">{token.name}</span>}
            {token.rank && <span className="text-[9px] text-gray-600">#{token.rank}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-white font-mono">{token.price}</div>
          <div className={`text-[10px] font-semibold ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
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
    </div>
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
  } catch {}
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
  } catch {}
}

function saveSettings(s: AgentSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
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

export default function VtxAiPage() {
  const router = useRouter();
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
          // support both old format (title/preview only) and new format (with messages)
          if (Array.isArray(parsed)) setChatSessions(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => { if (initialized.current && messages.length > 0) saveHistory(messages); }, [messages]);
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
    } catch {}
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
        const tokenCards = data.tokenCards || parseTokenCards(data.reply);
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

  return (
    <div className="h-screen max-h-screen bg-[#060A12] text-white flex flex-col overflow-hidden">
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
            <Bot className="w-5 h-5 text-[#0A1EFF]" />
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
            {!isPro && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <span className="text-[10px] text-gray-500 font-mono">{dailyUsage.remaining}</span>
                <div className="w-8 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${dailyUsage.remaining <= 3 ? 'bg-red-500' : dailyUsage.remaining <= 7 ? 'bg-amber-500' : 'bg-[#0A1EFF]'}`} style={{ width: `${((dailyUsage.limit - dailyUsage.used) / dailyUsage.limit) * 100}%` }} />
                </div>
              </div>
            )}
            <button onClick={clearChat} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors" title="New chat">
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
                <img src="/steinz-logo-128.png" alt="VTX Agent" className="w-10 h-10" style={{ objectFit: 'contain' }} />
              </div>
              <h2 className="text-lg font-bold mb-1">Ask me about crypto</h2>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Real-time market data, on-chain intelligence, and security analysis. Powered by STEINZ LABS.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => handleSend(action.query)} className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/[0.05] transition-all whitespace-nowrap flex-shrink-0">
                  {action.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TOOLS.slice(0, 4).map((tool) => (
                <button key={tool.label} onClick={() => handleSend(tool.query)} className="text-left p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/[0.03] transition-all group">
                  <tool.icon className="w-4 h-4 text-gray-500 group-hover:text-[#0A1EFF] mb-1.5 transition-colors" />
                  <p className="text-xs font-semibold text-gray-300 mb-0.5">{tool.label}</p>
                  <p className="text-[10px] text-gray-600 leading-tight">{tool.desc}</p>
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
                  <img src="/steinz-logo-128.png" alt="" className="w-4.5 h-4.5" style={{ width: 18, height: 18, objectFit: 'contain' }} />
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
                  <button onClick={() => copyMessage(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/[0.06] rounded-lg">
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
                <img src="/steinz-logo-128.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
                <SteinzLogoSpinner size={32} message={settings.webSearch ? 'Querying Sargon Data Archive...' : 'Analyzing via Steinz Intelligence...'} />
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

        <div className="flex gap-2">
          <button onClick={() => setShowTools(!showTools)} className={`p-3 rounded-xl transition-all flex-shrink-0 border ${showTools ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/20 text-[#0A1EFF]' : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
            <Wrench className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 focus-within:border-[#0A1EFF]/30 transition-colors">
            {settings.webSearch && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0A1EFF]/10 rounded text-[9px] text-[#0A1EFF] font-semibold mr-2 flex-shrink-0">
                <Globe className="w-2.5 h-2.5" /> WEB
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask VTX anything..."
              className="flex-1 bg-transparent py-3 text-xs placeholder-gray-600 focus:outline-none"
              disabled={loading || (rateLimited && !isPro)}
            />
          </div>
          <button onClick={() => handleSend()} disabled={loading || !input.trim() || (rateLimited && !isPro)} className="bg-[#0A1EFF] hover:bg-[#0918D0] p-3 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-[#0A1EFF] flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
