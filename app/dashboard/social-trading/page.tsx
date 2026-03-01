'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Copy, TrendingUp, Shield, Award, ChevronDown, ChevronUp, Search, Star, UserPlus, UserMinus, Edit3, Save, X, Settings, BarChart3, Percent, Target } from 'lucide-react';
import Image from 'next/image';

interface Trader {
  id: string;
  username: string;
  handle: string;
  avatar: string;
  pnl: number;
  winRate: number;
  followers: number;
  trades: number;
  strategy: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  verified: boolean;
  bio: string;
  recentTrades: { token: string; side: string; pnl: number; time: string }[];
}

interface UserProfile {
  username: string;
  bio: string;
  strategy: string;
  riskLevel: string;
  createdAt: string;
}

interface CopySettings {
  traderId: string;
  maxPerTrade: number;
  stopLoss: number;
  takeProfit: number;
}

const MOCK_TRADERS: Trader[] = [
  {
    id: 't1', username: 'MemeKing', handle: '@memeking', avatar: '👑',
    pnl: 1892.4, winRate: 45.2, followers: 6780, trades: 4521,
    strategy: 'Meme Coins', riskLevel: 'High', verified: true,
    bio: 'Full degen meme coin specialist. 3 years in crypto. Known for early $PEPE and $WIF calls.',
    recentTrades: [
      { token: 'PEPE', side: 'BUY', pnl: 342.5, time: '2h ago' },
      { token: 'WIF', side: 'SELL', pnl: -89.2, time: '5h ago' },
      { token: 'BONK', side: 'BUY', pnl: 156.8, time: '8h ago' },
      { token: 'FLOKI', side: 'BUY', pnl: 221.0, time: '12h ago' },
    ]
  },
  {
    id: 't2', username: 'AltSeason', handle: '@altseason', avatar: '🚀',
    pnl: 945.6, winRate: 61.3, followers: 7650, trades: 3210,
    strategy: 'Alt Rotation', riskLevel: 'High', verified: true,
    bio: 'Altcoin rotation strategist. Timing sector rotations since 2021. Focus on L1/L2 narratives.',
    recentTrades: [
      { token: 'ARB', side: 'BUY', pnl: 78.3, time: '1h ago' },
      { token: 'OP', side: 'SELL', pnl: 145.2, time: '3h ago' },
      { token: 'SUI', side: 'BUY', pnl: -45.6, time: '6h ago' },
      { token: 'SEI', side: 'BUY', pnl: 92.1, time: '10h ago' },
    ]
  },
  {
    id: 't3', username: 'CryptoWhale', handle: '@cryptowhale', avatar: '🐋',
    pnl: 847.3, winRate: 72.8, followers: 12450, trades: 1823,
    strategy: 'Swing Trading', riskLevel: 'Medium', verified: true,
    bio: 'Whale-sized positions on blue chips. Patient swing trader focused on BTC and ETH macro trends.',
    recentTrades: [
      { token: 'BTC', side: 'BUY', pnl: 234.5, time: '4h ago' },
      { token: 'ETH', side: 'BUY', pnl: 189.3, time: '1d ago' },
      { token: 'SOL', side: 'SELL', pnl: 67.8, time: '2d ago' },
      { token: 'LINK', side: 'BUY', pnl: -23.4, time: '3d ago' },
    ]
  },
  {
    id: 't4', username: 'DeFiDegen', handle: '@defidegen', avatar: '🧪',
    pnl: 623.1, winRate: 54.7, followers: 4320, trades: 5678,
    strategy: 'DeFi Yields', riskLevel: 'High', verified: false,
    bio: 'Yield farming and DeFi protocol specialist. Always hunting the best APYs across chains.',
    recentTrades: [
      { token: 'UNI', side: 'BUY', pnl: 56.7, time: '30m ago' },
      { token: 'AAVE', side: 'SELL', pnl: 123.4, time: '2h ago' },
      { token: 'CRV', side: 'BUY', pnl: -34.5, time: '4h ago' },
      { token: 'MKR', side: 'BUY', pnl: 89.0, time: '8h ago' },
    ]
  },
  {
    id: 't5', username: 'SafeHands', handle: '@safehands', avatar: '🛡️',
    pnl: 234.8, winRate: 78.9, followers: 9870, trades: 890,
    strategy: 'Blue Chip Only', riskLevel: 'Low', verified: true,
    bio: 'Conservative crypto trader. BTC/ETH only, DCA strategy. Slow and steady wins the race.',
    recentTrades: [
      { token: 'BTC', side: 'BUY', pnl: 45.6, time: '6h ago' },
      { token: 'ETH', side: 'BUY', pnl: 34.2, time: '1d ago' },
      { token: 'BTC', side: 'BUY', pnl: 23.1, time: '3d ago' },
      { token: 'ETH', side: 'SELL', pnl: 67.8, time: '5d ago' },
    ]
  },
  {
    id: 't6', username: 'ScalpMaster', handle: '@scalpmaster', avatar: '⚡',
    pnl: 567.2, winRate: 52.1, followers: 3210, trades: 12450,
    strategy: 'Scalping', riskLevel: 'Medium', verified: false,
    bio: 'High-frequency scalper. 50+ trades per day. Small profits, compounded over time.',
    recentTrades: [
      { token: 'SOL', side: 'SELL', pnl: 12.3, time: '5m ago' },
      { token: 'ETH', side: 'BUY', pnl: -8.7, time: '15m ago' },
      { token: 'BTC', side: 'SELL', pnl: 15.4, time: '25m ago' },
      { token: 'AVAX', side: 'BUY', pnl: 9.8, time: '40m ago' },
    ]
  },
  {
    id: 't7', username: 'NarrativeKing', handle: '@narrativeking', avatar: '📊',
    pnl: 1245.8, winRate: 58.4, followers: 5430, trades: 2345,
    strategy: 'Narrative Trading', riskLevel: 'Medium', verified: true,
    bio: 'I trade narratives, not charts. AI, RWA, DePIN — catching the next big narrative before the crowd.',
    recentTrades: [
      { token: 'RNDR', side: 'BUY', pnl: 267.3, time: '3h ago' },
      { token: 'FET', side: 'BUY', pnl: 189.5, time: '6h ago' },
      { token: 'ONDO', side: 'SELL', pnl: -45.2, time: '1d ago' },
      { token: 'HNT', side: 'BUY', pnl: 134.7, time: '2d ago' },
    ]
  },
  {
    id: 't8', username: 'DiamondHands', handle: '@diamondhands', avatar: '💎',
    pnl: 2156.7, winRate: 41.3, followers: 8920, trades: 456,
    strategy: 'HODL', riskLevel: 'Low', verified: true,
    bio: 'Buy and hold forever. Only 456 trades in 4 years but massive conviction plays. Never panic sell.',
    recentTrades: [
      { token: 'BTC', side: 'BUY', pnl: 890.2, time: '2w ago' },
      { token: 'ETH', side: 'BUY', pnl: 456.3, time: '1mo ago' },
      { token: 'SOL', side: 'BUY', pnl: 234.5, time: '2mo ago' },
      { token: 'LINK', side: 'BUY', pnl: 178.9, time: '3mo ago' },
    ]
  },
];

