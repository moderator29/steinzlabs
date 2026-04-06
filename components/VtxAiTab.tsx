'use client';

import { useState, useRef, useEffect } from 'react';
import { BarChart3, Briefcase, AlertTriangle, Radio, Send, Bot, User, Loader2, Globe, Crown, Lock, Plus, Settings, History, X, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
}

const STORAGE_KEY = 'vtx-ai-chat-history';
const HISTORY_KEY = 'vtx_chat_history';
const SETTINGS_KEY = 'vtx_settings';
const TIER_KEY = 'steinz_user_tier';
const USAGE_KEY = 'vtx-ai-daily-usage';

function loadChatHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveChatHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch {}
}

function loadAllHistory(): ChatHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveAllHistory(entries: ChatHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30)));
  } catch {}
}

function loadSettings(): VtxSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.personality) return parsed;
    }
  } catch {}
  return { personality: 'neutral', defaultChain: 'solana' };
}

function saveSettings(s: VtxSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
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
  } catch {}
  return { used: 0, limit: 15, remaining: 15 };
}

function saveDailyUsage(usage: { used: number; limit: number; remaining: number }) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {}
}

// Resolve a token symbol to a TradingView-compatible symbol
function toTvSymbol(token?: string): string {
  if (!token) return 'BTCUSDT';
  const map: Record<string, string> = {
    btc: 'BTCUSDT', bitcoin: 'BTCUSDT',
    eth: 'ETHUSDT', ethereum: 'ETHUSDT',
    sol: 'SOLUSDT', solana: 'SOLUSDT',
    bnb: 'BNBUSDT',
    base: 'ETHUSDT',
    avax: 'AVAXUSDT', avalanche: 'AVAXUSDT',
    matic: 'MATICUSDT', polygon: 'MATICUSDT',
    arb: 'ARBUSDT', arbitrum: 'ARBUSDT',
    op: 'OPUSDT', optimism: 'OPUSDT',
    link: 'LINKUSDT', chainlink: 'LINKUSDT',
    uni: 'UNIUSDT', uniswap: 'UNIUSDT',
    doge: 'DOGEUSDT', dogecoin: 'DOGEUSDT',
    pepe: 'PEPEUSDT',
    shib: 'SHIBUSDT',
    ada: 'ADAUSDT', cardano: 'ADAUSDT',
    dot: 'DOTUSDT', polkadot: 'DOTUSDT',
    xrp: 'XRPUSDT', ripple: 'XRPUSDT',
    ltc: 'LTCUSDT', litecoin: 'LTCUSDT',
    atom: 'ATOMUSDT', cosmos: 'ATOMUSDT',
  };
  return map[token.toLowerCase()] || token.toUpperCase() + 'USDT';
}

