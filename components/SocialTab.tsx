'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, TrendingUp, Award, ExternalLink, Heart, MessageCircle, Share2, Eye } from 'lucide-react';

interface TrendingSignal {
  user: string;
  avatar: string;
  token: string;
  sentiment: 'bullish' | 'bearish';
  message: string;
  likes: number;
  replies: number;
  time: string;
  accuracy: number;
}

export default function SocialTab() {
  const [activeSection, setActiveSection] = useState<'feed' | 'leaderboard'>('feed');
  const [signals, setSignals] = useState<TrendingSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mockSignals: TrendingSignal[] = [
      { user: 'whale_alpha', avatar: 'W', token: 'ETH', sentiment: 'bullish', message: 'ETH breaking resistance at $3,800. On-chain metrics showing strong accumulation by institutions. Next target $4,200.', likes: 342, replies: 89, time: '15m ago', accuracy: 87 },
      { user: 'defi_sage', avatar: 'D', token: 'SOL', sentiment: 'bullish', message: 'Solana TVL just hit new ATH. DEX volumes surging 40% week over week. The ecosystem is cooking.', likes: 218, replies: 45, time: '32m ago', accuracy: 82 },
      { user: 'chain_detective', avatar: 'C', token: 'PEPE', sentiment: 'bearish', message: 'Top 10 PEPE holders started distributing. On-chain shows 3 wallets moved 2T tokens to exchanges in last 4 hours.', likes: 567, replies: 156, time: '1h ago', accuracy: 91 },
      { user: 'smart_money_tracker', avatar: 'S', token: 'LINK', sentiment: 'bullish', message: 'Chainlink whale wallets accumulated $12M in LINK this week. CCIP adoption metrics looking strong.', likes: 189, replies: 34, time: '2h ago', accuracy: 79 },
      { user: 'nft_alpha_hunter', avatar: 'N', token: 'ARB', sentiment: 'bullish', message: 'Arbitrum on-chain activity hitting records. Gas fees staying low while volume goes parabolic. L2 rotation incoming.', likes: 145, replies: 28, time: '3h ago', accuracy: 74 },
    ];
    setSignals(mockSignals);
    setLoading(false);
  }, []);

  const leaderboard = [
    { rank: 1, user: 'chain_detective', accuracy: 91, trades: 245, pnl: '+$142K', streak: 12 },
    { rank: 2, user: 'whale_alpha', accuracy: 87, trades: 189, pnl: '+$98K', streak: 8 },
    { rank: 3, user: 'defi_sage', accuracy: 82, trades: 312, pnl: '+$76K', streak: 5 },
    { rank: 4, user: 'smart_money_tracker', accuracy: 79, trades: 167, pnl: '+$54K', streak: 3 },
    { rank: 5, user: 'nft_alpha_hunter', accuracy: 74, trades: 98, pnl: '+$31K', streak: 2 },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Social Trading</h2>
          <p className="text-[10px] text-gray-400">Signals from top traders</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-[#111827] p-1 rounded-xl">
        {['feed', 'leaderboard'].map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section as any)}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs capitalize ${
              activeSection === section
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {section === 'feed' ? 'Signal Feed' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {activeSection === 'feed' ? (
        <div className="space-y-3">
          {signals.map((signal, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  {signal.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold">@{signal.user}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#10B981]/20 text-[#10B981]">{signal.accuracy}% acc</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${signal.sentiment === 'bullish' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                      {signal.sentiment.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-auto">{signal.time}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#00E5FF] mb-1">${signal.token}</div>
                  <p className="text-xs text-gray-300 leading-relaxed mb-3">{signal.message}</p>
                  <div className="flex items-center gap-5 text-xs text-gray-500">
                    <button className="flex items-center gap-1.5 hover:text-[#EF4444] transition-colors">
                      <Heart className="w-3.5 h-3.5" /> {signal.likes}
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#00E5FF] transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> {signal.replies}
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7C3AED] transition-colors">
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((trader) => (
            <div key={trader.rank} className="glass rounded-xl p-4 border border-white/10 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                trader.rank === 1 ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                trader.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                trader.rank === 3 ? 'bg-[#CD7F32]/20 text-[#CD7F32]' :
                'bg-white/10 text-gray-400'
              }`}>
                #{trader.rank}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold">@{trader.user}</div>
                <div className="text-[10px] text-gray-500">{trader.trades} trades | {trader.streak} win streak</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[#10B981]">{trader.pnl}</div>
                <div className="text-[10px] text-gray-400">{trader.accuracy}% accuracy</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
