'use client';

import { useState } from 'react';
import { Target, ArrowLeft, Clock, Users, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Prediction {
  id: number;
  category: string;
  question: string;
  poolSize: string;
  poolNum: number;
  yesPercent: number;
  yesAmount: string;
  noAmount: string;
  closesIn: string;
  voters: number;
  creator: string;
  resolver: string;
  resolved?: boolean;
  yesWon?: boolean;
}

const PREDICTIONS: Prediction[] = [
  { id: 1, category: 'Price Prediction', question: 'Will SOL hit $200 by March 1?', poolSize: '$12.4K', poolNum: 12400, yesPercent: 67, yesAmount: '$8,342', noAmount: '$4,108', closesIn: '4d 18h', voters: 847, creator: '0x7a2d...9f4e', resolver: 'Chainlink Oracle' },
  { id: 2, category: 'Event', question: 'Will ETH gas fees drop below 10 gwei this week?', poolSize: '$8.2K', poolNum: 8200, yesPercent: 45, yesAmount: '$3,690', noAmount: '$4,510', closesIn: '2d 6h', voters: 523, creator: '0x3c8b...2a1f', resolver: 'Chainlink Oracle' },
  { id: 3, category: 'Price Prediction', question: 'Will Bitcoin break $100K in Q1 2025?', poolSize: '$45.9K', poolNum: 45900, yesPercent: 78, yesAmount: '$35,802', noAmount: '$10,098', closesIn: '28d 14h', voters: 2341, creator: '0x9e4f...7c3d', resolver: 'CoinGecko API' },
  { id: 4, category: 'Launch', question: 'Will Uniswap V4 launch before April?', poolSize: '$5.1K', poolNum: 5100, yesPercent: 34, yesAmount: '$1,734', noAmount: '$3,366', closesIn: '15d 8h', voters: 312, creator: '0x1b5a...3e2c', resolver: 'Chainlink Oracle' },
  { id: 5, category: 'Milestone', question: 'Will total crypto market cap hit $4T in 2025?', poolSize: '$23.7K', poolNum: 23700, yesPercent: 61, yesAmount: '$14,457', noAmount: '$9,243', closesIn: '45d 2h', voters: 1567, creator: '0x4d7e...8f1a', resolver: 'CoinGecko API' },
  { id: 6, category: 'Price Prediction', question: 'Will PEPE reach $0.01 by EOY?', poolSize: '$15.3K', poolNum: 15300, yesPercent: 12, yesAmount: '$1,836', noAmount: '$13,464', closesIn: '89d 16h', voters: 891, creator: '0x6a3c...5d9b', resolver: 'Chainlink Oracle' },
];

const FILTERS = ['All', 'Active', 'Resolving', 'Resolved', 'My Votes'];
const CATEGORY_COLORS: Record<string, string> = {
  'Price Prediction': 'bg-[#7C3AED]/20 text-[#7C3AED]',
  Event: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  Launch: 'bg-[#00E5FF]/20 text-[#00E5FF]',
  Milestone: 'bg-[#10B981]/20 text-[#10B981]',
};

export default function PredictionsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [votes, setVotes] = useState<Record<number, { side: 'yes' | 'no'; amount: number }>>({});
  const [voteAmounts, setVoteAmounts] = useState<Record<number, string>>({});

  const handleVote = (id: number, side: 'yes' | 'no') => {
    const amount = parseInt(voteAmounts[id] || '0');
    if (amount < 10) return;
    setVotes((prev) => ({ ...prev, [id]: { side, amount } }));
  };

  const calcPayout = (pred: Prediction, side: 'yes' | 'no', amount: number) => {
    if (!amount || amount < 10) return '—';
    const sideTotal = side === 'yes' ? pred.poolNum * (pred.yesPercent / 100) : pred.poolNum * ((100 - pred.yesPercent) / 100);
    const payout = (amount * pred.poolNum) / sideTotal;
    return `$${payout.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Target className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-xl font-heading font-bold">Predictions Market</h1>
        </div>
        <p className="text-gray-400 text-xs mb-4">Vote on price predictions with crypto. Winners earn rewards.</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass rounded-lg p-3 text-center border border-white/10">
            <div className="text-lg font-bold">24</div>
            <div className="text-[10px] text-gray-400">Active</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border border-white/10">
            <div className="text-lg font-bold">$847K</div>
            <div className="text-[10px] text-gray-400">Total Volume</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border border-white/10">
            <div className="text-lg font-bold text-gray-500">$0</div>
            <div className="text-[10px] text-gray-400">Your Winnings</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeFilter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="glass rounded-xl p-3 border border-[#00E5FF]/20 mb-4 bg-gradient-to-r from-[#00E5FF]/5 to-transparent">
          <div className="text-[10px] font-bold text-[#00E5FF] mb-1">How It Works</div>
          <div className="text-[10px] text-gray-400 leading-relaxed">
            Choose a prediction → Vote YES or NO with crypto ($10 min) → Winners split the pool. Platform takes 3% fee.
          </div>
        </div>

        <div className="space-y-3">
          {PREDICTIONS.map((pred) => {
            const noPercent = 100 - pred.yesPercent;
            const voted = votes[pred.id];
            const inputAmount = parseInt(voteAmounts[pred.id] || '0');
            return (
              <div key={pred.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_COLORS[pred.category] || 'bg-gray-500/20 text-gray-400'}`}>
                    {pred.category}
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {pred.closesIn}
                  </span>
                </div>

                <h3 className="text-sm font-bold mb-2">{pred.question}</h3>
                <div className="text-xs text-gray-400 mb-3">{pred.poolSize} in pool</div>

                <div className="flex rounded-full h-7 overflow-hidden mb-2">
                  <div className="bg-[#10B981] flex items-center justify-center text-[10px] font-bold" style={{ width: `${pred.yesPercent}%` }}>
                    {pred.yesPercent > 15 && `YES ${pred.yesPercent}%`}
                  </div>
                  <div className="bg-[#EF4444] flex items-center justify-center text-[10px] font-bold" style={{ width: `${noPercent}%` }}>
                    {noPercent > 15 && `NO ${noPercent}%`}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-3">
                  <span>YES: {pred.yesAmount}</span>
                  <span>NO: {pred.noAmount}</span>
                </div>

                {voted ? (
                  <div className={`text-center py-2 rounded-lg text-xs font-semibold ${voted.side === 'yes' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                    You voted {voted.side.toUpperCase()} — ${voted.amount}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5">
                        <input
                          type="number"
                          min="10"
                          value={voteAmounts[pred.id] || ''}
                          onChange={(e) => setVoteAmounts((prev) => ({ ...prev, [pred.id]: e.target.value }))}
                          placeholder="$10 min"
                          className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-600 font-mono"
                        />
                      </div>
                      {inputAmount >= 10 && (
                        <div className="text-[10px] text-gray-400 whitespace-nowrap">
                          Win: {calcPayout(pred, 'yes', inputAmount)}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleVote(pred.id, 'yes')}
                        className="py-2 rounded-lg border border-[#10B981]/30 text-[#10B981] text-xs font-semibold hover:bg-[#10B981]/10 transition-colors"
                      >
                        Vote YES
                      </button>
                      <button
                        onClick={() => handleVote(pred.id, 'no')}
                        className="py-2 rounded-lg border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors"
                      >
                        Vote NO
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-600">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {pred.voters} voters</span>
                  <span>Created: {pred.creator}</span>
                  <span>Verified: {pred.resolver}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