type SortKey = 'pnl' | 'winRate' | 'followers' | 'riskLevel';
type TabId = 'leaderboard' | 'profile' | 'following';

const RISK_ORDER: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

export default function SocialTradingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('leaderboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('pnl');
  const [expandedTrader, setExpandedTrader] = useState<string | null>(null);
  const [followedTraders, setFollowedTraders] = useState<string[]>([]);
  const [copySettings, setCopySettings] = useState<CopySettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', bio: '', strategy: '', riskLevel: 'Medium' });

  useEffect(() => {
    const saved = localStorage.getItem('steinz_followed_traders');
    if (saved) setFollowedTraders(JSON.parse(saved));
    const savedProfile = localStorage.getItem('steinz_trader_profile');
    if (savedProfile) setProfile(JSON.parse(savedProfile));
  }, []);

  const saveFollowed = useCallback((ids: string[]) => {
    setFollowedTraders(ids);
    localStorage.setItem('steinz_followed_traders', JSON.stringify(ids));
  }, []);

  const toggleFollow = useCallback((traderId: string) => {
    setFollowedTraders(prev => {
      const next = prev.includes(traderId) ? prev.filter(id => id !== traderId) : [...prev, traderId];
      localStorage.setItem('steinz_followed_traders', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveProfile = useCallback(() => {
    const newProfile: UserProfile = { ...profileForm, createdAt: profile?.createdAt || new Date().toISOString() };
    setProfile(newProfile);
    localStorage.setItem('steinz_trader_profile', JSON.stringify(newProfile));
    setEditingProfile(false);
  }, [profileForm, profile]);

  const startEditProfile = useCallback(() => {
    if (profile) {
      setProfileForm({ username: profile.username, bio: profile.bio, strategy: profile.strategy, riskLevel: profile.riskLevel });
    }
    setEditingProfile(true);
  }, [profile]);

  const sortedTraders = [...MOCK_TRADERS]
    .filter(t => !searchQuery || t.username.toLowerCase().includes(searchQuery.toLowerCase()) || t.strategy.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'pnl') return b.pnl - a.pnl;
      if (sortBy === 'winRate') return b.winRate - a.winRate;
      if (sortBy === 'followers') return b.followers - a.followers;
      if (sortBy === 'riskLevel') return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
      return 0;
    });

  const followedList = MOCK_TRADERS.filter(t => followedTraders.includes(t.id));

  const topTraders = MOCK_TRADERS.length;
  const avgPnl = (MOCK_TRADERS.reduce((s, t) => s + t.pnl, 0) / MOCK_TRADERS.length).toFixed(1);
  const verifiedCount = MOCK_TRADERS.filter(t => t.verified).length;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Award },
    { id: 'profile', label: 'My Profile', icon: Edit3 },
    { id: 'following', label: 'Following', icon: Users },
  ];

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Social Trading</h1>
            <p className="text-xs text-gray-400">Follow and copy top traders</p>
          </div>
        </div>

        <div className="flex bg-[#0D1117] rounded-xl p-1 border border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'following' && followedTraders.length > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{followedTraders.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'leaderboard' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search traders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0D1117] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#00E5FF]/50"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-3 py-2.5 bg-[#0D1117] border border-white/10 rounded-xl text-sm focus:outline-none cursor-pointer"
              >
                <option value="pnl">PnL</option>
                <option value="winRate">Win Rate</option>
                <option value="followers">Followers</option>
                <option value="riskLevel">Risk (Low→High)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10 text-center">
                <Award className="w-5 h-5 text-[#F59E0B] mx-auto mb-1" />
                <div className="text-xs text-gray-400">Top Traders</div>
                <div className="text-lg font-bold">{topTraders}</div>
              </div>
              <div className="glass rounded-xl p-4 border border-white/10 text-center">
                <TrendingUp className="w-5 h-5 text-[#10B981] mx-auto mb-1" />
                <div className="text-xs text-gray-400">Avg PnL</div>
                <div className="text-lg font-bold text-[#10B981]">+{avgPnl}%</div>
              </div>
              <div className="glass rounded-xl p-4 border border-white/10 text-center">
                <Shield className="w-5 h-5 text-[#00E5FF] mx-auto mb-1" />
                <div className="text-xs text-gray-400">Verified</div>
                <div className="text-lg font-bold">{verifiedCount}</div>
              </div>
            </div>

            <div className="space-y-3">
              {sortedTraders.map((trader, idx) => (
                <TraderCard
                  key={trader.id}
                  trader={trader}
                  rank={idx + 1}
                  expanded={expandedTrader === trader.id}
                  followed={followedTraders.includes(trader.id)}
                  onToggleExpand={() => setExpandedTrader(expandedTrader === trader.id ? null : trader.id)}
                  onToggleFollow={() => toggleFollow(trader.id)}
                  onCopy={() => setCopySettings({ traderId: trader.id, maxPerTrade: 100, stopLoss: 10, takeProfit: 25 })}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!profile && !editingProfile ? (
              <div className="glass rounded-2xl p-8 border border-white/10 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Edit3 className="w-7 h-7 text-[#00E5FF]" />
                </div>
                <h2 className="text-lg font-bold mb-2">Create Your Trader Profile</h2>
                <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
                  Set up your profile to appear on the leaderboard and let others copy your trades.
                </p>
                <button onClick={() => setEditingProfile(true)} className="px-6 py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                  Create Profile
                </button>
              </div>
            ) : editingProfile ? (
              <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{profile ? 'Edit Profile' : 'Create Profile'}</h2>
                  <button onClick={() => setEditingProfile(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Username</label>
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="e.g. CryptoTrader42"
                    className="w-full px-4 py-2.5 bg-[#0D1117] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#00E5FF]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Bio</label>
                  <textarea
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell other traders about your strategy and experience..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#0D1117] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#00E5FF]/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Strategy</label>
                  <select
                    value={profileForm.strategy}
                    onChange={(e) => setProfileForm(p => ({ ...p, strategy: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0D1117] border border-white/10 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="">Select strategy...</option>
                    <option value="Swing Trading">Swing Trading</option>
                    <option value="Scalping">Scalping</option>
                    <option value="HODL">HODL</option>
                    <option value="DeFi Yields">DeFi Yields</option>
                    <option value="Meme Coins">Meme Coins</option>
                    <option value="Alt Rotation">Alt Rotation</option>
                    <option value="Narrative Trading">Narrative Trading</option>
                    <option value="Blue Chip Only">Blue Chip Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Risk Level</label>
                  <div className="flex gap-2">
                    {['Low', 'Medium', 'High'].map(level => (
                      <button
                        key={level}
                        onClick={() => setProfileForm(p => ({ ...p, riskLevel: level }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                          profileForm.riskLevel === level
                            ? level === 'Low' ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                              : level === 'Medium' ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                              : 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                            : 'border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={saveProfile}
                  disabled={!profileForm.username || !profileForm.strategy}
                  className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Profile
                </button>
              </div>
            ) : profile && (
              <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-2xl flex items-center justify-center text-2xl">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">{profile.username}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20">You</span>
                      </div>
                      <div className="text-xs text-gray-400">Joined {new Date(profile.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button onClick={startEditProfile} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                {profile.bio && <p className="text-sm text-gray-300">{profile.bio}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0D1117] rounded-xl p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Strategy</div>
                    <div className="text-sm font-semibold text-[#00E5FF]">{profile.strategy}</div>
                  </div>
                  <div className="bg-[#0D1117] rounded-xl p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                    <div className={`text-sm font-semibold ${
                      profile.riskLevel === 'Low' ? 'text-[#10B981]' : profile.riskLevel === 'Medium' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                    }`}>{profile.riskLevel}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0D1117] rounded-xl p-3 border border-white/5 text-center">
                    <div className="text-lg font-bold">0</div>
                    <div className="text-xs text-gray-400">Followers</div>
                  </div>
                  <div className="bg-[#0D1117] rounded-xl p-3 border border-white/5 text-center">
                    <div className="text-lg font-bold">0</div>
                    <div className="text-xs text-gray-400">Trades</div>
                  </div>
                  <div className="bg-[#0D1117] rounded-xl p-3 border border-white/5 text-center">
                    <div className="text-lg font-bold text-gray-500">—</div>
                    <div className="text-xs text-gray-400">PnL</div>
                  </div>
                </div>
                <div className="bg-[#0D1117] rounded-xl p-4 border border-white/5 text-center">
                  <p className="text-xs text-gray-400">Trade history will appear here once you start trading through the platform.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'following' && (
          <div className="space-y-3">
            {followedList.length === 0 ? (
              <div className="glass rounded-2xl p-8 border border-white/10 text-center">
                <Users className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold mb-2">Not Following Anyone</h2>
                <p className="text-sm text-gray-400 mb-4">Head to the Leaderboard and follow traders to see them here.</p>
                <button onClick={() => setActiveTab('leaderboard')} className="px-6 py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                  Browse Leaderboard
                </button>
              </div>
            ) : (
              followedList.map((trader) => (
                <TraderCard
                  key={trader.id}
                  trader={trader}
                  expanded={expandedTrader === trader.id}
                  followed={true}
                  onToggleExpand={() => setExpandedTrader(expandedTrader === trader.id ? null : trader.id)}
                  onToggleFollow={() => toggleFollow(trader.id)}
                  onCopy={() => setCopySettings({ traderId: trader.id, maxPerTrade: 100, stopLoss: 10, takeProfit: 25 })}
                />
              ))
            )}
          </div>
        )}
      </div>

      {copySettings && (
        <CopyModal
          trader={MOCK_TRADERS.find(t => t.id === copySettings.traderId)!}
          settings={copySettings}
          onUpdate={setCopySettings}
          onClose={() => setCopySettings(null)}
        />
      )}
    </div>
  );
}

function TraderCard({ trader, rank, expanded, followed, onToggleExpand, onToggleFollow, onCopy }: {
  trader: Trader;
  rank?: number;
  expanded: boolean;
  followed: boolean;
  onToggleExpand: () => void;
  onToggleFollow: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center gap-3">
          {rank && (
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              rank === 1 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : rank === 2 ? 'bg-gray-400/20 text-gray-300' : rank === 3 ? 'bg-[#CD7F32]/20 text-[#CD7F32]' : 'bg-white/5 text-gray-400'
            }`}>
              {rank}
            </div>
          )}
          <div className="w-10 h-10 rounded-xl bg-[#0D1117] flex items-center justify-center text-lg shrink-0">
            {trader.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm truncate">{trader.username}</span>
              {trader.verified && (
                <Image src="/verified-badge.png" alt="Verified" width={14} height={14} className="shrink-0" />
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                trader.riskLevel === 'Low' ? 'bg-[#10B981]/20 text-[#10B981]' :
                trader.riskLevel === 'Medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                'bg-[#EF4444]/20 text-[#EF4444]'
              }`}>{trader.riskLevel}</span>
            </div>
            <div className="text-xs text-gray-500">{trader.handle}</div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-bold ${trader.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">PnL</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
        </div>

        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="text-center">
            <div className="text-xs text-gray-500">Win Rate</div>
            <div className={`text-sm font-bold ${trader.winRate >= 60 ? 'text-[#10B981]' : trader.winRate >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
              {trader.winRate}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Followers</div>
            <div className="text-sm font-bold">{trader.followers.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Trades</div>
            <div className="text-sm font-bold">{trader.trades.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Strategy</div>
            <div className="text-sm font-bold text-[#00E5FF] truncate">{trader.strategy}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 p-4 bg-[#0A0E1A]/50 space-y-3">
          <p className="text-xs text-gray-300">{trader.bio}</p>

          <div>
            <div className="text-xs text-gray-500 mb-2">Recent Trades</div>
            <div className="space-y-1.5">
              {trader.recentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-[#0D1117] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${trade.side === 'BUY' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{trade.side}</span>
                    <span className="font-semibold">{trade.token}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(1)}%
                    </span>
                    <span className="text-gray-500">{trade.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFollow(); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                followed ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10' : 'bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/20'
              }`}
            >
              {followed ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {followed ? 'Unfollow' : 'Follow'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Trader
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyModal({ trader, settings, onUpdate, onClose }: {
  trader: Trader;
  settings: CopySettings;
  onUpdate: (s: CopySettings) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const existing = JSON.parse(localStorage.getItem('steinz_copy_settings') || '{}');
    existing[trader.id] = settings;
    localStorage.setItem('steinz_copy_settings', JSON.stringify(existing));
    setSaved(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] flex items-center justify-center text-lg">{trader.avatar}</div>
            <div>
              <div className="font-bold text-sm">Copy {trader.username}</div>
              <div className="text-xs text-gray-400">{trader.strategy} • {trader.riskLevel} Risk</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400 flex items-center gap-1"><Target className="w-3 h-3" /> Max Per Trade ($)</label>
              <span className="text-xs font-bold text-[#00E5FF]">${settings.maxPerTrade}</span>
            </div>
            <input
              type="range" min="10" max="1000" step="10"
              value={settings.maxPerTrade}
              onChange={(e) => onUpdate({ ...settings, maxPerTrade: Number(e.target.value) })}
              className="w-full accent-[#00E5FF]"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>$10</span><span>$1,000</span></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400 flex items-center gap-1"><Shield className="w-3 h-3" /> Stop Loss (%)</label>
              <span className="text-xs font-bold text-[#EF4444]">-{settings.stopLoss}%</span>
            </div>
            <input
              type="range" min="1" max="50" step="1"
              value={settings.stopLoss}
              onChange={(e) => onUpdate({ ...settings, stopLoss: Number(e.target.value) })}
              className="w-full accent-[#EF4444]"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>1%</span><span>50%</span></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Take Profit (%)</label>
              <span className="text-xs font-bold text-[#10B981]">+{settings.takeProfit}%</span>
            </div>
            <input
              type="range" min="5" max="200" step="5"
              value={settings.takeProfit}
              onChange={(e) => onUpdate({ ...settings, takeProfit: Number(e.target.value) })}
              className="w-full accent-[#10B981]"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>5%</span><span>200%</span></div>
          </div>
        </div>

        <div className="bg-[#0A0E1A] rounded-xl p-3 border border-white/5">
          <div className="text-xs text-gray-400 mb-2">Summary</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Max/Trade</div>
              <div className="text-sm font-bold">${settings.maxPerTrade}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Stop Loss</div>
              <div className="text-sm font-bold text-[#EF4444]">-{settings.stopLoss}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Take Profit</div>
              <div className="text-sm font-bold text-[#10B981]">+{settings.takeProfit}%</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saved}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            saved ? 'bg-[#10B981] text-white' : 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] hover:opacity-90'
          }`}
        >
          {saved ? (
            <><Settings className="w-4 h-4" /> Copy Settings Saved!</>
          ) : (
            <><Copy className="w-4 h-4" /> Start Copying {trader.username}</>
          )}
        </button>
      </div>
    </div>
  );
}
