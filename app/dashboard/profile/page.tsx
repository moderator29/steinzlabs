'use client';

import { useState } from 'react';
import { User, ArrowLeft, Award, BarChart3, Bell, Lock, Settings, HelpCircle, LogOut, ChevronRight, Copy, Globe, Eye, EyeOff, Trash2, Download, Star } from 'lucide-react';
import Link from 'next/link';

const TABS = ['Activity', 'Settings', 'Achievements'];

interface Achievement {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  date?: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { name: 'First Prediction', description: 'Made your first prediction', icon: '🎯', earned: true, date: 'Jan 15, 2025' },
  { name: 'Whale Spotter', description: 'Found 10 whale moves', icon: '🐋', earned: true, date: 'Feb 3, 2025' },
  { name: 'Social Butterfly', description: 'Joined 5 groups', icon: '🦋', earned: false },
  { name: 'Builder Supporter', description: 'Funded 3 projects', icon: '🏗️', earned: false },
  { name: 'Perfect Week', description: '100% win rate in a week', icon: '🏆', earned: false },
  { name: 'Diamond Hands', description: 'Held a position 30+ days', icon: '💎', earned: false },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('Activity');
  const [walletConnected] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 bg-[#1A2235] rounded-full flex items-center justify-center mb-3 border-2 border-white/10">
            <User className="w-12 h-12 text-gray-500" />
          </div>
          <h2 className="text-xl font-heading font-bold mb-1">Guest User</h2>
          {walletConnected ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-mono">0x7a2d...9f4e</span>
              <button className="text-[#00D4AA]"><Copy className="w-3 h-3" /></button>
            </div>
          ) : (
            <button className="bg-gradient-to-r from-[#00D4AA] to-[#6366F1] px-5 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-transform mt-1">
              Connect Wallet
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: 'Predictions', value: '24' },
            { label: 'Win Rate', value: '67%' },
            { label: 'Winnings', value: '$1,247' },
            { label: 'Rank', value: '#342' },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-lg p-2.5 text-center border border-white/10">
              <div className="text-sm font-bold bg-gradient-to-r from-[#00D4AA] to-[#6366F1] bg-clip-text text-transparent">{stat.value}</div>
              <div className="text-[9px] text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-4 bg-[#111827] p-1 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === tab ? 'bg-gradient-to-r from-[#00D4AA] to-[#6366F1] text-white' : 'text-gray-400'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Activity' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recent Predictions</div>
              <div className="space-y-1.5">
                {[
                  { q: 'Will SOL hit $200?', vote: 'YES', outcome: 'Pending', pnl: '—' },
                  { q: 'Will BTC break $100K?', vote: 'YES', outcome: 'Won', pnl: '+$149' },
                  { q: 'Will ETH drop below $3K?', vote: 'NO', outcome: 'Won', pnl: '+$82' },
                  { q: 'Will DOGE hit $1?', vote: 'YES', outcome: 'Lost', pnl: '-$50' },
                  { q: 'Will gas fees drop?', vote: 'NO', outcome: 'Pending', pnl: '—' },
                ].map((pred, i) => (
                  <div key={i} className="glass rounded-lg p-3 border border-white/10 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{pred.q}</div>
                      <div className="text-[10px] text-gray-500">You voted: {pred.vote}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className={`text-[10px] font-semibold ${pred.outcome === 'Won' ? 'text-[#10B981]' : pred.outcome === 'Lost' ? 'text-[#EF4444]' : 'text-gray-500'}`}>{pred.outcome}</div>
                      <div className={`text-[10px] font-mono ${pred.pnl.startsWith('+') ? 'text-[#10B981]' : pred.pnl.startsWith('-') ? 'text-[#EF4444]' : 'text-gray-500'}`}>{pred.pnl}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Social Trading Activity</div>
              <div className="glass rounded-lg p-3 border border-white/10 text-center text-xs text-gray-500">
                Not copying any traders yet
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Builder Funding</div>
              <div className="glass rounded-lg p-3 border border-white/10 text-center text-xs text-gray-500">
                No projects funded yet
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Notifications</div>
              <div className="glass rounded-xl border border-white/10 divide-y divide-white/5">
                {[
                  { label: 'Email Notifications', desc: 'Get email updates' },
                  { label: 'Whale Alerts', desc: 'Large transaction alerts' },
                  { label: 'Prediction Results', desc: 'When predictions resolve' },
                  { label: 'Social Trading Alerts', desc: 'When copied traders trade' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-gray-500">{item.desc}</div>
                    </div>
                    <div className="w-10 h-5 bg-[#111827] rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-gray-500 rounded-full absolute top-0.5 left-0.5 transition-all"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Preferences</div>
              <div className="glass rounded-xl border border-white/10 divide-y divide-white/5">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-xs font-semibold">Default Currency</div>
                  <select className="bg-[#111827] border border-white/10 rounded px-2 py-1 text-[10px]">
                    <option>USD</option><option>EUR</option><option>BTC</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-xs font-semibold">Default Chain</div>
                  <select className="bg-[#111827] border border-white/10 rounded px-2 py-1 text-[10px]">
                    <option>Solana</option><option>Ethereum</option><option>BSC</option><option>Polygon</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-xs font-semibold">Language</div>
                  <select className="bg-[#111827] border border-white/10 rounded px-2 py-1 text-[10px]">
                    <option>English</option><option>Spanish</option><option>Chinese</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Privacy</div>
              <div className="glass rounded-xl border border-white/10 divide-y divide-white/5">
                {[
                  { label: 'Profile Visibility', desc: 'Public / Private' },
                  { label: 'Hide Win Rate', desc: 'Others cannot see your stats' },
                  { label: 'Hide Profit Amounts', desc: 'Keep earnings private' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-gray-500">{item.desc}</div>
                    </div>
                    <div className="w-10 h-5 bg-[#111827] rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-gray-500 rounded-full absolute top-0.5 left-0.5 transition-all"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#EF4444] uppercase tracking-wider mb-2">Danger Zone</div>
              <div className="glass rounded-xl border border-[#EF4444]/20 divide-y divide-white/5">
                <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors">
                  <Download className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold">Export Data</span>
                </button>
                <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#EF4444]/5 transition-colors text-[#EF4444]">
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-semibold">Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Achievements' && (
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.name} className={`glass rounded-xl p-3 border transition-all ${a.earned ? 'border-[#00D4AA]/30 bg-[#00D4AA]/5' : 'border-white/10 opacity-50'}`}>
                <div className="text-2xl mb-2">{a.icon}</div>
                <div className="text-xs font-bold mb-0.5">{a.name}</div>
                <div className="text-[10px] text-gray-500 mb-1">{a.description}</div>
                {a.earned ? (
                  <div className="text-[9px] text-[#10B981] font-semibold">Earned {a.date}</div>
                ) : (
                  <div className="text-[9px] text-gray-600">Locked</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
