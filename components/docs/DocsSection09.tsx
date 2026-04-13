import { BarChart3, RefreshCw, Wallet } from 'lucide-react';

const PORTFOLIO_METRICS = [
  { metric: 'Total Value USD', desc: 'Combined USD value of all positions across all linked wallets' },
  { metric: 'Total PnL (Unrealized)', desc: 'Sum of all open position PnL at current market prices' },
  { metric: '24h Change', desc: 'Portfolio value delta over the last 24 hours' },
  { metric: 'AI Score (0–100)', desc: 'VTX portfolio quality rating: diversification, risk, profitability' },
  { metric: 'Risk Level', desc: 'Aggregate risk: low / moderate / high / critical' },
  { metric: '90-Day Snapshot Chart', desc: 'Historical portfolio value chart with daily change % overlay' },
];

const AI_SCORE_BREAKDOWN = [
  { factor: 'Diversification', weight: '+20 max', desc: '2 points per unique position, capped at 10 positions' },
  { factor: 'Profitable Positions', weight: '+20 max', desc: 'Ratio of positions with positive unrealized PnL' },
  { factor: 'Risk Score', weight: '-30 max', desc: 'Weighted average risk score across all holdings' },
  { factor: 'Concentration Penalty', weight: '-20 max', desc: 'If top holding > 80% of portfolio, -20 applied' },
  { factor: 'Base Score', weight: '+50 base', desc: 'Starting score before adjustments' },
];

export function DocsSection09() {
  return (
    <section id="portfolio" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">09</span>
        <h2 className="text-2xl font-bold text-white">Portfolio &amp; Analytics</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        Track up to 10 wallets simultaneously. The Portfolio page aggregates all positions into a unified dashboard with historical P&L and AI-driven quality scoring.
      </p>

      <div className="ml-12 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Portfolio Metrics</h3>
          <div className="grid grid-cols-2 gap-2">
            {PORTFOLIO_METRICS.map(m => (
              <div key={m.metric} className="bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-[#0A1EFF]" />
                  <span className="text-xs font-semibold text-white">{m.metric}</span>
                </div>
                <p className="text-xs text-gray-400">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">AI Score Calculation</h3>
          <p className="text-xs text-gray-400 mb-3">The AI Score (0–100) is calculated from the following weighted factors:</p>
          <div className="space-y-2">
            {AI_SCORE_BREAKDOWN.map(f => (
              <div key={f.factor} className="flex items-center gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <span className="text-xs font-semibold text-white w-36 flex-shrink-0">{f.factor}</span>
                <span className="text-xs font-mono text-[#0A1EFF] w-20 flex-shrink-0">{f.weight}</span>
                <span className="text-xs text-gray-400">{f.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            {[['80–100', 'Excellent', 'text-green-400'], ['60–79', 'Good', 'text-blue-400'], ['40–59', 'Fair', 'text-yellow-400'], ['0–39', 'Poor', 'text-red-400']].map(([range, label, color]) => (
              <div key={label} className="bg-[#141824] border border-[#1E2433] rounded-lg p-2">
                <div className={`font-bold ${color}`}>{range}</div>
                <div className="text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <RefreshCw className="w-4 h-4 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-white mb-1">Cache &amp; Refresh</div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Portfolio data is cached for 60 seconds per wallet. Manual refresh clears the cache and fetches live data. Wallet data is persisted to localStorage under the key <code className="font-mono text-[#0A1EFF]">portfolio_wallets_v2</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
