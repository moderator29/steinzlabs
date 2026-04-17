'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Prediction {
  id: string;
  category: string;
  question: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string;
  chain: string;
  currentPrice: number;
  closeDate: string;
  totalPool: number;
  yesPool: number;
  noPool: number;
  yesPercent: number;
  noPercent: number;
  totalPredictors: number;
  status: string;
  priceChange24h: number;
}

interface Stats {
  activePredictions: number;
  totalPoolVolume: number;
  resolvedCount: number;
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function CountdownText({ closeDate }: { closeDate: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(closeDate).getTime() - Date.now();
      if (diff <= 0) { setText('Closed'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setText(`${d}d ${h}h`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [closeDate]);
  return <span className="text-yellow-400">{text}</span>;
}

export default function Predictions() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<Stats>({ activePredictions: 0, totalPoolVolume: 0, resolvedCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions?tab=all&sort=pool');
      const data = await res.json();
      if (data.predictions) setPredictions(data.predictions.slice(0, 10));
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('[Predictions] Fetch predictions failed:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);
  useEffect(() => {
    const i = setInterval(fetchPredictions, 30000);
    return () => clearInterval(i);
  }, [fetchPredictions]);

  const handleVote = (predictionId: string, vote: 'yes' | 'no') => {
    window.location.href = '/dashboard/predictions';
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative w-10 h-10 mx-auto mb-3">
          <div className="absolute inset-0 rounded-full border-2 border-[#FF6B35]/40 border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-[#FFD700] border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
        <p className="text-sm text-gray-400">Loading predictions...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#0A1EFF]">{stats.activePredictions}</div>
          <div className="text-xs text-gray-400 mt-1">Active</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#0A1EFF]">{formatUsd(stats.totalPoolVolume)}</div>
          <div className="text-xs text-gray-400 mt-1">Volume</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#0A1EFF]">{stats.resolvedCount}</div>
          <div className="text-xs text-gray-400 mt-1">Resolved</div>
        </div>
      </div>

      {predictions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">&#x1F3AF;</div>
          <p className="text-lg mb-1 font-semibold">No Active Predictions</p>
          <p className="text-sm">Check back soon for new markets</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {predictions.slice(0, 5).map((pred) => {
              const catColors: Record<string, string> = {
                market_cap: 'bg-[#7C3AED]/20 text-[#7C3AED]',
                price: 'bg-[#FF6B35]/20 text-[#FF6B35]',
                volume: 'bg-[#0A1EFF]/20 text-[#0A1EFF]',
                launch: 'bg-[#10B981]/20 text-[#10B981]',
                holder: 'bg-[#F59E0B]/20 text-[#F59E0B]',
              };
              return (
                <div key={pred.id} className="glass rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${catColors[pred.category] || 'bg-gray-500/20 text-gray-400'}`}>
                      {pred.category.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase">{pred.chain}</span>
                  </div>

                  <h3 className="text-sm font-bold mb-2">{pred.question}</h3>

                  <div className="flex items-center gap-2 mb-3 text-[11px]">
                    <CountdownText closeDate={pred.closeDate} />
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">Pool: {formatUsd(pred.totalPool)}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">{pred.totalPredictors} predictors</span>
                  </div>

                  <div className="flex rounded-full h-5 overflow-hidden mb-2">
                    <div
                      className="bg-[#10B981] flex items-center justify-center text-[10px] font-bold transition-all"
                      style={{ width: `${pred.yesPercent}%` }}
                    >
                      {pred.yesPercent > 15 && `YES ${pred.yesPercent}%`}
                    </div>
                    <div
                      className="bg-[#EF4444] flex items-center justify-center text-[10px] font-bold transition-all"
                      style={{ width: `${pred.noPercent}%` }}
                    >
                      {pred.noPercent > 15 && `NO ${pred.noPercent}%`}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => handleVote(pred.id, 'yes')}
                      className="py-2 border border-[#10B981]/30 text-[#10B981] rounded-lg text-xs font-semibold hover:bg-[#10B981]/10 transition-colors"
                    >
                      Predict YES
                    </button>
                    <button
                      onClick={() => handleVote(pred.id, 'no')}
                      className="py-2 border border-[#EF4444]/30 text-[#EF4444] rounded-lg text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors"
                    >
                      Predict NO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/dashboard/predictions"
            className="block text-center mt-4 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF6B35] to-[#FFD700] text-white shadow-lg hover:shadow-xl transition-all"
          >
            View All Predictions →
          </Link>
        </>
      )}
    </div>
  );
}
