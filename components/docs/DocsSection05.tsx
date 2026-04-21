import { Dna, Users, GitBranch, Network, TrendingUp } from 'lucide-react';

const DNA_METRICS = [
  { label: 'Win Rate', desc: 'Percentage of trades closed at a profit over the wallet\'s history.' },
  { label: 'P&L (USD)', desc: 'Total realized profit and loss across all tracked trades.' },
  { label: 'Trading Archetype', desc: 'AI-classified behavioral type: Diamond Hands, Scalper, Degen, Whale Follower, Holder, or New Wallet.' },
  { label: 'Avg Hold Time', desc: 'How long on average this wallet holds a position before exiting.' },
  { label: 'Best Trade', desc: 'The single most profitable trade executed by this wallet.' },
  { label: 'Activity Score', desc: 'Composite measure of how actively the wallet has traded recently.' },
];

const ARCHETYPES = [
  { name: 'Diamond Hands', color: '#F59E0B', desc: 'Holds positions long-term (30+ days) with high win rates. Patient, conviction-based trader.' },
  { name: 'Scalper', color: '#0A1EFF', desc: 'High-frequency trader, often 50+ trades. Short holding periods (under 1 day). Volume-driven.' },
  { name: 'Degen', color: '#EF4444', desc: 'High-risk, high-volatility trading behavior. Often in early-stage tokens with large swings.' },
  { name: 'Whale Follower', color: '#8B5CF6', desc: 'Consistently enters positions shortly after known smart money wallets move.' },
  { name: 'Holder', color: '#10B981', desc: 'Buy-and-hold strategy with 7+ day average holds. Moderate trade count.' },
];

export function DocsSection05() {
  return (
    <section id="wallet-intelligence" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">05</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Wallet Intelligence</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        NAKA LABS turns raw wallet addresses into complete behavioral profiles. Understand how any wallet trades, how it performs, what category it falls into, and whether it&apos;s connected to other known wallets · all from one lookup.
      </p>

      {/* DNA Analyzer */}
      <div id="dna-analyzer" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Dna className="w-4 h-4 text-[#0A1EFF]" />Trading DNA Analyzer
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Enter any wallet address to receive a full Trading DNA report · a behavioral fingerprint built from every on-chain trade that wallet has made. Supports EVM and Solana wallets.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {DNA_METRICS.map(m => (
            <div key={m.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{m.label}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{m.desc}</div>
            </div>
          ))}
        </div>
        <div className="mb-6">
          <div className="text-xs font-semibold text-white mb-3">Wallet Archetypes</div>
          <div className="space-y-2">
            {ARCHETYPES.map(a => (
              <div key={a.name} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: a.color, background: a.color + '20' }}>{a.name}</span>
                <span className="text-xs text-gray-400 leading-relaxed">{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet Clusters */}
      <div id="wallet-clusters" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#8B5CF6]" />Wallet Clusters
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Cluster detection identifies groups of wallets that appear to be controlled by the same entity · detected through shared funding sources, coordinated trading patterns, and transaction timing analysis. Use it to unmask wash traders, coordinated pump groups, or protocol insiders.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Coordination Score', desc: 'How likely this cluster is acting in coordination (0–100).' },
            { title: 'Funding Trace', desc: 'Visual map of how wallets in the cluster received initial funds.' },
            { title: 'Cluster Timeline', desc: 'Chronological view of key signals that triggered cluster classification.' },
          ].map(c => (
            <div key={c.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-1">{c.title}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Network Graph */}
      <div id="network-graph" className="scroll-mt-20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Network className="w-4 h-4 text-[#10B981]" />Network Graph & Bubble Map
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Visualize wallet relationships as an interactive force graph. The <strong className="text-gray-300">Network Graph</strong> shows fund flows and connections between entities. The <strong className="text-gray-300">Bubble Map</strong> shows token holder distributions · each bubble represents a holder, sized by their share, color-coded by entity type (exchange, whale, smart money, retail).
        </p>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs font-semibold text-white mb-2">Bubble Map View Modes</div>
          <div className="space-y-2">
            {[
              { mode: 'Holders', desc: 'Token holder distribution · all wallets holding a token sized by their share.' },
              { mode: 'Network', desc: 'Wallet connection view · wallets linked by shared behaviors or known relations.' },
              { mode: 'Clusters', desc: 'Entity groupings · color-coded clusters of wallets belonging to the same entity.' },
            ].map(m => (
              <div key={m.mode} className="flex gap-3 text-xs">
                <span className="font-semibold text-[#4D6BFF] w-16 flex-shrink-0">{m.mode}</span>
                <span className="text-gray-400">{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
