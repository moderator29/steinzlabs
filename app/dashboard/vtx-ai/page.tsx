'use client';

import { Bot, ArrowLeft, Send, Sparkles, TrendingUp, Shield, BarChart3, Zap, Loader2, User, Copy, Check, Trash2, Globe, Crown, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'vtx-ai-page-history';
const TIER_KEY = 'naka_user_tier';
const USAGE_KEY = 'vtx-ai-daily-usage';

function loadHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [
    { role: 'assistant', content: 'Hey! I\'m VTX AI — I search live market data before answering so you always get current prices and trends. Ask me anything about crypto, markets, or really anything else.' },
  ];
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
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

export default function VtxAiPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [tier, setTier] = useState('free');
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 15, remaining: 15 });
  const [rateLimited, setRateLimited] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setMessages(loadHistory());
      setTier(getUserTier());
      setDailyUsage(getDailyUsage());
    }
  }, []);

  useEffect(() => {
    if (initialized.current && messages.length > 0) {
      saveHistory(messages);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickActions = [
    { icon: TrendingUp, label: 'Market Overview', query: 'Give me a comprehensive market overview for today including BTC, ETH, SOL trends, DeFi activity, and any notable on-chain signals.' },
    { icon: BarChart3, label: 'Portfolio Analysis', query: 'What are the best strategies for building a diversified crypto portfolio right now? Include risk management and sector allocation.' },
    { icon: Shield, label: 'Risk Assessment', query: 'What are the biggest risks in the crypto market right now? Flag any red flags, potential rug pulls, or macro concerns.' },
    { icon: Zap, label: 'Trading Signals', query: 'What on-chain signals are showing the most bullish or bearish activity right now? Include whale movements and smart money flows.' },
  ];

  const clearChat = () => {
    const fresh = [
      { role: 'assistant' as const, content: 'Chat cleared! Ask me anything — I search live market data before answering.' },
    ];
    setMessages(fresh);
    saveHistory(fresh);
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    if (tier !== 'pro' && rateLimited) return;

    let finalMessage = msg.trim();
    if (webSearchEnabled) {
      finalMessage = finalMessage + ' [WEB_SEARCH]';
    }

    const userMessage: Message = { role: 'user', content: msg.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          history: messages.slice(-10),
          tier,
        }),
      });

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '⚡ You\'ve reached your daily free limit of 15 messages. Upgrade to **NAKA Pro** for unlimited VTX AI access, web search, and more!' }]);
        if (data.usage) {
          const usage = { used: data.usage.used, limit: data.usage.limit, remaining: data.usage.remaining };
          setDailyUsage(usage);
          saveDailyUsage(usage);
        }
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}. Please try again.` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        if (data.dailyUsage) {
          setDailyUsage(data.dailyUsage);
          saveDailyUsage(data.dailyUsage);
          if (data.dailyUsage.remaining <= 0) setRateLimited(true);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to VTX AI. Please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (idx: number) => {
    const msg = messages[idx];
    if (msg) {
      navigator.clipboard.writeText(msg.content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  const isPro = tier === 'pro';

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white flex flex-col">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-heading font-bold">VTX AI Assistant</h1>
              {isPro && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded text-[9px] text-amber-400 font-bold">
                  <Crown className="w-2.5 h-2.5" /> PRO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-[10px] text-[#10B981]">Live market data</span>
            </div>
          </div>
          {!isPro && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111827] rounded-lg border border-white/10">
              <span className="text-[10px] text-gray-400">{dailyUsage.used}/{dailyUsage.limit}</span>
              <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${dailyUsage.remaining <= 3 ? 'bg-red-500' : dailyUsage.remaining <= 7 ? 'bg-amber-500' : 'bg-[#00D4AA]'}`}
                  style={{ width: `${(dailyUsage.used / dailyUsage.limit) * 100}%` }}
                />
              </div>
            </div>
          )}
          {messages.length > 1 && (
            <button onClick={clearChat} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Clear chat">
              <Trash2 className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-gradient-to-br from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed relative ${msg.role === 'user' ? 'bg-gradient-to-r from-[#00D4AA]/20 to-[#6366F1]/20 border border-[#00D4AA]/20 text-white' : 'glass border border-white/10 text-gray-300'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-[#00D4AA]" />
                  <span className="text-[10px] font-semibold text-[#00D4AA]">VTX AI</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && i > 0 && (
                <button
                  onClick={() => copyMessage(i)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                >
                  {copiedIdx === i ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-gray-500" />}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 bg-[#1A2235] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ml-2">
                <User className="w-3.5 h-3.5 text-gray-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-gradient-to-br from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="glass border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#00D4AA]" />
                {webSearchEnabled ? 'Searching the web & live data...' : 'Searching live data...'}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10 space-y-3 bg-[#0B0D14]/80 backdrop-blur-sm">
        {rateLimited && !isPro && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] text-amber-300 font-semibold">Daily limit reached</p>
              <p className="text-[10px] text-gray-400">Upgrade to NAKA Pro for unlimited messages</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/pricing')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-[10px] font-bold text-black hover:scale-105 transition-transform"
            >
              Upgrade
            </button>
          </div>
        )}
        {messages.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => handleSend(action.query)} className="flex items-center gap-1.5 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-[10px] font-semibold whitespace-nowrap hover:border-[#00D4AA]/30 transition-colors">
                <action.icon className="w-3 h-3 text-[#00D4AA]" />
                {action.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#111827] border border-white/10 rounded-xl px-3">
            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all flex-shrink-0 ${webSearchEnabled ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={webSearchEnabled ? 'Web search enabled' : 'Enable web search'}
            >
              <Globe className="w-3 h-3" />
              Web
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask VTX AI anything..."
              className="flex-1 bg-transparent py-3 text-xs placeholder-gray-600 focus:outline-none"
              disabled={loading || (rateLimited && !isPro)}
            />
          </div>
          <button onClick={() => handleSend()} disabled={loading || !input.trim() || (rateLimited && !isPro)} className="bg-gradient-to-r from-[#00D4AA] to-[#6366F1] p-3 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
