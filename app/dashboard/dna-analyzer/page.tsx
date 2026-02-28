'use client';

import { Dna, ArrowLeft, TrendingUp, TrendingDown, Activity, Target, BarChart3, Clock, Zap, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DnaAnalyzerPage() {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState('30d');

  const traits = [
    { label: 'Risk Tolerance', value: 78, color: '#F59E0B', desc: 'Aggressive' },
    { label: 'Timing Accuracy', value: 85, color: '#10B981', desc: 'Excellent' },
    { label: 'Diversification', value: 45, color: '#EF4444', desc: 'Low' },
    { label: 'Diamond Hands', value: 92, color: '#00E5FF', desc: 'Strong' },
    { label: 'DeFi Activity', value: 67, color: '#7C3AED', desc: 'Moderate' },
  ];

  const recentTrades = [
    { token: 'ETH', action: 'Buy', amount: '$12,400', pnl: '+18.2%', time: '2h ago', win: true },
    { token: 'SOL', action: 'Sell', amount: '$8,200', pnl: '+42.5%', time: '5h ago', win: true },
    { token: 'PEPE', action: 'Buy', amount: '$3,100', pnl: '-12.8%', time: '1d ago', win: false },
    { token: 'LINK', action: 'Buy', amount: '$5,600', pnl: '+8.4%', time: '2d ago', win: true },
    { token: 'ARB', action: 'Sell', amount: '$4,800', pnl: '+22.1%', time: '3d ago', win: true },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Dna className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Trading DNA Analyzer</h1>
          <span className="ml-auto px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded text-[10px] font-semibold">NEW</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="glass rounded-xl p-4 border border-white/10 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/10">
            <Dna className="w-10 h-10 text-[#00E5FF]" />
          </div>
          <h2 className="text-lg font-heading font-bold mb-1">Your Trading DNA</h2>
          <p className="text-xs text-gray-500 mb-3">AI-analyzed from 847 on-chain transactions</p>
          <div className="flex gap-2 justify-center">
            {['7d', '30d', '90d', 'All'].map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1 rounded-lg text-[10px] font-semibold ${timeframe === tf ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-gray-500 hover:text-gray-300'}`}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#10B981]">76%</div>
            <div className="text-[10px] text-gray-500">Win Rate</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#00E5FF]">$48.2K</div>
            <div className="text-[10px] text-gray-500">Total P&L</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#7C3AED]">847</div>
            <div className="text-[10px] text-gray-500">Trades</div>
          </div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/10">
          <h3 className="font-bold text-sm mb-3">DNA Traits</h3>
          <div className="space-y-3">
            {traits.map((trait) => (
              <div key={trait.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">{trait.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold" style={{ color: trait.color }}>{trait.desc}</span>
                    <span className="text-xs font-bold">{trait.value}%</span>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${trait.value}%`, backgroundColor: trait.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/10">
          <h3 className="font-bold text-sm mb-3">Recent Trades</h3>
          <div className="space-y-2">
            {recentTrades.map((trade, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.action === 'Buy' ? 'bg-[#10B981]/20' : 'bg-[#EF4444]/20'}`}>
                    {trade.action === 'Buy' ? <TrendingUp className="w-4 h-4 text-[#10B981]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold">{trade.token} <span className="text-gray-500">{trade.action}</span></div>
                    <div className="text-[10px] text-gray-500">{trade.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold">{trade.amount}</div>
                  <div className={`text-[10px] font-semibold ${trade.win ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{trade.pnl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/10">
          <h3 className="font-bold text-sm mb-3">AI Recommendations</h3>
          <div className="space-y-2">
            {[
              { icon: Target, text: 'Diversify into L2 tokens to reduce concentration risk', color: '#F59E0B' },
              { icon: Clock, text: 'Your best entry times are 2-4 AM UTC — lean into this edge', color: '#10B981' },
              { icon: Shield, text: 'Avoid memecoins below $1M mcap — your win rate drops to 23%', color: '#EF4444' },
              { icon: Zap, text: 'Increase DeFi yield farming — matches your risk profile', color: '#7C3AED' },
            ].map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${rec.color}20` }}>
                  <rec.icon className="w-3.5 h-3.5" style={{ color: rec.color }} />
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{rec.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
