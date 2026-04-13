import { TrendingUp, Star, Fish, Crown, Zap } from 'lucide-react';

const ARCHETYPES = [
  { name: 'DIAMOND HANDS', color: '#F59E0B', desc: 'Holds long-term with high conviction. Patient accumulator.' },
  { name: 'SCALPER', color: '#0A1EFF', desc: 'High-frequency, short-term trader. Volume and momentum driven.' },
  { name: 'DEGEN', color: '#EF4444', desc: 'High risk appetite, early-stage token focus, large swings.' },
  { name: 'WHALE FOLLOWER', color: '#8B5CF6', desc: 'Mirrors large wallet entries shortly after they execute.' },
  { name: 'HOLDER', color: '#10B981', desc: 'Moderate-frequency, medium-term positions (7+ day holds).' },
];

const WHALE_TIERS = [
  { tier: 'MEGA', color: '#F59E0B', threshold: '$10M+ volume (7d)', desc: 'Top institutional-grade wallets. Moves by MEGA whales often precede significant market shifts.' },
  { tier: 'LARGE', color: '#8B5CF6', threshold: '$1M–$10M volume (7d)', desc: 'Professional traders or large funds. Consistent top performers.' },
  { tier: 'MID', color: '#0A1EFF', threshold: '$100K–$1M volume (7d)', desc: 'Active retail-professional hybrids. High trade frequency.' },
  { tier: 'SMALL', color: '#6B7280', threshold: 'Under $100K volume (7d)', desc: 'Active wallets with lower absolute volume.' },
];

export function DocsSection08() {
  return (
    <section id="smart-money" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">08</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Smart Money & Whales</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Track the wallets that consistently outperform the market. STEINZ LABS continuously monitors the top-performing wallets across all chains and surfaces their moves in real time — giving you the edge of knowing what professional capital is doing before it's reflected in price.
      </p>

      {/* Smart Money */}
      <div id="smart-money-tracking" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#10B981]" />Smart Money Tracking
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Smart Money wallets are identified by consistently high win rates, strong risk-adjusted P&L, and a track record of entering positions before major price moves. The platform scores, ranks, and classifies these wallets continuously.
        </p>
        <div className="space-y-2 mb-5">
          {ARCHETYPES.map(a => (
            <div key={a.name} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ color: a.color, background: a.color + '20' }}>{a.name}</span>
              <span className="text-xs text-gray-400">{a.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs font-semibold text-white mb-3">Convergence Signal</div>
          <p className="text-xs text-gray-400 leading-relaxed">
            When multiple top-performing wallets buy the same token within a short time window, the platform surfaces a <span className="text-[#F59E0B] font-semibold">Convergence Signal</span> — historically one of the strongest leading indicators of short-term price momentum.
          </p>
        </div>
      </div>

      {/* Whale Tracker */}
      <div id="whale-tracker" className="scroll-mt-20">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Fish className="w-4 h-4 text-[#0A1EFF]" />Whale Tracker
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Monitors 1,000+ wallets across 10 chains in real time — ranking them by volume, win rate, and tier. The Live Feed tab streams large wallet movements as they happen via server-sent events.
        </p>
        <div className="space-y-2 mb-5">
          {WHALE_TIERS.map(w => (
            <div key={w.tier} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl" style={{ borderColor: w.color + '20' }}>
              <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ color: w.color, background: w.color + '20' }}>{w.tier}</span>
              <div>
                <div className="text-xs text-gray-300 font-semibold">{w.threshold}</div>
                <div className="text-xs text-gray-500 mt-0.5">{w.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#0A1EFF]/[0.05] border border-[#0A1EFF]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#4D6BFF]" />
            <span className="text-sm font-semibold text-white">Copy Trade Flow</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            From any whale profile, you can initiate a Copy Trade. The platform shows you 15 seconds to review the whale's stats — win rate, volume, P&L — before confirming. This cooldown is intentional: copy trading carries real risk, and you should understand what you're following.
          </p>
        </div>
      </div>
    </section>
  );
}
