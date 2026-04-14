import { Repeat, Shield, Crosshair, BarChart3, Zap, AlertTriangle } from 'lucide-react';

const SWAP_CHAINS = [
  { name: 'Solana', note: 'Jupiter DEX aggregator — best route across all Solana DEXes' },
  { name: 'Ethereum', note: '0x Protocol — best execution across Uniswap, Curve, Balancer, and more' },
  { name: 'Base', note: '0x Protocol — optimized routing across Base DEX ecosystem' },
  { name: 'Arbitrum', note: '0x Protocol — sub-second finality, low fees' },
  { name: 'Polygon', note: '0x Protocol — mature DEX ecosystem, high liquidity' },
  { name: 'BSC', note: '0x Protocol — PancakeSwap and major BSC DEXes' },
];

const SNIPER_STEPS = [
  { n: '1', title: 'Discovery', desc: 'Monitors DexScreener, Pump.fun, and on-chain events for new token launches the moment liquidity is added.' },
  { n: '2', title: 'Safety scan', desc: 'Runs a 5-layer security check before executing: honeypot test, tax check, liquidity lock, ownership status, holder scan.' },
  { n: '3', title: 'Execution', desc: 'If the token passes safety filters, the configured buy is executed with your preset slippage and max spend.' },
  { n: '4', title: 'Monitoring', desc: 'Tracks the position and triggers auto-sell at your target price or stop-loss threshold.' },
];

export function DocsSection07() {
  return (
    <section id="trading-suite" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">07</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Trading Suite</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        STEINZ LABS gives you a complete trading toolkit — from instant multi-chain swaps to automated sniper bots and copy trading. Every trade is security-checked before execution.
      </p>

      {/* Multi-Chain Swap */}
      <div id="swap-engine" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-[#0A1EFF]" />Multi-Chain Swap
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Swap tokens across 6+ chains from one interface. The routing engine finds the best execution price across all major DEXes on each chain — no need to switch wallets or apps.
        </p>
        <div className="space-y-2 mb-5">
          {SWAP_CHAINS.map(c => (
            <div key={c.name} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-xs font-bold text-[#4D6BFF] w-20 flex-shrink-0">{c.name}</span>
              <span className="text-xs text-gray-400">{c.note}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#10B981]/[0.05] border border-[#10B981]/20 rounded-xl p-3">
          <p className="text-xs text-gray-400">
            <span className="text-[#10B981] font-semibold">Security pre-check:</span> Every swap runs a Shadow Guardian scan before execution. If the destination token is flagged as a honeypot, the swap is blocked automatically.
          </p>
        </div>
      </div>

      {/* Copy Trading */}
      <div id="copy-trading" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Copy Trading
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Mirror the trades of any wallet on the platform. Set your copy trade size as a percentage of the source wallet's position, and your wallet will automatically replicate their buys and sells within your configured limits.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Max copy size', desc: 'Cap the maximum USD value per copied trade.' },
            { label: 'Copy only buys', desc: 'Mirror buy signals only, manage exits yourself.' },
            { label: 'Safety filter', desc: 'Auto-skip trades on tokens that fail the Trust Score threshold.' },
            { label: 'Pause anytime', desc: 'Disable a copy trade without closing existing positions.' },
          ].map(c => (
            <div key={c.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{c.label}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sniper Bot */}
      <div id="sniper-bot" className="scroll-mt-20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-[#EF4444]" />Sniper Bot
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Automatically detect and buy new token launches the moment liquidity is added. The Sniper Bot applies a 5-layer safety protocol before any buy — every launch is scanned, not just taken blindly.
        </p>
        <div className="space-y-2 mb-4">
          {SNIPER_STEPS.map(s => (
            <div key={s.n} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#EF4444]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#EF4444]">{s.n}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">New token trading carries extreme risk. Even with safety checks, new tokens can fail. Never allocate more than you are prepared to lose entirely.</p>
        </div>
      </div>
    </section>
  );
}
