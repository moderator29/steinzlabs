import { Radio, Filter } from 'lucide-react';

const SIGNAL_TYPES = [
  { tag: 'BULLISH', color: '#10B981', bg: '#10B98115', desc: 'Whale accumulation, smart money entries, rising buy pressure, or strong holder growth.' },
  { tag: 'HYPE', color: '#F59E0B', bg: '#F59E0B15', desc: 'Unusual volume spikes, launch events, or viral narrative momentum detected on-chain or socially.' },
  { tag: 'BEAR', color: '#EF4444', bg: '#EF444415', desc: 'Large holder exits, concentrated selling, liquidity withdrawals, or declining fundamentals.' },
  { tag: 'NEUTRAL', color: '#6B7280', bg: '#6B728015', desc: 'Informational events without clear directional bias — wallet movements, contract interactions, trend shifts.' },
];

export function DocsSection03() {
  return (
    <section id="context-feed" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">03</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Context Feed</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Your real-time on-chain intelligence stream — a continuous flow of curated signals from whale movements, smart money entries, token launches, large transfers, and security events. AI-filtered and ranked so you only see what matters.
      </p>
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-8 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
        <p className="text-sm text-gray-300">Live — streams new events every few seconds, no refresh needed.</p>
      </div>
      <div id="context-signals" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#0A1EFF]" />Signal Types
        </h3>
        <div className="space-y-3">
          {SIGNAL_TYPES.map(s => (
            <div key={s.tag} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5" style={{ color: s.color, background: s.bg }}>{s.tag}</span>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div id="context-trust" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4">Trust Score</h3>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            Every signal carries a <span className="text-white font-semibold">Trust Score (0–100)</span>, reflecting source wallet quality, corroborating on-chain events, and historical signal accuracy.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[{ range: '75–100', label: 'High trust', color: '#10B981' }, { range: '40–74', label: 'Medium', color: '#F59E0B' }, { range: '0–39', label: 'Low trust', color: '#EF4444' }].map(t => (
              <div key={t.range} className="text-center p-3 rounded-lg bg-white/[0.03]">
                <div className="text-sm font-bold" style={{ color: t.color }}>{t.range}</div>
                <div className="text-xs text-gray-500 mt-1">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#0A1EFF]/[0.05] border border-[#0A1EFF]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[#4D6BFF]" />
          <span className="text-sm font-semibold text-white">Available Filters</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Chain', 'Signal Type', 'Trust Score', 'Whale size', 'Token category', 'Time window', 'Watched wallets only'].map(f => (
            <span key={f} className="text-xs px-2.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-gray-400">{f}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
