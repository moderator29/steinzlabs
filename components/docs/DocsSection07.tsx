import { Repeat, Shield, Crosshair, Zap, AlertTriangle, ArrowRight, ArrowDown } from 'lucide-react';

const SWAP_CHAINS = [
  { name: 'Solana',    note: 'Best route across every major Solana DEX.' },
  { name: 'Ethereum',  note: 'Aggregated liquidity from the top EVM DEXes.' },
  { name: 'Base',      note: 'Low-fee routing across Base-native DEXes.' },
  { name: 'Arbitrum',  note: 'Sub-second finality, L2-priced swaps.' },
  { name: 'Polygon',   note: 'Mature DEX liquidity at Polygon gas.' },
  { name: 'BSC',       note: 'PancakeSwap and the full BSC DEX set.' },
];

const SNIPER_STEPS = [
  { n: '1', title: 'Discovery',   desc: 'The bot watches for new token launches the moment liquidity is added on any supported chain.' },
  { n: '2', title: 'Safety scan', desc: 'Runs a 5-layer pre-flight check before buying: honeypot simulation, tax check, liquidity lock, ownership status, holder distribution.' },
  { n: '3', title: 'Execution',   desc: 'If the launch passes all filters, the configured buy fires with your preset slippage and max spend.' },
  { n: '4', title: 'Monitoring',  desc: 'Tracks the open position and triggers auto-sell at your take-profit or stop-loss threshold.' },
];

export function DocsSection07() {
  return (
    <section id="trading-suite" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">07</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Trading Suite</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Everything you need to act on your research · swaps, limit orders, stop-loss, copy trading, and a sniper bot · all in one place, every trade security-checked before it hits the chain.
      </p>

      {/* Multi-Chain Swap */}
      <div id="swap-engine" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-[#0A1EFF]" />Multi-Chain Swap
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Swap any token on any supported chain from one interface. The routing engine queries multiple sources in parallel and picks the best price · no wallet switching, no bridge juggling.
        </p>

        {/* How to swap · step-by-step */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#4D6BFF] font-semibold mb-3">How a swap works</p>
          <ol className="space-y-2 text-xs text-gray-300">
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">1</span><span>Open <span className="text-white font-semibold">Dashboard → Swap</span> (or ask VTX <span className="font-mono text-[#4D6BFF]">&quot;swap 100 USDC to SOL&quot;</span>).</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">2</span><span>Pick the chain, the <span className="text-white font-semibold">From</span> token, and the <span className="text-white font-semibold">To</span> token. Paste a contract for anything not in the picker.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">3</span><span>Set the amount and the slippage tolerance (default 1 %).</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">4</span><span>Review the route summary, the security verdict, and the estimated output. Tap <span className="text-white font-semibold">Confirm</span>.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">5</span><span>Sign in your wallet. Transaction lands on-chain, receipt appears in your notifications.</span></li>
          </ol>
        </div>

        {/* Worked example */}
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-xs">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Example</p>
          <div className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-gray-500" /><span className="text-white">From: 100 USDC on Solana</span></div>
          <div className="ml-4 text-gray-500">↓ best-of-3 aggregator</div>
          <div className="flex items-center gap-2"><ArrowDown className="w-3 h-3 text-gray-500" /><span className="text-white">To: ≈ 0.54 SOL</span></div>
          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Slippage</span><span className="text-white">1.0 %</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Network fee</span><span className="text-white">~$0.01</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Pre-flight scan</span><span className="text-emerald-400">SAFE</span></div>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {SWAP_CHAINS.map((c) => (
            <div key={c.name} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-xs font-bold text-[#4D6BFF] w-20 flex-shrink-0">{c.name}</span>
              <span className="text-xs text-gray-400">{c.note}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#10B981]/[0.05] border border-[#10B981]/20 rounded-xl p-3">
          <p className="text-xs text-gray-400">
            <span className="text-[#10B981] font-semibold">Pre-flight safety:</span> every swap runs a Shadow Guardian simulation before it signs. Honeypot, impossible-to-sell, and high-tax contracts are blocked automatically.
          </p>
        </div>
      </div>

      {/* Limit orders / stop-loss */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Limit Orders &amp; Stop-Loss
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Set a price, walk away. Limit orders fire a buy or sell when the market hits your target. Stop-loss and take-profit keep open positions on autopilot · set the rule once, it executes without you at the keyboard.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Limit buy / sell</div>
            <div className="text-xs text-gray-500">Executes at your target price or better, expires after the window you set.</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Stop-loss</div>
            <div className="text-xs text-gray-500">Auto-exits a position if it drops past a floor you define.</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Take-profit</div>
            <div className="text-xs text-gray-500">Auto-sells once you hit your target price so you lock the win in.</div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Trailing stop</div>
            <div className="text-xs text-gray-500">Follows the price up and only exits on a pullback of the % you choose.</div>
          </div>
        </div>
      </div>

      {/* Copy Trading */}
      <div id="copy-trading" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Copy Trading
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Mirror the buys of any tracked wallet. Set a max per-trade cap, a daily spend cap, and optional safety filters. Copies fire automatically when the source wallet trades · you keep control of the exits.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Max per trade', desc: 'Cap the USD value of any single copied buy.' },
            { label: 'Daily spend cap', desc: 'Hard ceiling across the day so a runaway source wallet can&apos;t drain you.' },
            { label: 'Trust Score filter', desc: 'Auto-skip buys on tokens below your safety threshold.' },
            { label: 'Pause anytime', desc: 'Disable a rule without closing the existing positions it opened.' },
          ].map((c) => (
            <div key={c.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{c.label}</div>
              <div className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: c.desc }} />
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
          Detect new launches the instant liquidity is added and buy with a 5-layer safety protocol in front. Every launch is scanned · nothing is bought blindly.
        </p>
        <div className="space-y-2 mb-4">
          {SNIPER_STEPS.map((s) => (
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
          <p className="text-xs text-gray-400">New-token trading carries extreme risk. Even with safety checks enabled, new tokens can fail. Never allocate more than you are prepared to lose entirely.</p>
        </div>
        <div className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl mt-2">
          <Shield className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">The Sniper Bot is a <span className="text-white font-semibold">Max tier</span> feature. Free, Mini, and Pro tiers can preview the dashboard but cannot arm a sniper.</p>
        </div>
      </div>
    </section>
  );
}
