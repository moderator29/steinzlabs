'use client';

import { Fish, ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, Bell, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function WhaleTrackerPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');

  const whaleEvents = [
    { type: 'buy', whale: '0x742d...3a7f', token: 'ETH', amount: '$4.46M', time: '5m ago', chain: 'Ethereum', label: 'Alpha Whale' },
    { type: 'sell', whale: '0x9f3a...b21c', token: 'SOL', amount: '$2.1M', time: '12m ago', chain: 'Solana', label: 'DeFi Whale' },
    { type: 'buy', whale: '0x3e7b...f4d8', token: 'LINK', amount: '$8.2M', time: '23m ago', chain: 'Ethereum', label: 'Smart Money' },
    { type: 'transfer', whale: '0xa1b2...c3d4', token: 'USDC', amount: '$15M', time: '45m ago', chain: 'Ethereum', label: 'Exchange Wallet' },
    { type: 'buy', whale: '0xd5e6...f7a8', token: 'ARB', amount: '$1.8M', time: '1h ago', chain: 'Arbitrum', label: 'VC Fund' },
    { type: 'sell', whale: '0xb9c0...d1e2', token: 'MATIC', amount: '$3.4M', time: '2h ago', chain: 'Polygon', label: 'OG Whale' },
    { type: 'buy', whale: '0xf1a2...b3c4', token: 'AVAX', amount: '$5.6M', time: '3h ago', chain: 'Avalanche', label: 'Institutional' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Fish className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Whale Tracker</h1>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[10px] text-[#10B981]">Live</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Buys', 'Sells', 'Transfers'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {whaleEvents
            .filter(e => filter === 'All' || filter.toLowerCase().startsWith(e.type))
            .map((event, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${event.type === 'buy' ? 'bg-[#10B981]/20' : event.type === 'sell' ? 'bg-[#EF4444]/20' : 'bg-[#F59E0B]/20'}`}>
                    {event.type === 'buy' ? <ArrowUpRight className="w-4 h-4 text-[#10B981]" /> : event.type === 'sell' ? <ArrowDownRight className="w-4 h-4 text-[#EF4444]" /> : <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold">{event.label} <span className="text-gray-500 font-normal capitalize">{event.type}</span></div>
                    <div className="text-[10px] text-gray-500 font-mono">{event.whale}</div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500">{event.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="font-semibold text-white text-xs">{event.amount} {event.token}</span>
                  <span>{event.chain}</span>
                </div>
                <button className="text-[#00E5FF] hover:underline text-[10px] flex items-center gap-0.5">
                  View <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
