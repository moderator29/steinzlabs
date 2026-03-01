'use client';

import { useState, useEffect } from 'react';
import { Users, Copy, Crown, TrendingUp, Shield, ChevronDown, ChevronUp, X, Search, ArrowUpDown, UserPlus, UserMinus, Save, Edit3 } from 'lucide-react';
import Image from 'next/image';

interface Trader {
  id: string;
  name: string;
  username: string;
  avatar: string;
  pnl: number;
  winRate: number;
  followers: number;
  trades: number;
  strategy: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  verified: boolean;
  bio: string;
  recentTrades: { token: string; type: 'buy' | 'sell'; pnl: number; date: string }[];
}

interface UserProfile {
  username: string;
  bio: string;
  strategy: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface CopySettings {
  traderId: string;
  maxPerTrade: number;
  stopLossPercent: number;
}

const MOCK_TRADERS: Trader[] = [
  {
    id: '1', name: 'CryptoWhale', username: '@cryptowhale', avatar: '🐋',
    pnl: 847.3, winRate: 78.5, followers: 12450, trades: 1823,
    strategy: 'Swing Trading', riskLevel: 'Medium', verified: true,
    bio: 'Professional swing trader. 5+ years in crypto markets. Focus on BTC/ETH macro plays.',
    recentTrades: [
      { token: 'BTC', type: 'buy', pnl: 12.4, date: '2h ago' },
      { token: 'ETH', type: 'sell', pnl: 8.2, date: '5h ago' },
      { token: 'SOL', type: 'buy', pnl: -3.1, date: '1d ago' },
    ]
  },
  {
    id: '2', name: 'DeFi Alpha', username: '@defialpha', avatar: '🦅',
    pnl: 623.1, winRate: 72.3, followers: 8920, trades: 2451,
    strategy: 'DeFi Yield', riskLevel: 'High', verified: true,
    bio: 'DeFi degen. Finding alpha in yield farms, liquidity pools, and new protocols.',
    recentTrades: [
      { token: 'AAVE', type: 'buy', pnl: 18.7, date: '1h ago' },
      { token: 'UNI', type: 'sell', pnl: 5.4, date: '3h ago' },
      { token: 'LINK', type: 'buy', pnl: 9.8, date: '6h ago' },
    ]
  },
  {
    id: '3', name: 'SafeHands', username: '@safehands', avatar: '🛡️',
    pnl: 234.7, winRate: 85.1, followers: 15230, trades: 892,
    strategy: 'Conservative', riskLevel: 'Low', verified: true,
    bio: 'Low risk, consistent returns. Dollar-cost averaging into blue chips only.',
    recentTrades: [
      { token: 'BTC', type: 'buy', pnl: 4.2, date: '4h ago' },
      { token: 'ETH', type: 'buy', pnl: 3.1, date: '1d ago' },
      { token: 'BTC', type: 'buy', pnl: 2.8, date: '2d ago' },
    ]
  },
  {
    id: '4', name: 'MemeKing', username: '@memeking', avatar: '👑',
    pnl: 1892.4, winRate: 45.2, followers: 6780, trades: 4521,
    strategy: 'Meme Coins', riskLevel: 'High', verified: false,
    bio: 'High risk, high reward. Riding the meme coin waves. Not financial advice.',
    recentTrades: [
      { token: 'PEPE', type: 'buy', pnl: 156.3, date: '30m ago' },
      { token: 'DOGE', type: 'sell', pnl: -24.5, date: '2h ago' },
      { token: 'SHIB', type: 'buy', pnl: 42.1, date: '4h ago' },
    ]
  },
  {
    id: '5', name: 'ScalpMaster', username: '@scalpmaster', avatar: '⚡',
    pnl: 412.8, winRate: 68.9, followers: 9340, trades: 8920,
    strategy: 'Scalping', riskLevel: 'Medium', verified: true,
    bio: 'Quick in, quick out. Scalping crypto futures 24/7. High volume, tight stops.',
    recentTrades: [
      { token: 'BTC', type: 'sell', pnl: 1.8, date: '10m ago' },
      { token: 'ETH', type: 'buy', pnl: 2.1, date: '25m ago' },
      { token: 'SOL', type: 'sell', pnl: -0.9, date: '45m ago' },
    ]
  },
  {
    id: '6', name: 'OnChainGuru', username: '@onchainguru', avatar: '🔮',
    pnl: 567.2, winRate: 74.6, followers: 11200, trades: 1456,
    strategy: 'On-Chain Analysis', riskLevel: 'Medium', verified: true,
    bio: 'Data-driven trading. Following smart money flows and on-chain metrics.',
    recentTrades: [
      { token: 'ARB', type: 'buy', pnl: 22.3, date: '3h ago' },
      { token: 'OP', type: 'buy', pnl: 15.6, date: '8h ago' },
      { token: 'MATIC', type: 'sell', pnl: 7.8, date: '1d ago' },
    ]
  },
  {
    id: '7', name: 'AltSeason', username: '@altseason', avatar: '🚀',
    pnl: 945.6, winRate: 61.3, followers: 7650, trades: 3210,
    strategy: 'Alt Rotation', riskLevel: 'High', verified: false,
    bio: 'Rotating between alt coins based on narrative cycles. BTC dominance tracker.',
    recentTrades: [
      { token: 'AVAX', type: 'buy', pnl: 34.2, date: '1h ago' },
      { token: 'NEAR', type: 'sell', pnl: -8.4, date: '5h ago' },
      { token: 'INJ', type: 'buy', pnl: 19.7, date: '12h ago' },
    ]
  },
  {
    id: '8', name: 'BotTrader', username: '@bottrader', avatar: '🤖',
    pnl: 389.4, winRate: 82.7, followers: 5430, trades: 15600,
    strategy: 'Algorithmic', riskLevel: 'Low', verified: true,
    bio: 'Automated trading systems. Grid bots, arbitrage, and market making.',
    recentTrades: [
      { token: 'BTC', type: 'buy', pnl: 0.8, date: '5m ago' },
      { token: 'ETH', type: 'sell', pnl: 0.5, date: '8m ago' },
      { token: 'BTC', type: 'buy', pnl: 0.6, date: '12m ago' },
    ]
  },
];

const RISK_COLORS: Record<string, string> = {
  Low: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20',
  Medium: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
  High: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
};

const SORT_OPTIONS = [
  { label: 'PnL', value: 'pnl' },
  { label: 'Win Rate', value: 'winRate' },
  { label: 'Followers', value: 'followers' },
  { label: 'Risk Level', value: 'riskLevel' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['value'];
type TabKey = 'leaderboard' | 'profile' | 'following';

export default function SocialTradingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');
  const [expandedTrader, setExpandedTrader] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('pnl');
  const [searchQuery, setSearchQuery] = useState('');
  const [followedTraders, setFollowedTraders] = useState<string[]>([]);
  const [copySettings, setCopySettings] = useState<Record<string, CopySettings>>({});
  const [showCopyModal, setShowCopyModal] = useState<string | null>(null);
  const [modalMaxPerTrade, setModalMaxPerTrade] = useState(100);
  const [modalStopLoss, setModalStopLoss] = useState(10);
  const [profile, setProfile] = useState<UserProfile>({
    username: '', bio: '', strategy: 'Swing Trading', riskLevel: 'Medium',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('steinz_followed_traders');
      if (saved) setFollowedTraders(JSON.parse(saved));
      const savedCopy = localStorage.getItem('steinz_copy_settings');
      if (savedCopy) setCopySettings(JSON.parse(savedCopy));
      const savedProfile = localStorage.getItem('steinz_trader_profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
        setProfileSaved(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('steinz_followed_traders', JSON.stringify(followedTraders));
  }, [followedTraders]);

  useEffect(() => {
    localStorage.setItem('steinz_copy_settings', JSON.stringify(copySettings));
  }, [copySettings]);

  const toggleFollow = (id: string) => {
    setFollowedTraders(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const saveProfile = () => {
    localStorage.setItem('steinz_trader_profile', JSON.stringify(profile));
    setProfileSaved(true);
    setIsEditingProfile(false);
  };

  const openCopyModal = (traderId: string) => {
    const existing = copySettings[traderId];
    setModalMaxPerTrade(existing?.maxPerTrade ?? 100);
    setModalStopLoss(existing?.stopLossPercent ?? 10);
    setShowCopyModal(traderId);
  };

  const saveCopySettings = () => {
    if (!showCopyModal) return;
    setCopySettings(prev => ({
      ...prev,
      [showCopyModal]: {
        traderId: showCopyModal,
        maxPerTrade: modalMaxPerTrade,
        stopLossPercent: modalStopLoss,
      }
    }));
    if (!followedTraders.includes(showCopyModal)) {
      setFollowedTraders(prev => [...prev, showCopyModal]);
    }
    setShowCopyModal(null);
  };

  const sortedTraders = [...MOCK_TRADERS]
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.username.toLowerCase().includes(q) || t.strategy.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'pnl': return b.pnl - a.pnl;
        case 'winRate': return b.winRate - a.winRate;
        case 'followers': return b.followers - a.followers;
        case 'riskLevel': {
          const order = { Low: 0, Medium: 1, High: 2 };
          return order[a.riskLevel] - order[b.riskLevel];
        }
        default: return 0;
      }
    });

  const followedTradersList = MOCK_TRADERS.filter(t => followedTraders.includes(t.id));

  const renderTraderCard = (trader: Trader, rank?: number) => {
    const isExpanded = expandedTrader === trader.id;
    const isFollowed = followedTraders.includes(trader.id);
    const hasCopySettings = !!copySettings[trader.id];

    return (
      <div key={trader.id} className="glass rounded-xl border border-white/5 overflow-hidden mb-3">
        <div
          className="p-4 cursor-pointer"
          onClick={() => setExpandedTrader(isExpanded ? null : trader.id)}
        >
          <div className="flex items-center gap-3">
            {rank && (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                rank === 1 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                rank === 3 ? 'bg-orange-600/20 text-orange-400' :
                'bg-white/5 text-gray-500'
              }`}>
                {rank}
              </div>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED]/30 to-[#00E5FF]/30 flex items-center justify-center text-lg shrink-0">
              {trader.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate">{trader.name}</span>
                {trader.verified && (
                  <Image src="/verified-badge.png" alt="Verified" width={14} height={14} className="shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">{trader.username}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${RISK_COLORS[trader.riskLevel]}`}>
                  {trader.riskLevel}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-bold ${trader.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {trader.pnl >= 0 ? '+' : ''}{trader.pnl.toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-500">PnL</div>
            </div>
            <div className="shrink-0">
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
            <div className="flex-1 text-center">
              <div className="text-[10px] text-gray-500">Win Rate</div>
              <div className="text-xs font-bold text-[#00E5FF]">{trader.winRate}%</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[10px] text-gray-500">Followers</div>
              <div className="text-xs font-bold">{trader.followers.toLocaleString()}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[10px] text-gray-500">Trades</div>
              <div className="text-xs font-bold">{trader.trades.toLocaleString()}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[10px] text-gray-500">Strategy</div>
              <div className="text-xs font-bold text-[#7C3AED]">{trader.strategy}</div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-white/5">
            <p className="text-[11px] text-gray-400 mt-3 mb-3">{trader.bio}</p>

            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Recent Trades</div>
            <div className="space-y-1.5 mb-4">
              {trader.recentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      trade.type === 'buy' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {trade.type.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold">{trade.token}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl}%
                    </span>
                    <span className="text-[9px] text-gray-500">{trade.date}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFollow(trader.id); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isFollowed
                    ? 'bg-white/10 text-gray-300 border border-white/10'
                    : 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                }`}
              >
                {isFollowed ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {isFollowed ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openCopyModal(trader.id); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  hasCopySettings
                    ? 'bg-[#7C3AED]/20 text-[#7C3AED] border border-[#7C3AED]/30'
                    : 'bg-[#7C3AED] text-white'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                {hasCopySettings ? 'Edit Copy' : 'Copy Trades'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#7C3AED]/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Social Trading</h1>
            <p className="text-[10px] text-gray-500">Follow and copy top traders</p>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
          {([
            { key: 'leaderboard' as TabKey, label: 'Leaderboard', icon: Crown },
            { key: 'profile' as TabKey, label: 'My Profile', icon: Edit3 },
            { key: 'following' as TabKey, label: 'Following', icon: Users },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === 'following' && followedTraders.length > 0 && (
                <span className="ml-0.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">{followedTraders.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'leaderboard' && (
          <>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search traders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7C3AED]/50"
                />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-8 text-xs text-white focus:outline-none focus:border-[#7C3AED]/50 cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#1A1F2E]">{opt.label}</option>
                  ))}
                </select>
                <ArrowUpDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="glass rounded-xl p-3 border border-[#F59E0B]/20 text-center">
                <Crown className="w-4 h-4 text-[#F59E0B] mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Top Traders</div>
                <div className="text-sm font-bold">{MOCK_TRADERS.length}</div>
              </div>
              <div className="glass rounded-xl p-3 border border-[#00E5FF]/20 text-center">
                <TrendingUp className="w-4 h-4 text-[#00E5FF] mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Avg PnL</div>
                <div className="text-sm font-bold text-[#10B981]">+{(MOCK_TRADERS.reduce((s, t) => s + t.pnl, 0) / MOCK_TRADERS.length).toFixed(1)}%</div>
              </div>
              <div className="glass rounded-xl p-3 border border-[#7C3AED]/20 text-center">
                <Shield className="w-4 h-4 text-[#7C3AED] mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Verified</div>
                <div className="text-sm font-bold">{MOCK_TRADERS.filter(t => t.verified).length}</div>
              </div>
            </div>

            {sortedTraders.length === 0 ? (
              <div className="glass rounded-xl p-8 border border-white/5 text-center">
                <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <div className="text-sm text-gray-500">No traders found</div>
              </div>
            ) : (
              sortedTraders.map((trader, i) => renderTraderCard(trader, i + 1))
            )}
          </>
        )}

        {activeTab === 'profile' && (
          <div className="glass rounded-xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm font-bold">Trader Profile</div>
              {profileSaved && !isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="flex items-center gap-1 text-[10px] text-[#00E5FF] font-semibold"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {profileSaved && !isEditingProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] flex items-center justify-center text-2xl">
                    {profile.username ? profile.username[0]?.toUpperCase() : '?'}
                  </div>
                  <div>
                    <div className="text-base font-bold">{profile.username || 'Anonymous'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{profile.strategy}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${RISK_COLORS[profile.riskLevel]}`}>
                        {profile.riskLevel} Risk
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-1">Bio</div>
                  <div className="text-xs text-gray-300">{profile.bio || 'No bio set'}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500">Following</div>
                    <div className="text-sm font-bold">{followedTraders.length}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500">Copying</div>
                    <div className="text-sm font-bold">{Object.keys(copySettings).length}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500">Joined</div>
                    <div className="text-sm font-bold">Today</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">Username</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile(p => ({ ...p, username: e.target.value }))}
                    placeholder="Enter your trader name"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7C3AED]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Describe your trading style and experience"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7C3AED]/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">Strategy</label>
                  <select
                    value={profile.strategy}
                    onChange={(e) => setProfile(p => ({ ...p, strategy: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7C3AED]/50 cursor-pointer"
                  >
                    {['Swing Trading', 'Day Trading', 'Scalping', 'DeFi Yield', 'Conservative', 'Meme Coins', 'On-Chain Analysis', 'Algorithmic', 'Alt Rotation'].map(s => (
                      <option key={s} value={s} className="bg-[#1A1F2E]">{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">Risk Level</label>
                  <div className="flex gap-2">
                    {(['Low', 'Medium', 'High'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setProfile(p => ({ ...p, riskLevel: level }))}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                          profile.riskLevel === level
                            ? RISK_COLORS[level]
                            : 'border-white/10 text-gray-500'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={saveProfile}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Save className="w-4 h-4" />
                  Save Profile
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'following' && (
          <>
            {followedTradersList.length === 0 ? (
              <div className="glass rounded-xl p-8 border border-white/5 text-center">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <div className="text-sm font-bold mb-1">Not following anyone yet</div>
                <p className="text-[11px] text-gray-500 mb-4">Head to the Leaderboard to discover and follow top traders</p>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] px-6 py-2.5 rounded-lg text-xs font-semibold"
                >
                  Browse Leaderboard
                </button>
              </div>
            ) : (
              <>
                <div className="glass rounded-xl p-3 border border-white/5 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-gray-500">Following </span>
                      <span className="font-bold">{followedTradersList.length}</span>
                      <span className="text-gray-500"> traders</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Copying </span>
                      <span className="font-bold text-[#7C3AED]">{Object.keys(copySettings).filter(id => followedTraders.includes(id)).length}</span>
                    </div>
                  </div>
                </div>
                {followedTradersList.map(trader => renderTraderCard(trader))}
              </>
            )}
          </>
        )}
      </div>

      {showCopyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="glass rounded-2xl border border-white/10 w-full max-w-sm p-5 relative">
            <button
              onClick={() => setShowCopyModal(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] flex items-center justify-center text-lg">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">Copy Trade Settings</div>
                <div className="text-[10px] text-gray-500">
                  {MOCK_TRADERS.find(t => t.id === showCopyModal)?.name}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">
                  Max Per Trade (USD)
                </label>
                <input
                  type="number"
                  value={modalMaxPerTrade}
                  onChange={(e) => setModalMaxPerTrade(Number(e.target.value))}
                  min={10}
                  max={10000}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7C3AED]/50"
                />
                <div className="text-[9px] text-gray-600 mt-1">Maximum amount allocated per copied trade</div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 mb-1.5 block uppercase tracking-wider font-semibold">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  value={modalStopLoss}
                  onChange={(e) => setModalStopLoss(Number(e.target.value))}
                  min={1}
                  max={50}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7C3AED]/50"
                />
                <div className="text-[9px] text-gray-600 mt-1">Auto-close position if loss exceeds this percentage</div>
              </div>

              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-gray-500">Max per trade</span>
                  <span className="font-bold">${modalMaxPerTrade}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Stop loss</span>
                  <span className="font-bold text-[#EF4444]">-{modalStopLoss}%</span>
                </div>
              </div>

              <button
                onClick={saveCopySettings}
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Start Copying
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}