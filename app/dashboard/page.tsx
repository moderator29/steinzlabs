'use client';

import { useState } from 'react';
import { Home, Users, MessageSquare, Compass, Wallet, User, Menu, X, Bell, Search } from 'lucide-react';
import ContextFeed from '@/components/ContextFeed';
import Markets from '@/components/Markets';
import Predictions from '@/components/Predictions';
import SidebarMenu from '@/components/SidebarMenu';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('context');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold">S</span>
            </div>
            <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 flex-1 max-w-[240px]">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tokens, wallets..."
                className="bg-transparent focus:outline-none text-sm w-full text-gray-300 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative">
              <div className="w-2 h-2 bg-[#00E5FF] rounded-full absolute -top-0.5 -right-0.5 animate-pulse"></div>
              <Bell className="w-5 h-5 text-gray-400" />
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed top-14 w-full bg-[#111827]/80 backdrop-blur-sm border-b border-white/10 z-30">
        <div className="flex gap-6 px-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-xs font-semibold">BTC</span>
            <span className="text-white font-mono text-xs">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-xs font-semibold">ETH</span>
            <span className="text-white font-mono text-xs">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-xs font-semibold">SOL</span>
            <span className="text-white font-mono text-xs">Loading...</span>
          </div>
        </div>
      </div>

      <div className="pt-[104px] px-3">
        <div className="flex gap-1 mb-4 bg-[#111827] p-1.5 rounded-xl max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('context')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-xs ${
              activeTab === 'context'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Context Feed
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-xs ${
              activeTab === 'markets'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Markets
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-xs ${
              activeTab === 'predictions'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Predictions
          </button>
        </div>

        {activeTab === 'context' && <ContextFeed />}
        {activeTab === 'markets' && <Markets />}
        {activeTab === 'predictions' && <Predictions />}
      </div>

      <div className="fixed bottom-0 w-full glass backdrop-blur-xl border-t border-white/10 z-50">
        <div className="grid grid-cols-6 gap-0 px-1 py-2">
          <button className="flex flex-col items-center gap-0.5 py-1 text-[#00E5FF]">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-1 text-gray-400">
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Social</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-1 text-gray-400">
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px]">VTX AI</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-1 text-gray-400">
            <Compass className="w-5 h-5" />
            <span className="text-[10px]">Discover</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-1 text-gray-400">
            <Wallet className="w-5 h-5" />
            <span className="text-[10px]">Wallet</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-1 text-gray-400">
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
      </div>

      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
