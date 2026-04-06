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
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
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