function InlineChart({ type, token, address, data }: ChartInfo) {
  // Price chart — DexScreener embed if address, else TradingView mini widget
  if (type === 'price') {
    if (address) {
      // Detect chain prefix from address length/format
      const isSolana = !address.startsWith('0x') && address.length >= 32;
      const chain = isSolana ? 'solana' : 'ethereum';
      return (
        <div className="w-full h-48 rounded-lg overflow-hidden mt-2 border border-white/10">
          <iframe
            src={`https://dexscreener.com/${chain}/${address}?embed=1&theme=dark&trades=0&info=0&chart=1`}
            className="w-full h-full border-0"
            loading="lazy"
            title="Price chart"
          />
        </div>
      );
    }
    const tvSymbol = toTvSymbol(token);
    return (
      <div className="w-full h-48 rounded-lg overflow-hidden mt-2 border border-white/10">
        <iframe
          src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?symbol=${tvSymbol}&theme=dark&locale=en&dateRange=1D&colorTheme=dark`}
          className="w-full h-full border-0"
          loading="lazy"
          title="Price chart"
        />
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
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            Fetching holder data from Sargon Archive...
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
              <span className="text-[10px] text-white w-10 text-right flex-shrink-0">
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
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            Fetching holder data from Sargon Archive...
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
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [tier, setTier] = useState('free');
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 15, remaining: 15 });
  const [rateLimited, setRateLimited] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState<VtxSettings>({ personality: 'neutral', defaultChain: 'solana' });
  const [allHistory, setAllHistory] = useState<ChatHistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const saved = loadChatHistory();
      if (saved.length > 0) setMessages(saved);
      setTier(getUserTier());
      setDailyUsage(getDailyUsage());
      setSettings(loadSettings());
      setAllHistory(loadAllHistory());
    }
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
  };

  const isPro = tier === 'pro';

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
    if (webSearchEnabled) {
      finalMessage = finalMessage + ' [WEB_SEARCH]';
    }

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          history: messages.slice(-10),
          tier,
          personality: settings.personality,
        }),
      });

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Daily free limit of 15 messages reached. Upgrade to STEINZ Pro for unlimited VTX Agent access and web search.' }]);
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

        // 1. Check if the API explicitly returned a chart field
        if (data.chart) {
          chartInfo = {
            type: data.chart as ChartInfo['type'],
            token: data.chartToken,
            address: data.chartAddress,
            data: data.chartData,
          };
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
        if (chartInfo) assistantMsg.chart = chartInfo;

        setMessages(prev => [...prev, assistantMsg]);
        if (data.dailyUsage) {
          setDailyUsage(data.dailyUsage);
          saveDailyUsage(data.dailyUsage);
          if (data.dailyUsage.remaining <= 0) setRateLimited(true);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please try again.' }]);
    } finally {
      setLoading(false);
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
        <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-[#0A1EFF]" />
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
                  className={`h-full rounded-full transition-all ${dailyUsage.remaining <= 3 ? 'bg-red-500' : dailyUsage.remaining <= 7 ? 'bg-amber-500' : 'bg-[#0A1EFF]'}`}
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
            className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' : 'hover:bg-white/10 text-gray-400'}`}
            title="Chat history"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' : 'hover:bg-white/10 text-gray-400'}`}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass rounded-xl border border-white/10 p-3 mb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-300">Agent Settings</span>
            <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Personality</label>
              <select
                value={settings.personality}
                onChange={(e) => updateSettings({ personality: e.target.value as VtxSettings['personality'] })}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/40"
              >
                <option value="professional">Professional Analyst</option>
                <option value="degen">Degen Trader</option>
                <option value="conservative">Conservative Advisor</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 block">Default Chain</label>
              <select
                value={settings.defaultChain}
                onChange={(e) => updateSettings({ defaultChain: e.target.value as VtxSettings['defaultChain'] })}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/40"
              >
                <option value="solana">Solana</option>
                <option value="ethereum">Ethereum</option>
                <option value="bsc">BSC</option>
                <option value="base">Base</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>
            <div className="pt-1 border-t border-white/[0.06]">
              <p className="text-[9px] text-gray-600">Active: {personalityLabels[settings.personality]} · {chainLabels[settings.defaultChain]}</p>
            </div>
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
                className="px-2 py-1 bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-semibold hover:bg-[#0A1EFF]/30 transition-colors"
              >
                + New Chat
              </button>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/10 rounded ml-1">
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
                  className="w-full text-left p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:border-[#0A1EFF]/20 transition-all"
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
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#0A1EFF]/20 transition-all text-left"
                >
                  <Icon className="w-5 h-5 text-[#0A1EFF] mb-2" />
                  <div className="text-xs font-semibold">{action.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-hide" style={{ maxHeight: '50vh' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#0A1EFF]/20 to-[#7C3AED]/20 border border-[#0A1EFF]/20'
                  : 'glass border border-white/10'
              }`}>
                <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? msg.content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#{1,6}\s/gm, '').replace(/^[-]+\s/gm, '').replace(/^—\s/gm, '') : msg.content}</div>
                {msg.role === 'assistant' && msg.chart && (
                  <InlineChart
                    type={msg.chart.type}
                    token={msg.chart.token}
                    address={msg.chart.address}
                    data={msg.chart.data}
                  />
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-[#1A2235] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="glass border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {webSearchEnabled ? 'Searching Sargon Data Archive...' : 'Querying Steinz Intelligence...'}
                </div>
              </div>
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
            <p className="text-[10px] text-gray-400">Upgrade to STEINZ Pro for unlimited messages</p>
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
            <button
              type="button"
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all flex-shrink-0 ${webSearchEnabled ? 'bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={webSearchEnabled ? 'Web search enabled' : 'Enable web search'}
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
            className="w-10 h-10 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
