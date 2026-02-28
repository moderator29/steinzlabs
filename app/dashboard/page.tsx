'use client';

import { useState } from 'react';
import { Home, Users, MessageSquare, Compass, User, Menu, X, Bell } from 'lucide-react';
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
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">S</span>
            </div>
            <input
              type="text"
              placeholder="Search tokens, wallets..."
              className="hidden sm:block bg-[#111827] border border-white/10 rounded-lg px-4 py-2 w-64 focus:outline-none focus:border-[#00E5FF]/50 text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative">
              <div className="w-2 h-2 bg-[#00E5FF] rounded-full absolute top-0 right-0 animate-pulse"></div>
              <Bell className="w-5 h-5" />
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed top-16 w-full bg-[#111827]/80 backdrop-blur-sm border-b border-white/10 z-30">
        <div className="flex gap-8 px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-sm">BTC</span>
            <span className="text-white font-mono text-sm">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-sm">ETH</span>
            <span className="text-white font-mono text-sm">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400 text-sm">SOL</span>
            <span className="text-white font-mono text-sm">Loading...</span>
          </div>
        </div>
      </div>

      <div className="pt-32 px-4">
        <div className="flex gap-2 mb-6 bg-[#111827] p-2 rounded-2xl max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('context')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${
              activeTab === 'context'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Context Feed
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${
              activeTab === 'markets'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Markets
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${
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
        <div className="grid grid-cols-5 gap-1 px-2 py-3">
          <button className="flex flex-col items-center gap-1 py-2 text-[#00E5FF]">
            <Home className="w-6 h-6" />
            <span className="text-xs font-semibold">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Users className="w-6 h-6" />
            <span className="text-xs">Social</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs">VTX AI</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <Compass className="w-6 h-6" />
            <span className="text-xs">Discover</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-gray-400">
            <User className="w-6 h-6" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>

      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
