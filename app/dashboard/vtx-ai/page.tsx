'use client';

import { Bot, ArrowLeft, Send, Sparkles, TrendingUp, Shield, BarChart3, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function VtxAiPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Welcome to VTX AI! I can help you analyze markets, assess risk, track whale movements, and generate trading signals. What would you like to know?' },
  ]);

  const quickActions = [
    { icon: TrendingUp, label: 'Market Overview', query: 'Give me a market overview for today' },
    { icon: BarChart3, label: 'Portfolio Analysis', query: 'Analyze my portfolio performance' },
    { icon: Shield, label: 'Risk Assessment', query: 'What are the biggest risks in my portfolio?' },
    { icon: Zap, label: 'Trading Signals', query: 'Show me the top trading signals right now' },
  ];

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Based on my analysis of current on-chain data:\n\n• BTC showing strong accumulation by whale wallets (>1000 BTC)\n• ETH gas fees trending lower, suggesting decreased network congestion\n• SOL ecosystem seeing increased DeFi activity (+23% TVL this week)\n• Top signal: LINK showing smart money accumulation pattern\n\nWould you like me to dive deeper into any of these insights?`
      }]);
    }, 1500);
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
          <div>
            <h1 className="text-sm font-heading font-bold">VTX AI Assistant</h1>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-[10px] text-[#10B981]">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'glass border border-white/10 text-gray-300'}`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                  <span className="text-[10px] font-semibold text-[#00E5FF]">VTX AI</span>
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {quickActions.map((action) => (
            <button key={action.label} onClick={() => handleSend(action.query)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-white/10 rounded-lg text-[10px] font-semibold whitespace-nowrap hover:border-[#00E5FF]/30 transition-colors">
              <action.icon className="w-3 h-3 text-[#00E5FF]" />
              {action.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask VTX AI anything..."
            className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-xs placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/30"
          />
          <button onClick={() => handleSend()} className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] p-3 rounded-xl hover:scale-105 transition-transform">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
