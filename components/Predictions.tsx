'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Predictions() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'active')
      .order('close_date', { ascending: true })
      .limit(20);

    if (data) setPredictions(data);
    setLoading(false);
  };

  const handleVote = async (predictionId: string, vote: 'yes' | 'no', amount: number) => {
    alert(`Voted ${vote} with $${amount} on prediction ${predictionId}`);
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Loading predictions...</div>;
  }

  if (predictions.length === 0) {
    return (
      <div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-2xl font-bold text-[#00E5FF]">0</div>
            <div className="text-xs text-gray-400 mt-1">Active</div>
          </div>
          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-2xl font-bold text-[#00E5FF]">$0</div>
            <div className="text-xs text-gray-400 mt-1">Volume</div>
          </div>
          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-2xl font-bold text-[#00E5FF]">0</div>
            <div className="text-xs text-gray-400 mt-1">Resolved</div>
          </div>
        </div>
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">&#x1F3AF;</div>
          <p className="text-lg mb-1 font-semibold">No Active Predictions</p>
          <p className="text-sm">Check back soon for new markets</p>
        </div>
      </div>
    );
  }

  const totalPool = predictions.reduce((sum, p) => sum + parseFloat(p.total_pool || '0'), 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#00E5FF]">{predictions.length}</div>
          <div className="text-xs text-gray-400 mt-1">Active</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#00E5FF]">${totalPool.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Volume</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-[#00E5FF]">0</div>
          <div className="text-xs text-gray-400 mt-1">Resolved</div>
        </div>
      </div>

      <div className="space-y-4">
        {predictions.map((pred) => {
          const yesPercent = pred.total_pool > 0
            ? (pred.yes_pool / pred.total_pool * 100).toFixed(0)
            : '50';
          const noPercent = 100 - parseInt(yesPercent);

          const closeDate = new Date(pred.close_date);
          const now = new Date();
          const timeLeft = closeDate.getTime() - now.getTime();
          const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
          const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          return (
            <div key={pred.id} className="glass rounded-2xl p-5 border border-white/10">
              <div className="mb-3">
                <span className="px-3 py-1 bg-[#7C3AED]/20 text-[#7C3AED] rounded-full text-xs font-semibold">
                  {pred.category}
                </span>
              </div>

              <h3 className="text-lg font-bold mb-2">{pred.question}</h3>

              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-yellow-400">Closes in {daysLeft}d {hoursLeft}h</span>
                <span className="text-gray-400">&#x2022;</span>
                <span className="text-gray-400">Pool: ${parseFloat(pred.total_pool || '0').toLocaleString()}</span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-[#10B981]">YES {yesPercent}%</span>
                  <span className="text-[#EF4444]">NO {noPercent}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-8 flex overflow-hidden">
                  <div
                    className="bg-[#10B981] flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${yesPercent}%` }}
                  >
                    {parseInt(yesPercent) > 20 && `${yesPercent}%`}
                  </div>
                  <div
                    className="bg-[#EF4444] flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${noPercent}%` }}
                  >
                    {noPercent > 20 && `${noPercent}%`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote(pred.id, 'yes', 100)}
                  className="px-4 py-2 border-2 border-[#10B981] text-[#10B981] rounded-lg font-semibold hover:bg-[#10B981]/10 transition-colors"
                >
                  Vote YES
                </button>
                <button
                  onClick={() => handleVote(pred.id, 'no', 100)}
                  className="px-4 py-2 border-2 border-[#EF4444] text-[#EF4444] rounded-lg font-semibold hover:bg-[#EF4444]/10 transition-colors"
                >
                  Vote NO
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                {pred.yes_votes + pred.no_votes} voters
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
