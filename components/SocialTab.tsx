'use client';

import { Users, Copy, Signal, UserCheck, Trophy, Shield, BarChart3 } from 'lucide-react';

const PLANNED_FEATURES = [
  { icon: Copy, title: 'Copy Trading', desc: 'Mirror top traders automatically with custom risk limits', color: '#00D4AA' },
  { icon: Signal, title: 'Signal Sharing', desc: 'Share & receive trading signals from the community', color: '#6366F1' },
  { icon: UserCheck, title: 'Trader Profiles', desc: 'On-chain verified performance stats & reputation', color: '#10B981' },
  { icon: Trophy, title: 'Leaderboards', desc: 'Compete for top ranks and earn badges & rewards', color: '#F59E0B' },
  { icon: Shield, title: 'Risk Controls', desc: 'Auto stop-loss, max allocation, and drawdown limits', color: '#EF4444' },
  { icon: BarChart3, title: 'Analytics', desc: 'Deep performance metrics on every trader', color: '#06B6D4' },
];

export default function SocialTab() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-[#00D4AA]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Social Trading</h2>
          <p className="text-[10px] text-gray-400">Signals from top traders</p>
        </div>
      </div>

      <div className="relative glass rounded-2xl border border-white/10 overflow-hidden mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D4AA]/5 via-transparent to-[#6366F1]/5" />
        <div className="relative p-6 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/10">
            <Users className="w-6 h-6 text-[#00D4AA]" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-[#00D4AA]/20 to-[#6366F1]/20 rounded-full border border-[#00D4AA]/30 mb-3">
            <div className="w-1.5 h-1.5 bg-[#00D4AA] rounded-full animate-pulse" />
            <span className="text-[10px] font-semibold text-[#00D4AA]">Coming Soon</span>
          </div>
          <h3 className="text-sm font-bold mb-2 bg-gradient-to-r from-[#00D4AA] to-[#6366F1] bg-clip-text text-transparent">
            Social Trading is Coming
          </h3>
          <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
            Copy top traders, share signals, compete on leaderboards, and build your on-chain trading reputation.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {PLANNED_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="glass rounded-xl p-3 border border-white/10 flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${feature.color}15`, border: `1px solid ${feature.color}30` }}
            >
              <feature.icon className="w-4 h-4" style={{ color: feature.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{feature.title}</div>
              <div className="text-[10px] text-gray-400">{feature.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 glass rounded-xl p-4 border border-white/10 text-center">
        <div className="text-xs text-gray-500">
          Launching <span className="text-[#00D4AA] font-semibold">Q3 2025</span> for private beta members
        </div>
      </div>
    </div>
  );
}
