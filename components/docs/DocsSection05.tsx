import { Wallet, GitBranch, Network } from 'lucide-react';

const DNA_METRICS = [
  { metric: 'Win Rate', desc: 'Percentage of closed positions with positive PnL' },
  { metric: 'Avg Hold Time', desc: 'Mean duration from buy to sell across all closed positions' },
  { metric: 'Best Chain', desc: 'Chain where the wallet has the highest win rate' },
  { metric: 'Preferred Size', desc: 'Typical position size bucket (micro/small/mid/large)' },
  { metric: 'Rug Avoidance', desc: 'How often the wallet exits before token collapse' },
  { metric: 'Gem Finding', desc: 'Rate of entering tokens pre-5x price move' },
];

const CLUSTER_SIGNALS = [
  { signal: 'Coordinated Block Buys', weight: 28, desc: 'Same token bought within ±5 blocks by multiple wallets' },
  { signal: 'Sequential Buys', weight: 22, desc: 'Same asset purchased within 24h time window' },
  { signal: 'Direct Fund Flows', weight: 25, desc: 'On-chain ETH/SOL transfers between wallets in cluster' },
  { signal: 'Timing Correlation', weight: 20, desc: 'Pearson r ≥ 0.70 across 1-hour trade activity bins' },
  { signal: 'Repeated Co-Trading', weight: 15, desc: '3+ co-trades of same token on same side' },
];

export function DocsSection05() {
  return (
    <section id="wallet-intelligence" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">05</span>
        <h2 className="text-2xl font-bold text-white">Wallet Intelligence</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        Deep profiling of any on-chain wallet — trading behavior, historical performance, peer connections, and coordination signals.
      </p>

      <div className="ml-12 space-y-6">
        <div id="wallet-dna">
          <h3 className="text-sm font-semibold text-white mb-3">Trading DNA Analyzer</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Trading DNA distills a wallet's historical behavior into a profile covering 6 behavioral metrics. Enter any wallet address at the Wallet Tracer to generate a full DNA report.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DNA_METRICS.map(d => (
              <div key={d.metric} className="bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-3.5 h-3.5 text-[#0A1EFF]" />
                  <span className="text-xs font-semibold text-white">{d.metric}</span>
                </div>
                <p className="text-xs text-gray-400">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="wallet-clusters">
          <h3 className="text-sm font-semibold text-white mb-3">Cluster Detection</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            The cluster detection engine identifies groups of wallets operating in coordination. A cluster is flagged when 3+ wallets trigger 2+ of the following coordination signals with a combined score ≥ 40.
          </p>
          <div className="space-y-2">
            {CLUSTER_SIGNALS.map(s => (
              <div key={s.signal} className="flex items-center gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="flex items-center gap-2 flex-shrink-0 w-48">
                  <GitBranch className="w-3.5 h-3.5 text-[#0A1EFF]" />
                  <span className="text-xs font-semibold text-white">{s.signal}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono text-[#0A1EFF] font-bold">+{s.weight}</span>
                </div>
                <p className="text-xs text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {[['≥ 60', 'Confirmed cluster'], ['40–59', 'Likely cluster'], ['< 40', 'Weak signal']].map(([score, label]) => (
              <div key={label} className="bg-[#141824] border border-[#1E2433] rounded-lg p-2">
                <div className="text-white font-bold font-mono">{score}</div>
                <div className="text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
