import { Sparkles, MessageSquare, Zap, ArrowRight, User, Shield } from 'lucide-react';

// Section 04 — VTX AI Engine
// Public-facing only. No vendor names, no training-data disclosures.

const SLASH_COMMANDS = [
  { cmd: '/token <symbol or address>', desc: 'Full token card with price, market cap, holders, security verdict, and a Buy / Set Alert CTA.' },
  { cmd: '/wallet <address>', desc: 'Trading DNA profile for any wallet — archetype, win rate, top holdings, recent moves.' },
  { cmd: '/security <address>', desc: 'Security-only scan: honeypot test, tax analysis, liquidity lock, ownership status.' },
  { cmd: '/contract <address>', desc: 'Plain-English summary of what a smart contract actually does, plus dangerous-function flags.' },
  { cmd: '/domain <url>', desc: 'Phishing check for any link before you connect your wallet.' },
  { cmd: '/compare <A> vs <B>', desc: 'Side-by-side market-data + risk comparison.' },
  { cmd: '/trending', desc: 'Top-searched coins right now with live 24 h deltas.' },
  { cmd: '/help', desc: 'Full command catalogue grouped by category.' },
];

export function DocsSection04() {
  return (
    <section id="vtx-ai" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">04</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">VTX Agent</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        VTX is your on-chain analyst — a chat window that answers questions about any token, wallet, or trend using live blockchain data. You don&apos;t need to know how to query a block explorer; just ask in plain English and VTX does the lookups, runs the security scans, and writes up the answer for you.
      </p>

      <div id="vtx-capabilities" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#4D6BFF]" />How to use it
        </h3>
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            Open the <span className="text-white font-semibold">VTX Agent</span> tab from the dashboard bottom bar. Type or paste one of three things:
          </p>
          <ul className="space-y-2 list-none pl-4">
            <li className="flex gap-2 items-start"><ArrowRight className="w-3.5 h-3.5 text-[#4D6BFF] mt-1 shrink-0" /><span><span className="text-white font-medium">A token</span> — ticker like <span className="font-mono text-[#4D6BFF]">PEPE</span> or a contract address.</span></li>
            <li className="flex gap-2 items-start"><ArrowRight className="w-3.5 h-3.5 text-[#4D6BFF] mt-1 shrink-0" /><span><span className="text-white font-medium">A wallet</span> — any EVM or Solana address.</span></li>
            <li className="flex gap-2 items-start"><ArrowRight className="w-3.5 h-3.5 text-[#4D6BFF] mt-1 shrink-0" /><span><span className="text-white font-medium">A thesis</span> — free-form question like &quot;which top-100 coins have the best 7-day momentum?&quot;.</span></li>
          </ul>
          <p className="text-xs text-gray-500">
            Prefer commands? VTX supports a slash-command shortcut set (below) — type <span className="font-mono text-[#4D6BFF]">/</span> and pick one.
          </p>
        </div>
      </div>

      {/* Worked example 1 — token card pull */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#10B981]" />Example: pulling a token card
        </h3>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-start gap-3 border-b border-white/[0.04]">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex-1 text-sm text-white">is PEPE safe to buy right now</div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-[#4D6BFF]" />
            </div>
            <div className="flex-1 text-sm text-gray-300 leading-relaxed space-y-2">
              <p>Pulled the current state for <span className="font-semibold text-white">PEPE</span>. Here is the token card:</p>
              <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs font-mono">
                <div className="flex justify-between"><span className="text-gray-500">Token</span><span className="text-white">PEPE · Ethereum</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-white">$0.000012</span></div>
                <div className="flex justify-between"><span className="text-gray-500">24 h</span><span className="text-emerald-400">+4.1 %</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Market cap</span><span className="text-white">$5.1 B</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Holders</span><span className="text-white">412,718</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Trust Score</span><span className="text-emerald-400">82 / 100 — SAFE</span></div>
              </div>
              <p className="text-xs text-gray-500">
                Contract verified, no mint function, ownership renounced, top-10 concentration is 23 %. Liquidity looks deep. Risk level is <span className="text-emerald-400 font-semibold">low</span>, but this is a meme — position-size accordingly.
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
          Below every token card VTX shows the live buy/sell buttons so you can act without leaving the chat.
        </p>
      </div>

      {/* Worked example 2 — swap intent */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Example: asking VTX to prepare a swap
        </h3>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-start gap-3 border-b border-white/[0.04]">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex-1 text-sm text-white">swap 100 USDC to SOL</div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-[#4D6BFF]" />
            </div>
            <div className="flex-1 text-sm text-gray-300 leading-relaxed space-y-2">
              <p>Staged this trade for your review. Nothing executes until you tap <span className="text-white font-semibold">Confirm</span>.</p>
              <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs font-mono">
                <div className="flex justify-between"><span className="text-gray-500">From</span><span className="text-white">100.00 USDC (Solana)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">To (est.)</span><span className="text-white">~ 0.54 SOL</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Route</span><span className="text-white">Best-of-3 aggregator</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Slippage</span><span className="text-white">1.0 %</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Network fee</span><span className="text-white">~ $0.01</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Security check</span><span className="text-emerald-400">SAFE to trade</span></div>
              </div>
              <p className="text-xs text-gray-500">
                Review, tap <span className="text-white font-semibold">Confirm</span> in the Pending Trades bar at the bottom of the screen, sign in your wallet, done. If the route gets worse by more than 2 %, VTX will re-quote before sending.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Slash-command reference */}
      <div id="vtx-usage" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3">Slash-command shortcuts</h3>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
          {SLASH_COMMANDS.map((c) => (
            <div key={c.cmd} className="px-4 py-3 flex items-start gap-3">
              <div className="w-24 sm:w-52 shrink-0">
                <span className="text-[11px] font-mono text-[#4D6BFF] break-all">{c.cmd}</span>
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-semibold text-white">Safety</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          VTX never auto-executes a trade. Any swap you ask about is staged as a pending trade that you must confirm. Security-critical answers (contract audits, phishing URLs) always run fresh scans — nothing is cached from memory.
        </p>
      </div>
    </section>
  );
}
