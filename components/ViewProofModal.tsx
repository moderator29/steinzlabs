'use client';

import { X, ExternalLink, CheckCircle, AlertTriangle, ThumbsUp, ThumbsDown, Eye, MessageSquare, Link2, Heart } from 'lucide-react';
import { useState } from 'react';

interface ViewProofEvent {
  id: string;
  title: string;
  summary: string;
  from: string;
  to: string;
  value: number;
  valueUsd: number;
  chain: string;
  trustScore: number;
  txHash: string;
  timestamp: string;
  sentiment: string;
  views: number;
  comments: number;
  shares: number;
  likes: number;
}

interface ViewProofModalProps {
  event: ViewProofEvent;
  onClose: () => void;
}

export default function ViewProofModal({ event, onClose }: ViewProofModalProps) {
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);
  const [yesVotes] = useState(847);
  const [noVotes] = useState(156);
  const totalVotes = yesVotes + noVotes;
  const yesPct = Math.round((yesVotes / totalVotes) * 100);

  const trustColor = event.trustScore >= 70 ? '#10B981' : event.trustScore >= 40 ? '#F59E0B' : '#EF4444';
  const trustLabel = event.trustScore >= 70 ? 'TRUSTED' : event.trustScore >= 40 ? 'CAUTION' : 'DANGER';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#0A0E1A] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0A0E1A] border-b border-white/10 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">On-Chain Proof Analysis</h2>
              <p className="text-[10px] text-gray-500">Verified by Steinz AI Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-sm flex-1">{event.title}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ml-2 flex-shrink-0`} style={{ backgroundColor: `${trustColor}20`, color: trustColor }}>
                VERIFIED
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{event.summary}</p>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Price & Volume History</h3>
              <div className="flex gap-1">
                {['1H', '4H', '1D', '1W'].map((tf) => (
                  <button key={tf} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tf === '1D' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-gray-500 hover:text-gray-300'}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-40 bg-[#111827] rounded-lg flex items-end p-3 gap-0.5 relative">
              <div className="absolute top-2 left-3 text-[9px] text-gray-600 font-mono">TV</div>
              {[40, 55, 60, 65, 70, 68, 75, 80, 78, 72, 65, 58, 52, 45, 38, 30, 25, 20, 15, 10].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[#00E5FF]/30 to-[#00E5FF]/60 rounded-t-sm transition-all" style={{ height: `${h}%` }}></div>
              ))}
              <div className="absolute bottom-2 left-3 text-[9px] text-gray-600">Feb</div>
              <div className="absolute bottom-2 left-1/4 text-[9px] text-gray-600">12</div>
              <div className="absolute bottom-2 left-1/2 text-[9px] text-gray-600">23</div>
              <div className="absolute bottom-2 right-3 px-1.5 py-0.5 bg-[#EF4444] rounded text-[9px] font-mono">0.00</div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: trustColor }} className="text-lg">✅</span>
              <h3 className="font-bold text-sm">Trust Score</h3>
            </div>
            <div className="flex items-center justify-center mb-2">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={trustColor} strokeWidth="8" strokeDasharray={`${event.trustScore * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: trustColor }}>{event.trustScore}%</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <span className="text-sm font-bold" style={{ color: trustColor }}>{trustLabel}</span>
              <p className="text-[10px] text-gray-500 mt-0.5">Based on 1,245 similar signals</p>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-2">Investment Status</h3>
            <div className="text-[#10B981] font-semibold text-sm mb-1">High Potential</div>
            <p className="text-xs text-gray-400">Low Volatility — Favorable Risk/Reward</p>
            <p className="text-xs text-gray-300 mt-1">Entry: $0.0045 – $0.0052</p>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-3">Historical Success Rate</h3>
            <div className="space-y-3">
              {[
                { label: 'Similar Whale Signals', pct: 82, color: '#00E5FF' },
                { label: 'Same Token Category', pct: 71, color: '#7C3AED' },
                { label: 'Volume Spike Signals', pct: 88, color: '#10B981' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>{item.pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="font-bold text-sm">Risk & Benefits Assessment</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="text-xs font-semibold text-[#10B981] mb-2">BENEFITS</h4>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  <li>+ Strong whale accumulation</li>
                  <li>+ Rising volume trend</li>
                  <li>+ Verified smart contract</li>
                  <li>+ Active development team</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#EF4444] mb-2">RISKS</h4>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  <li>– Low total liquidity</li>
                  <li>– New token (under 30d)</li>
                  <li>– Concentrated holders</li>
                </ul>
              </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-white/10">
              {[
                { label: 'Volatility', pct: 25, color: '#F59E0B' },
                { label: 'Liquidity Risk', pct: 15, color: '#10B981' },
                { label: 'Rug Risk', pct: 8, color: '#10B981' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{r.label}</span>
                    <span className="font-semibold">{r.pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${r.pct}%`, backgroundColor: r.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-3">Blockchain Verification</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Tx Hash</div>
                <div className="text-xs font-mono">{event.txHash.slice(0, 8)}...{event.txHash.slice(-4)}</div>
              </div>
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Block</div>
                <div className="text-xs font-mono">19,451,823</div>
              </div>
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Timestamp</div>
                <div className="text-xs font-mono">2 hours ago</div>
              </div>
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Volume 24h</div>
                <div className="text-xs font-mono">${(event.valueUsd / 1000000).toFixed(1)}M</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['DEX aggregator confirmed', 'Whale activity verified', 'Smart contract audited', 'Regulatory check passed'].map((badge) => (
                <span key={badge} className="flex items-center gap-1 px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg text-[10px] text-[#10B981]">
                  <CheckCircle className="w-3 h-3" /> {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">Go With This Signal?</h3>
              <span className="text-xs text-gray-500">{totalVotes.toLocaleString()} votes</span>
            </div>
            <p className="text-[10px] text-gray-500 mb-3">Your feedback improves our AI accuracy</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setVoted('yes')}
                className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'yes' ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'border border-white/10 text-[#10B981] hover:bg-[#10B981]/10'}`}
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Yes, Go!
              </button>
              <button
                onClick={() => setVoted('no')}
                className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'no' ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'border border-white/10 text-[#EF4444] hover:bg-[#EF4444]/10'}`}
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Skip This
              </button>
            </div>
            <div className="flex rounded-full h-2 overflow-hidden">
              <div className="bg-[#10B981]" style={{ width: `${yesPct}%` }}></div>
              <div className="bg-[#EF4444]" style={{ width: `${100 - yesPct}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-[#10B981]">{yesPct}% Bullish ({yesVotes})</span>
              <span className="text-[#EF4444]">{100 - yesPct}% Bearish ({noVotes})</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 glass px-4 py-3 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">
              Close
            </button>
            <button className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-3 rounded-lg text-sm font-semibold hover:scale-[1.02] transition-transform flex items-center justify-center gap-1">
              Add to Watchlist →
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500 pb-2">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(event.views ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {(event.comments ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> {(event.shares ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {(event.likes ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
