import { Zap, Shield, ArrowRight } from 'lucide-react';

const SUPPORTED_DEXS = [
  { name: 'Uniswap v3', chain: 'Ethereum / Base / Arbitrum', type: 'AMM' },
  { name: 'Jupiter', chain: 'Solana', type: 'Aggregator' },
  { name: 'PancakeSwap v3', chain: 'BSC', type: 'AMM' },
  { name: '0x Protocol', chain: 'Multi-chain', type: 'Aggregator' },
  { name: 'Camelot', chain: 'Arbitrum', type: 'AMM' },
  { name: 'Aerodrome', chain: 'Base', type: 'AMM' },
];

const MEV_STRATEGIES = [
  { strategy: 'Private Mempool', desc: 'Routes transactions through Flashbots Protect (EVM) or Jito bundles (Solana) to bypass public mempool frontrunning.' },
  { strategy: 'Slippage Guard', desc: 'Adaptive slippage based on liquidity depth and MEV risk score. Auto-adjusts when sandwiching detected.' },
  { strategy: 'Bundle Execution', desc: 'Multi-step swaps are bundled atomically to prevent partial-fill exploitation.' },
  { strategy: 'Risk Scoring', desc: 'Every swap gets an MEV risk score (low/medium/high/critical) before execution. Critical swaps are blocked by default.' },
];

export function DocsSection07() {
  return (
    <section id="multi-chain-swap" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">07</span>
        <h2 className="text-2xl font-bold text-white">Multi-Chain Swap</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        The STEINZ LABS swap engine aggregates DEX liquidity across 12 chains with built-in MEV protection, optimal routing, and real-time quote comparison.
      </p>

      <div className="ml-12 space-y-6">
        <div id="swap-routing">
          <h3 className="text-sm font-semibold text-white mb-3">Routing Engine</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Swap quotes are fetched in parallel from all available DEXs on the selected chain. The router picks the path with the best net output after fees, slippage, and gas costs.
          </p>
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E2433]">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">DEX</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Chain</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {SUPPORTED_DEXS.map(d => (
                  <tr key={d.name} className="border-b border-[#1E2433] last:border-0">
                    <td className="px-3 py-2 text-white font-medium">{d.name}</td>
                    <td className="px-3 py-2 text-gray-400">{d.chain}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 bg-[#0A1EFF]/10 text-[#0A1EFF] rounded text-[10px] font-mono">{d.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div id="mev-protection">
          <h3 className="text-sm font-semibold text-white mb-3">MEV Protection</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Every swap is analyzed for MEV exposure before execution. Four strategies are applied based on risk level:
          </p>
          <div className="space-y-2">
            {MEV_STRATEGIES.map(m => (
              <div key={m.strategy} className="flex gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-green-500" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white mb-0.5">{m.strategy}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          {[['0.1%–1%', 'Slippage Range'], ['< 3s', 'Quote Latency'], ['15s / 60s', 'Quote / Exec Timeout']].map(([val, label]) => (
            <div key={label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-3">
              <div className="text-white font-bold mb-0.5">{val}</div>
              <div className="text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
