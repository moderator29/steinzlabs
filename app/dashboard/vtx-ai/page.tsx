'use client';

import { Bot, ArrowLeft, Send, Sparkles, TrendingUp, Shield, BarChart3, Zap, Loader2, User, Copy, Check, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'vtx-ai-page-history';

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

export default function VtxAiPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setMessages(loadHistory());
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

    const userMessage: Message = { role: 'user', content: msg.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg.trim(),
          history: messages.slice(-10),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}. Please try again.` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
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

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-heading font-bold">VTX AI Assistant</h1>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-[10px] text-[#10B981]">Live market data</span>
            </div>
          </div>
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
              <div className="w-7 h-7 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed relative ${msg.role === 'user' ? 'bg-gradient-to-r from-[#00E5FF]/20 to-[#7C3AED]/20 border border-[#00E5FF]/20 text-white' : 'glass border border-white/10 text-gray-300'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                  <span className="text-[10px] font-semibold text-[#00E5FF]">VTX AI</span>
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
            <div className="w-7 h-7 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="glass border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                Searching live data...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10 space-y-3 bg-[#0A0E1A]/80 backdrop-blur-sm">
        {messages.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => handleSend(action.query)} className="flex items-center gap-1.5 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-[10px] font-semibold whitespace-nowrap hover:border-[#00E5FF]/30 transition-colors">
                <action.icon className="w-3 h-3 text-[#00E5FF]" />
                {action.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask VTX AI anything..."
            className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-xs placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/30"
            disabled={loading}
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] p-3 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
