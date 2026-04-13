import { Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const MODELS = [
  { name: 'Pattern Matcher', role: 'Compares current setups to 10,000+ historical token profiles' },
  { name: 'Sentiment Analyzer', role: 'NLP over social channels, Telegram groups, and on-chain activity' },
  { name: 'Momentum Engine', role: 'Short-term price momentum with volume confirmation signals' },
  { name: 'Risk Classifier', role: 'Multi-factor risk scoring — liquidity, concentration, contract risk' },
];

const CONFIDENCE_LEVELS = [
  { level: 'High', range: '75–100%', color: 'text-green-400', bg: 'bg-green-400/10', desc: 'Strong pattern match with multiple confirming signals' },
  { level: 'Medium', range: '50–74%', color: 'text-yellow-400', bg: 'bg-yellow-400/10', desc: 'Moderate signal alignment, some conflicting indicators' },
  { level: 'Low', range: '25–49%', color: 'text-orange-400', bg: 'bg-orange-400/10', desc: 'Weak signal, limited historical precedent' },
  { level: 'Insufficient', range: '0–24%', color: 'text-red-400', bg: 'bg-red-400/10', desc: 'Not enough data or contradictory signals' },
];

export function DocsSection04() {
  return (
    <section id="vtx-ai-engine" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">04</span>
        <h2 className="text-2xl font-bold text-white">VTX AI Engine</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        The VTX AI Engine orchestrates multiple analysis models powered by Anthropic Claude to deliver token intelligence scores, price predictions, and risk assessments.
      </p>

      <div className="ml-12 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Analysis Models</h3>
          <div className="space-y-2">
            {MODELS.map(m => (
              <div key={m.name} className="flex items-start gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-3.5 h-3.5 text-[#0A1EFF]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white mb-0.5">{m.name}</div>
                  <div className="text-xs text-gray-400">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="vtx-predictions">
          <h3 className="text-sm font-semibold text-white mb-3">Price Predictions</h3>
          <p className="text-xs text-gray-400 leading-relaxed mb-3">
            Predictions are generated for 1h, 4h, 24h, and 7d timeframes. Each prediction includes an expected gain/loss range, a timeframe, and a confidence score derived from historical pattern matching.
          </p>
          <div className="bg-gradient-to-r from-[#0A1EFF]/10 to-purple-500/10 border border-[#0A1EFF]/20 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              {[['Expected Gain', '+35–80%', 'text-green-400'], ['Timeframe', '24–72h', 'text-white'], ['Confidence', '78%', 'text-[#0A1EFF]']].map(([label, val, color]) => (
                <div key={label}>
                  <div className="text-gray-500 mb-1">{label}</div>
                  <div className={`text-lg font-bold ${color}`}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="vtx-pattern">
          <h3 className="text-sm font-semibold text-white mb-3">Confidence Levels</h3>
          <div className="space-y-2">
            {CONFIDENCE_LEVELS.map(c => (
              <div key={c.level} className={`flex items-center gap-3 ${c.bg} border border-transparent rounded-xl p-3`}>
                <span className={`text-xs font-bold ${c.color} w-20 flex-shrink-0`}>{c.level}</span>
                <span className="text-xs font-mono text-gray-400 w-16 flex-shrink-0">{c.range}</span>
                <span className="text-xs text-gray-400">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            VTX AI predictions are informational tools — not financial advice. All predictions are based on historical pattern matching and carry inherent uncertainty. Never trade based solely on AI signals.
          </p>
        </div>
      </div>
    </section>
  );
}
