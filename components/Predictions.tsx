'use client';

import { useState } from 'react';

interface Prediction {
  id: number;
  chain: string;
  question: string;
  yesPercent: number;
  noPercent: number;
  volume: string;
  currentPrice: string;
  target: string;
  timeLeft: string;
  status: 'active' | 'resolved';
}

export default function Predictions() {
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());

  const [predictions, setPredictions] = useState<Prediction[]>([
    {
      id: 1,
      chain: 'SOL',
      question: 'Will SOL reach $200 in 7 days?',
      yesPercent: 67,
      noPercent: 33,
      volume: '$1.2M',
      currentPrice: '$178.42',
      target: '$200',
      timeLeft: '6d 23h',
      status: 'active',
    },
    {
      id: 2,
      chain: 'BTC',
      question: 'Will BTC break $100K this week?',
      yesPercent: 78,
      noPercent: 22,
      volume: '$3.8M',
      currentPrice: '$97,245',
      target: '$100,000',
      timeLeft: '4d 12h',
      status: 'active',
    },
    {
      id: 3,
      chain: 'ETH',
      question: 'Will ETH flip $4K before March?',
      yesPercent: 45,
      noPercent: 55,
      volume: '$890K',
      currentPrice: '$3,412',
      target: '$4,000',
      timeLeft: '12d 8h',
      status: 'active',
    },
    {
      id: 4,
      chain: 'DOGE',
      question: 'Will DOGE hit $0.50 this month?',
      yesPercent: 31,
      noPercent: 69,
      volume: '$420K',
      currentPrice: '$0.32',
      target: '$0.50',
      timeLeft: '18d 5h',
      status: 'active',
    },
  ]);

  const handleVote = (id: number, voteYes: boolean) => {
    setVotedIds((prev) => new Set(prev).add(id));
    setPredictions((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const shift = voteYes ? 2 : -2;
        const newYes = Math.min(99, Math.max(1, p.yesPercent + shift));
        return { ...p, yesPercent: newYes, noPercent: 100 - newYes };
      })
    );
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-xl font-bold text-white">24</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Active</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-xl font-bold text-white">$8.4M</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Total Volume</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-xl font-bold text-white">156</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Resolved</div>
        </div>
      </div>

      <div className="space-y-3">
        {predictions.map((p) => (
          <div key={p.id} className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded text-[10px] font-semibold">{p.chain}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                <span className="text-gray-500 text-[10px]">{p.timeLeft}</span>
              </div>
            </div>

            <h3 className="text-sm font-bold mb-3">{p.question}</h3>

            <div className="space-y-2 mb-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#10B981] font-semibold">Yes</span>
                  <span className="text-[#10B981] font-semibold">{p.yesPercent}%</span>
                </div>
                <div className="w-full bg-[#111827] rounded-full h-2">
                  <div className="bg-[#10B981] h-2 rounded-full transition-all" style={{ width: `${p.yesPercent}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#EF4444] font-semibold">No</span>
                  <span className="text-[#EF4444] font-semibold">{p.noPercent}%</span>
                </div>
                <div className="w-full bg-[#111827] rounded-full h-2">
                  <div className="bg-[#EF4444] h-2 rounded-full transition-all" style={{ width: `${p.noPercent}%` }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-3">
              <span>💰 Volume: {p.volume}</span>
              <span>·</span>
              <span>📊 Current: {p.currentPrice}</span>
              <span>|</span>
              <span>Target: {p.target}</span>
            </div>

            {votedIds.has(p.id) ? (
              <div className="text-center text-xs text-[#00E5FF] font-semibold py-2">
                Vote recorded! Results update live.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleVote(p.id, true)}
                  className="py-2 rounded-lg border border-[#10B981]/30 text-[#10B981] text-xs font-semibold hover:bg-[#10B981]/10 transition-colors"
                >
                  Vote Yes
                </button>
                <button
                  onClick={() => handleVote(p.id, false)}
                  className="py-2 rounded-lg border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors"
                >
                  Vote No
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
