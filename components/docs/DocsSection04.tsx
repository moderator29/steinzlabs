import { Brain, MessageSquare, Zap, BarChart3 } from 'lucide-react';

const CAPABILITIES = [
  { q: 'What is the smart money doing with SOL right now?', a: 'Returns top wallet movements, recent buys/sells, and momentum direction for SOL in the last 24 hours.' },
  { q: 'Analyze this wallet: 0xabc...', a: 'Provides win rate, P&L history, trading archetype, most traded tokens, and activity patterns.' },
  { q: 'Is this token safe to buy?', a: 'Runs a full Trust Score scan including contract audit, holder concentration, liquidity lock status, and tax check.' },
  { q: 'Show me the biggest whale moves in the last hour', a: 'Surfaces large transfers and buys/sells across all monitored chains, sorted by USD value.' },
];

const USE_CASES = [
  { title: 'Market research', desc: 'Ask about any token, protocol, or on-chain narrative and get AI-synthesized answers from live blockchain data.' },
  { title: 'Wallet profiling', desc: 'Drop in any wallet address and get a full behavioral breakdown — archetypes, P&L, win rates, and risk signals.' },
  { title: 'Security analysis', desc: 'Ask VTX to audit a contract, decode a transaction, or explain what a smart contract actually does.' },
  { title: 'Strategy validation', desc: 'Ask the AI to validate a thesis — e.g. "Is DeFi TVL growing on Base?" — backed by real DeFiLlama data.' },
];

export function DocsSection04() {
  return (
    <section id="vtx-ai" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">04</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">VTX AI Engine</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        VTX AI is your on-chain analyst, available 24/7. Ask any question about crypto markets, wallets, tokens, or on-chain trends in plain English and get answers backed by live blockchain data — not guesses or general knowledge.
      </p>

      <div className="bg-gradient-to-br from-[#0A1EFF]/10 to-[#10B981]/5 border border-[#0A1EFF]/20 rounded-xl p-4 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[#4D6BFF]" />
          <span className="text-sm font-semibold text-white">Powered by Anthropic Claude</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          VTX AI is built on Claude and given direct access to live on-chain data tools — Alchemy, DexScreener, DeFiLlama, and proprietary security scanners. Every answer is grounded in real-time blockchain data, not training data from months ago.
        </p>
      </div>

      <div id="vtx-capabilities" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Example Queries
        </h3>
        <div className="space-y-3">
          {CAPABILITIES.map(c => (
            <div key={c.q} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#4D6BFF] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-white font-medium">&quot;{c.q}&quot;</span>
              </div>
              <div className="flex items-start gap-2 ml-5">
                <Brain className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-400 leading-relaxed">{c.a}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="vtx-usage" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-4">What You Can Ask About</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {USE_CASES.map(u => (
            <div key={u.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-sm font-semibold text-white mb-1">{u.title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{u.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-semibold text-white">Pro tip</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          VTX AI works best with specific questions. Instead of &quot;what should I buy?&quot;, try &quot;which wallets with 70%+ win rates have accumulated ETH in the last 48 hours?&quot; — the more specific, the more actionable the answer.
        </p>
      </div>
    </section>
  );
}
