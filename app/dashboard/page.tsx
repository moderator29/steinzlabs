'use client';

import { useState } from 'react';
import { Home, Users, MessageSquare, Compass, Wallet as WalletIcon, User, Menu, X } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('context');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      {/* Top Bar */}
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">S</span>
            </div>
            <input
              type="text"
              placeholder="Search tokens, wallets..."
              className="hidden sm:block bg-[#111827] border border-white/10 rounded-lg px-4 py-2 w-64 focus:outline-none focus:border-[#00E5FF]/50"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative">
              <div className="w-2 h-2 bg-[#00E5FF] rounded-full absolute top-0 right-0"></div>
              <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center">
                🔔
              </div>
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Price Ticker */}
      <div className="fixed top-16 w-full bg-[#111827]/80 backdrop-blur-sm border-b border-white/10 z-30">
        <div className="flex gap-8 px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400">BTC</span>
            <span className="text-white font-mono">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400">ETH</span>
            <span className="text-white font-mono">Loading...</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-400">SOL</span>
            <span className="text-white font-mono">Loading...</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-32 px-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[#111827] p-2 rounded-2xl max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('context')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'context'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Context Feed
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'markets'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Markets
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'predictions'
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Predictions
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'context' && (
          <div className="space-y-4">
            {/* Context Feed Card 1 */}
            <div className="glass rounded-2xl p-6 border border-white/10 hover:border-[#00E5FF]/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <span className="px-3 py-1 bg-[#10B981]/20 text-[#10B981] rounded-full text-sm font-semibold">
                  BULLISH
                </span>
                <span className="text-gray-400 text-sm">5m ago</span>
              </div>
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                🐋 Large SOL → USDC swap detected
              </h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.
              </p>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="text-gray-400">💰 $4.46M</span>
                <span className="text-gray-400">👤 0x742d...3a7f</span>
                <span className="text-gray-400">⛓️ Solana</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-[#10B981]/20 rounded-full h-2 max-w-[100px]">
                    <div className="bg-[#10B981] h-2 rounded-full" style={{ width: '82%' }}></div>
                  </div>
                  <span className="text-sm font-semibold text-[#10B981]">82</span>
                  <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded text-xs font-semibold">TRUSTED</span>
                </div>
                <button className="text-[#00E5FF] font-semibold hover:underline">
                  View Proof →
                </button>
              </div>
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
                <span>👁️ 12,400</span>
                <span>💬 754</span>
                <span>🔗 412</span>
                <span>❤️ 2,600</span>
              </div>
            </div>

            {/* Context Feed Card 2 */}
            <div className="glass rounded-2xl p-6 border border-white/10 hover:border-[#F59E0B]/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <span className="px-3 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full text-sm font-semibold">
                  HYPE
                </span>
                <span className="text-gray-400 text-sm">12m ago</span>
              </div>
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                🚀 New memecoin $FIZZ launched on Pump.fun
              </h3>
              <p className="text-gray-300 mb-4 leading-relaxed">
                Token raised 16,000 SOL in first hour. Top investor wallet linked to 3 previous 100x launches. Community growing rapidly.
              </p>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="text-gray-400">💰 $2.8M</span>
                <span className="text-gray-400">👤 0x9f3a...b21c</span>
                <span className="text-gray-400">⛓️ Solana</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-[#F59E0B]/20 rounded-full h-2 max-w-[100px]">
                    <div className="bg-[#F59E0B] h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                  <span className="text-sm font-semibold text-[#F59E0B]">65</span>
                  <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-semibold">MEDIUM</span>
                </div>
                <button className="text-[#00E5FF] font-semibold hover:underline">
                  View Proof →
                </button>
              </div>
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
                <span>👁️ 8,900</span>
                <span>💬 523</span>
                <span>🔗 201</span>
                <span>❤️ 1,800</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'markets' && (
          <div>
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
              {['All', 'Trending', 'DeFi', 'Meme', 'Gainers', 'Losers'].map((filter) => (
                <button
                  key={filter}
                  className="px-4 py-2 bg-[#111827] rounded-lg hover:bg-[#1A2235] transition-colors whitespace-nowrap text-sm"
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="text-center py-20 text-gray-400">
              <p className="text-xl mb-2">Markets data loading...</p>
              <p className="text-sm">Real-time price feeds coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[#00E5FF]">0</div>
                <div className="text-sm text-gray-400 mt-1">Active</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[#00E5FF]">$0</div>
                <div className="text-sm text-gray-400 mt-1">Total Volume</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[#00E5FF]">0</div>
                <div className="text-sm text-gray-400 mt-1">Resolved</div>
              </div>
            </div>
            <div className="text-center py-20 text-gray-400">
              <p className="text-xl mb-2">Predictions Market</p>
              <p className="text-sm">Coming in next update</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
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

      {/* Side Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-80 bg-[#0A0E1A] border-l border-white/10 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold">Menu</h2>
              <button onClick={() => setMenuOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Intelligence</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Whale Tracker
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Smart Money Watchlist
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Network Metrics
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Tools</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Token Scanner
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Multi-Chain Swap
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                    Trading DNA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
