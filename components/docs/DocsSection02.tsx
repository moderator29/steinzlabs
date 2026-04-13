import { BarChart3, Shield, Brain, Zap, Globe, Wallet, Search, TrendingUp } from 'lucide-react';

const MODULES = [
  { icon: Brain, title: 'Context Feed', desc: 'Real-time on-chain intelligence stream. Filter whale moves, smart money entries, token launches, and social signals.' },
  { icon: Shield, title: 'Security Center', desc: 'Shadow Guardian deep-scans tokens for rug indicators, honeypots, concentrated ownership, and malicious bytecode.' },
  { icon: TrendingUp, title: 'Smart Money Tracking', desc: 'Follow the on-chain footprint of 500+ verified profitable wallets across every major chain.' },
  { icon: Zap, title: 'VTX AI Engine', desc: 'Multi-model AI predictions using Anthropic Claude with pattern matching across 10,000+ historical setups.' },
  { icon: Wallet, title: 'Wallet Intelligence', desc: 'Deep wallet profiling — trading DNA, PnL history, cluster detection, and coordination scoring.' },
  { icon: Globe, title: 'Multi-Chain Swap', desc: 'DEX aggregation across Uniswap v3, Jupiter, PancakeSwap with built-in MEV protection.' },
  { icon: Search, title: 'Token Research', desc: 'Full token intelligence: holder breakdown, Bubblemaps visualization, liquidity depth, and historical pattern matching.' },
  { icon: BarChart3, title: 'Portfolio Tracker', desc: 'Multi-wallet portfolio aggregation with 90-day P&L history, AI score, and risk assessment.' },
];

const CHAINS = ['Ethereum', 'Base', 'Solana', 'Arbitrum', 'BSC', 'Polygon', 'Avalanche', 'Optimism', 'zkSync', 'Blast', 'Linea', 'Fantom'];

export function DocsSection02() {
  return (
    <section id="platform-overview" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">02</span>
        <h2 className="text-2xl font-bold text-white">Platform Overview</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        STEINZ LABS is a unified on-chain intelligence suite covering research, security, trading, and portfolio management — all powered by real-time blockchain data.
      </p>

      <div className="ml-12 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map(m => (
            <div key={m.title} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 hover:border-[#0A1EFF]/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <m.icon className="w-3.5 h-3.5 text-[#0A1EFF]" />
                </div>
                <span className="text-sm font-semibold text-white">{m.title}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Supported Chains</h3>
          <div className="flex flex-wrap gap-2">
            {CHAINS.map(chain => (
              <span key={chain} className="px-2.5 py-1 bg-[#141824] border border-[#1E2433] rounded-full text-xs text-gray-300 font-medium">
                {chain}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Data Sources</h3>
          <div className="grid grid-cols-3 gap-3 text-xs text-gray-400">
            {[
              ['Blockchain RPC', 'Helius (Solana), Alchemy (EVM)'],
              ['Price Data', 'DexScreener, CoinGecko'],
              ['DEX Routing', 'Uniswap v3, Jupiter, 0x'],
              ['Social Data', 'Birdeye, Defined.fi'],
              ['On-chain Labels', 'Arkham Intelligence'],
              ['MEV Protection', 'Flashbots, Jito'],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-gray-500 mb-0.5">{label}</div>
                <div className="text-white font-medium">{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
