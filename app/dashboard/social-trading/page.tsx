'use client';

import { useState, useEffect } from 'react';
import { Users, ArrowLeft, TrendingUp, Copy, Star, ChevronDown, ChevronUp, X, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Trade {
  pair: string;
  result: string;
  profit: string;
  date?: string;
}

interface Trader {
  id: number;
  name: string;
  verified: boolean;
  bio: string;
  winRate: number;
  totalProfit: string;
  followers: number;
  avgReturn: string;
  recentTrades: Trade[];
  weekProfit: string;
  monthProfit: string;
  allTimeProfit: string;
  weekWinRate: number;
  monthWinRate: number;
  strategy: string;
  riskLevel: string;
}

interface CopySettings {
  maxPerTrade: number;
  stopLoss: number;
  takeProfit: number;
}

interface UserProfile {
  username: string;
  bio: string;
  strategy: string;
  riskLevel: string;
}

const TRADERS: Trader[] = [
  { id: 1, name: 'SolanaWhale', verified: true, bio: 'Full-time crypto trader since 2019', winRate: 87, totalProfit: '+$45.2K', followers: 1247, avgReturn: '+156%', strategy: 'Swing Trading', riskLevel: 'Medium', weekProfit: '+$3.1K', monthProfit: '+$12.4K', allTimeProfit: '+$45.2K', weekWinRate: 90, monthWinRate: 88, recentTrades: [{ pair: 'SOL/USDC', result: '+12%', profit: '$1.2K', date: '2h ago' }, { pair: 'ETH/USDC', result: '+8%', profit: '$890', date: '5h ago' }, { pair: 'BTC/USDC', result: '+15%', profit: '$2.1K', date: '1d ago' }, { pair: 'MATIC/USDC', result: '+6%', profit: '$420', date: '2d ago' }, { pair: 'AVAX/USDC', result: '-3%', profit: '-$180', date: '3d ago' }] },
  { id: 2, name: 'DeFiMaster', verified: true, bio: 'DeFi degen. Yield farming expert.', winRate: 82, totalProfit: '+$38.9K', followers: 892, avgReturn: '+142%', strategy: 'DeFi Yield', riskLevel: 'High', weekProfit: '+$2.8K', monthProfit: '+$9.7K', allTimeProfit: '+$38.9K', weekWinRate: 85, monthWinRate: 80, recentTrades: [{ pair: 'LINK/USDC', result: '+22%', profit: '$1.8K', date: '1h ago' }, { pair: 'UNI/USDC', result: '+9%', profit: '$670', date: '4h ago' }, { pair: 'AAVE/USDC', result: '+18%', profit: '$1.4K', date: '1d ago' }, { pair: 'CRV/USDC', result: '+11%', profit: '$780', date: '2d ago' }, { pair: 'SNX/USDC', result: '-5%', profit: '-$310', date: '3d ago' }] },
  { id: 3, name: 'CryptoNinja', verified: false, bio: 'Swing trader. Long-term holds only.', winRate: 79, totalProfit: '+$29.4K', followers: 634, avgReturn: '+118%', strategy: 'Long-term Hold', riskLevel: 'Low', weekProfit: '+$1.2K', monthProfit: '+$6.8K', allTimeProfit: '+$29.4K', weekWinRate: 75, monthWinRate: 78, recentTrades: [{ pair: 'MATIC/USDC', result: '+14%', profit: '$980', date: '3h ago' }, { pair: 'AVAX/USDC', result: '+11%', profit: '$720', date: '6h ago' }, { pair: 'DOT/USDC', result: '+7%', profit: '$450', date: '1d ago' }, { pair: 'ATOM/USDC', result: '+9%', profit: '$560', date: '2d ago' }, { pair: 'FTM/USDC', result: '-2%', profit: '-$120', date: '4d ago' }] },
  { id: 4, name: 'WhaleTracker', verified: true, bio: 'I follow the whales. They follow me.', winRate: 91, totalProfit: '+$67.8K', followers: 2103, avgReturn: '+189%', strategy: 'Whale Following', riskLevel: 'Medium', weekProfit: '+$5.4K', monthProfit: '+$18.2K', allTimeProfit: '+$67.8K', weekWinRate: 93, monthWinRate: 90, recentTrades: [{ pair: 'BNB/USDC', result: '+19%', profit: '$2.8K', date: '30m ago' }, { pair: 'ADA/USDC', result: '+13%', profit: '$1.1K', date: '2h ago' }, { pair: 'SOL/USDC', result: '+21%', profit: '$3.2K', date: '8h ago' }, { pair: 'ETH/USDC', result: '+16%', profit: '$2.4K', date: '1d ago' }, { pair: 'BTC/USDC', result: '+10%', profit: '$1.5K', date: '2d ago' }] },
  { id: 5, name: 'AlphaSeeker', verified: false, bio: 'Finding alpha in low caps.', winRate: 76, totalProfit: '+$22.1K', followers: 445, avgReturn: '+98%', strategy: 'Small Cap', riskLevel: 'High', weekProfit: '+$1.8K', monthProfit: '+$5.2K', allTimeProfit: '+$22.1K', weekWinRate: 72, monthWinRate: 74, recentTrades: [{ pair: 'FTM/USDC', result: '+16%', profit: '$890', date: '1h ago' }, { pair: 'NEAR/USDC', result: '+10%', profit: '$520', date: '5h ago' }, { pair: 'ATOM/USDC', result: '+8%', profit: '$380', date: '1d ago' }, { pair: 'INJ/USDC', result: '+25%', profit: '$1.4K', date: '2d ago' }, { pair: 'TIA/USDC', result: '-8%', profit: '-$420', date: '3d ago' }] },
  { id: 6, name: 'MoonHunter', verified: false, bio: 'Meme coin specialist. DYOR.', winRate: 85, totalProfit: '+$41.6K', followers: 978, avgReturn: '+210%', strategy: 'Meme Coins', riskLevel: 'Very High', weekProfit: '+$4.1K', monthProfit: '+$14.3K', allTimeProfit: '+$41.6K', weekWinRate: 88, monthWinRate: 84, recentTrades: [{ pair: 'PEPE/USDC', result: '+45%', profit: '$4.2K', date: '45m ago' }, { pair: 'BONK/USDC', result: '+32%', profit: '$2.8K', date: '3h ago' }, { pair: 'WIF/USDC', result: '+28%', profit: '$2.1K', date: '7h ago' }, { pair: 'FLOKI/USDC', result: '+18%', profit: '$1.3K', date: '1d ago' }, { pair: 'SHIB/USDC', result: '-12%', profit: '-$890', date: '2d ago' }] },
];

const TABS = ['Top Traders', 'Following', 'My Trades', 'Leaderboard'];

export default function SocialTradingPage() {
  const [activeTab, setActiveTab] = useState('Top Traders');
  const [followedTraders, setFollowedTraders] = useState<Record<number, CopySettings>>({});
  const [leaderboardFilter, setLeaderboardFilter] = useState('All Time');
  const [expandedTrader, setExpandedTrader] = useState<number | null>(null);
  const [copySettingsModal, setCopySettingsModal] = useState<number | null>(null);
  const [tempSettings, setTempSettings] = useState<CopySettings>({ maxPerTrade: 100, stopLoss: 10, takeProfit: 25 });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState<UserProfile>({ username: '', bio: '', strategy: 'Swing Trading', riskLevel: 'Medium' });

  useEffect(() => {
    const saved = localStorage.getItem('socialtrading_followed');
    if (saved) {
      try { setFollowedTraders(JSON.parse(saved)); } catch {}
    }
    const savedProfile = localStorage.getItem('socialtrading_profile');
    if (savedProfile) {
      try { setUserProfile(JSON.parse(savedProfile)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (Object.keys(followedTraders).length > 0) {
      localStorage.setItem('socialtrading_followed', JSON.stringify(followedTraders));
    } else {
      localStorage.removeItem('socialtrading_followed');
    }
  }, [followedTraders]);

  const openCopySettings = (id: number) => {
    const existing = followedTraders[id];
    setTempSettings(existing || { maxPerTrade: 100, stopLoss: 10, takeProfit: 25 });
    setCopySettingsModal(id);
  };

  const confirmCopy = (id: number) => {
    setFollowedTraders((prev) => ({ ...prev, [id]: { ...tempSettings } }));
    setCopySettingsModal(null);
  };

  const unfollowTrader = (id: number) => {
    setFollowedTraders((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveProfile = () => {
    if (!profileForm.username.trim()) return;
    setUserProfile(profileForm);
    localStorage.setItem('socialtrading_profile', JSON.stringify(profileForm));
    setShowProfileForm(false);
  };

  const deleteProfile = () => {
    setUserProfile(null);
    localStorage.removeItem('socialtrading_profile');
  };

  const getSortedTraders = () => {
    const sorted = [...TRADERS];
    if (leaderboardFilter === 'This Week') {
      sorted.sort((a, b) => b.weekWinRate - a.weekWinRate);
    } else if (leaderboardFilter === 'This Month') {
      sorted.sort((a, b) => b.monthWinRate - a.monthWinRate);
    } else {
      sorted.sort((a, b) => b.winRate - a.winRate);
    }
    return sorted;
  };

  const getDisplayProfit = (trader: Trader) => {
    if (leaderboardFilter === 'This Week') return trader.weekProfit;
    if (leaderboardFilter === 'This Month') return trader.monthProfit;
    return trader.allTimeProfit;
  };

  const getDisplayWinRate = (trader: Trader) => {
    if (leaderboardFilter === 'This Week') return trader.weekWinRate;
    if (leaderboardFilter === 'This Month') return trader.monthWinRate;
    return trader.winRate;
  };

  const followedTradersList = TRADERS.filter((t) => followedTraders[t.id]);

  const VerifiedBadge = () => (
    <Image src="/verified-badge.png" alt="Verified" width={14} height={14} className="inline-block" />
  );

  const TraderCard = ({ trader, showCopyButton = true }: { trader: Trader; showCopyButton?: boolean }) => {
    const isExpanded = expandedTrader === trader.id;
    const isFollowing = !!followedTraders[trader.id];

    return (
      <div className="glass rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <div
          className="p-4 cursor-pointer"
          onClick={() => setExpandedTrader(isExpanded ? null : trader.id)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold">{trader.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">{trader.name}</span>
                {trader.verified && <VerifiedBadge />}
                {isFollowing && <span className="text-[8px] bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded-full font-semibold">COPYING</span>}
              </div>
              <p className="text-[10px] text-gray-500 truncate">{trader.bio}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[9px] bg-[#111827] text-gray-400 px-1.5 py-0.5 rounded">{trader.strategy}</span>
                <span className="text-[9px] bg-[#111827] text-gray-400 px-1.5 py-0.5 rounded">{trader.riskLevel} Risk</span>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-xs font-bold text-[#10B981]">{trader.winRate}%</div>
              <div className="text-[9px] text-gray-500">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-[#10B981]">{trader.totalProfit}</div>
              <div className="text-[9px] text-gray-500">Profit</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold">{trader.followers.toLocaleString()}</div>
              <div className="text-[9px] text-gray-500">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-[#10B981]">{trader.avgReturn}</div>
              <div className="text-[9px] text-gray-500">Avg Return</div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-white/5 pt-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Full Trade History</div>
            <div className="space-y-1.5 mb-3">
              {trader.recentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] bg-[#111827]/50 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-medium">{trade.pair}</span>
                    {trade.date && <span className="text-gray-600">{trade.date}</span>}
                  </div>
                  <span className={`font-semibold ${trade.result.startsWith('+') ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {trade.result} ({trade.profit})
                  </span>
                </div>
              ))}
            </div>

            {isFollowing && followedTraders[trader.id] && (
              <div className="bg-[#111827]/50 rounded-lg p-3 mb-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Copy Settings
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-gray-500">Max/Trade</span>
                    <div className="text-white font-semibold">${followedTraders[trader.id].maxPerTrade}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Stop Loss</span>
                    <div className="text-[#EF4444] font-semibold">{followedTraders[trader.id].stopLoss}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Take Profit</span>
                    <div className="text-[#10B981] font-semibold">{followedTraders[trader.id].takeProfit}%</div>
                  </div>
                </div>
              </div>
            )}

            {showCopyButton && (
              <div className="flex gap-2">
                {isFollowing ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); openCopySettings(trader.id); }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#111827] text-gray-400 hover:bg-[#1F2937] transition-all flex items-center justify-center gap-1"
                    >
                      <Settings className="w-3 h-3" /> Edit Settings
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); unfollowTrader(trader.id); }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/20 transition-all"
                    >
                      Unfollow
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); openCopySettings(trader.id); }}
                    className="w-full py-2 rounded-lg text-xs font-semibold border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-all flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy Trades
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!isExpanded && showCopyButton && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isFollowing) {
                  unfollowTrader(trader.id);
                } else {
                  openCopySettings(trader.id);
                }
              }}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                isFollowing
                  ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                  : 'border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/10'
              }`}
            >
              {isFollowing ? (
                <span className="flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Copying Trades</span>
              ) : (
                <span className="flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Copy Trades</span>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-xl font-heading font-bold">Social Trading</h1>
        </div>
        <p className="text-gray-400 text-xs mb-4">Follow top traders, share insights, and copy winning strategies</p>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors relative ${
                activeTab === tab ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'
              }`}
            >
              {tab}
              {tab === 'Following' && Object.keys(followedTraders).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00E5FF] rounded-full text-[8px] flex items-center justify-center text-black font-bold">
                  {Object.keys(followedTraders).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'Top Traders' && (
          <div className="space-y-3">
            {TRADERS.map((trader) => (
              <TraderCard key={trader.id} trader={trader} />
            ))}
          </div>
        )}

        {activeTab === 'Following' && (
          <div>
            {followedTradersList.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-1">Not following anyone yet</p>
                <p className="text-gray-600 text-xs">Start copying top traders to see them here</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="glass rounded-xl p-3 border border-white/10 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Following</div>
                      <div className="text-lg font-bold">{followedTradersList.length} Trader{followedTradersList.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Win Rate</div>
                      <div className="text-lg font-bold text-[#10B981]">
                        {Math.round(followedTradersList.reduce((sum, t) => sum + t.winRate, 0) / followedTradersList.length)}%
                      </div>
                    </div>
                  </div>
                </div>
                {followedTradersList.map((trader) => (
                  <TraderCard key={trader.id} trader={trader} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'My Trades' && (
          <div>
            {userProfile ? (
              <div>
                <div className="glass rounded-xl p-4 border border-white/10 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF]/30 to-[#7C3AED]/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold">{userProfile.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{userProfile.username}</div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{userProfile.bio}</p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-[9px] bg-[#00E5FF]/10 text-[#00E5FF] px-1.5 py-0.5 rounded">{userProfile.strategy}</span>
                        <span className="text-[9px] bg-[#7C3AED]/10 text-[#7C3AED] px-1.5 py-0.5 rounded">{userProfile.riskLevel} Risk</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center bg-[#111827]/50 rounded-lg py-2">
                      <div className="text-xs font-bold">0</div>
                      <div className="text-[9px] text-gray-500">Trades</div>
                    </div>
                    <div className="text-center bg-[#111827]/50 rounded-lg py-2">
                      <div className="text-xs font-bold">0</div>
                      <div className="text-[9px] text-gray-500">Followers</div>
                    </div>
                    <div className="text-center bg-[#111827]/50 rounded-lg py-2">
                      <div className="text-xs font-bold text-gray-500">--</div>
                      <div className="text-[9px] text-gray-500">Win Rate</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setProfileForm(userProfile);
                        setShowProfileForm(true);
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#111827] text-gray-400 hover:bg-[#1F2937] transition-all"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={deleteProfile}
                      className="py-2 px-4 rounded-lg text-xs font-semibold bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-xs">No trades recorded yet</p>
                  <p className="text-gray-600 text-[10px]">Connect your wallet to start trading</p>
                </div>
              </div>
            ) : showProfileForm ? (
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold">Create Trading Profile</h3>
                  <button onClick={() => setShowProfileForm(false)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Username</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder="Your trader name"
                      className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Bio</label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Tell others about your trading style..."
                      rows={2}
                      className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Strategy</label>
                    <select
                      value={profileForm.strategy}
                      onChange={(e) => setProfileForm((p) => ({ ...p, strategy: e.target.value }))}
                      className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50"
                    >
                      <option value="Swing Trading">Swing Trading</option>
                      <option value="Day Trading">Day Trading</option>
                      <option value="Scalping">Scalping</option>
                      <option value="Long-term Hold">Long-term Hold</option>
                      <option value="DeFi Yield">DeFi Yield</option>
                      <option value="Meme Coins">Meme Coins</option>
                      <option value="Whale Following">Whale Following</option>
                      <option value="Small Cap">Small Cap</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Risk Level</label>
                    <select
                      value={profileForm.riskLevel}
                      onChange={(e) => setProfileForm((p) => ({ ...p, riskLevel: e.target.value }))}
                      className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Very High">Very High</option>
                    </select>
                  </div>
                  <button
                    onClick={saveProfile}
                    disabled={!profileForm.username.trim()}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-1">No trading profile yet</p>
                <p className="text-gray-600 text-xs mb-4">Create a profile to share your trades and build a following</p>
                <button
                  onClick={() => setShowProfileForm(true)}
                  className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white hover:opacity-90 transition-all"
                >
                  Create Profile
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Leaderboard' && (
          <div>
            <div className="flex gap-2 mb-4">
              {['All Time', 'This Month', 'This Week'].map((f) => (
                <button
                  key={f}
                  onClick={() => setLeaderboardFilter(f)}
                  className={`px-3 py-1 rounded text-[10px] font-semibold ${leaderboardFilter === f ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#111827] text-gray-500'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-white/10 text-[10px] text-gray-500 font-semibold">
                <span>#</span><span>Trader</span><span>Win Rate</span><span>Profit</span><span>Followers</span>
              </div>
              {getSortedTraders().map((trader, i) => (
                <div
                  key={trader.id}
                  onClick={() => setExpandedTrader(expandedTrader === trader.id ? null : trader.id)}
                  className="grid grid-cols-5 gap-2 px-3 py-2.5 border-b border-white/5 text-[11px] hover:bg-white/5 transition-colors items-center cursor-pointer"
                >
                  <span className={`font-bold ${i < 3 ? 'text-[#F59E0B]' : 'text-gray-500'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span className="font-semibold flex items-center gap-1 truncate">
                    {trader.name}
                    {trader.verified && <VerifiedBadge />}
                  </span>
                  <span className="text-[#10B981] font-semibold">{getDisplayWinRate(trader)}%</span>
                  <span className="text-[#10B981]">{getDisplayProfit(trader)}</span>
                  <span className="text-gray-400">{trader.followers.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {copySettingsModal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setCopySettingsModal(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">Copy Trade Settings</h3>
              <button onClick={() => setCopySettingsModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mb-4">Configure allocation settings for copying {TRADERS.find((t) => t.id === copySettingsModal)?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Max Per Trade ($)</label>
                <input
                  type="number"
                  value={tempSettings.maxPerTrade}
                  onChange={(e) => setTempSettings((s) => ({ ...s, maxPerTrade: Number(e.target.value) }))}
                  className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50"
                />
                <p className="text-[9px] text-gray-600 mt-0.5">Maximum amount allocated per copied trade</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Stop Loss (%)</label>
                <input
                  type="number"
                  value={tempSettings.stopLoss}
                  onChange={(e) => setTempSettings((s) => ({ ...s, stopLoss: Number(e.target.value) }))}
                  className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50"
                />
                <p className="text-[9px] text-gray-600 mt-0.5">Auto-sell if trade drops by this percentage</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Take Profit (%)</label>
                <input
                  type="number"
                  value={tempSettings.takeProfit}
                  onChange={(e) => setTempSettings((s) => ({ ...s, takeProfit: Number(e.target.value) }))}
                  className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50"
                />
                <p className="text-[9px] text-gray-600 mt-0.5">Auto-sell if trade gains by this percentage</p>
              </div>
              <button
                onClick={() => confirmCopy(copySettingsModal)}
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white hover:opacity-90 transition-all"
              >
                {followedTraders[copySettingsModal] ? 'Update Settings' : 'Start Copying'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}