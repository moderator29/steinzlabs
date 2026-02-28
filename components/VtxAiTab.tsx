'use client';

import { useState } from 'react';
import { BarChart3, Briefcase, AlertTriangle, Radio, Send } from 'lucide-react';

export default function VtxAiTab() {
  const [message, setMessage] = useState('');

  const quickActions = [
    { icon: BarChart3, label: 'Market Overview' },
    { icon: Briefcase, label: 'Portfolio Check' },
    { icon: AlertTriangle, label: 'Risk Analysis' },
    { icon: Radio, label: 'Signal Analysis' },
  ];

  return (
    <div className="flex flex-col min-h-[65vh]">
      <div className="glass rounded-xl p-3 border border-white/10 flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-4 h-4 text-[#00E5FF]" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold">VTX AI</div>
          <div className="text-[10px] text-gray-400">On-chain intelligence assistant</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
          <span className="text-[10px] text-[#10B981] font-semibold">Live</span>
        </div>
      </div>

      <p className="text-sm text-gray-300 text-center mb-6 leading-relaxed px-2">
        Welcome to VTX AI. I analyze real-time on-chain data across 12+ chains to give you actionable insights.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/20 transition-all text-left"
            >
              <Icon className="w-5 h-5 text-[#00E5FF] mb-2" />
              <div className="text-xs font-semibold">{action.label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1"></div>

      <div className="flex items-center gap-2 mt-4">
        <div className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-4 py-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask VTX AI about markets, signals, risk..."
            className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500"
          />
        </div>
        <button className="w-10 h-10 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
