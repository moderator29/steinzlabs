import { Shield, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

const SCAN_CHECKS = [
  { category: 'Contract Risk', checks: ['Ownership renounced', 'Mint function disabled', 'Blacklist function absent', 'Max transaction limits', 'Proxy upgrade pattern'] },
  { category: 'Liquidity Safety', checks: ['LP tokens locked', 'Lock duration > 180d', 'Liquidity depth adequate', 'Multiple liquidity pools'] },
  { category: 'Holder Analysis', checks: ['Top 10 < 30% supply', 'No single holder > 15%', 'Dev wallet size', 'Team token vesting'] },
  { category: 'Trading Patterns', checks: ['No honeypot detected', 'Sell tax ≤ 10%', 'Buy tax ≤ 10%', 'No hidden transfer fees'] },
];

const SCORE_RANGES = [
  { range: '8.0–10', label: 'Safe', color: 'text-green-400', bg: 'bg-green-400/10', desc: 'Passes all critical checks. Low rug risk.' },
  { range: '6.0–7.9', label: 'Caution', color: 'text-yellow-400', bg: 'bg-yellow-400/10', desc: 'Minor flags present. Research before trading.' },
  { range: '4.0–5.9', label: 'Warning', color: 'text-orange-400', bg: 'bg-orange-400/10', desc: 'Multiple risk factors. High caution advised.' },
  { range: '0–3.9', label: 'Danger', color: 'text-red-400', bg: 'bg-red-400/10', desc: 'Critical failures detected. Likely rug or honeypot.' },
];

export function DocsSection06() {
  return (
    <section id="security-center" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">06</span>
        <h2 className="text-2xl font-bold text-white">Security Center</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        The Security Center provides automated threat detection for token contracts, powered by Shadow Guardian deep-scan technology.
      </p>

      <div className="ml-12 space-y-6">
        <div id="shadow-guardian">
          <h3 className="text-sm font-semibold text-white mb-3">Shadow Guardian Scan</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            Shadow Guardian scans token contracts across 17 security vectors in under 3 seconds. It combines static bytecode analysis with live on-chain data to detect rug indicators that other scanners miss.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SCAN_CHECKS.map(c => (
              <div key={c.category} className="bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-[#0A1EFF]" />
                  <span className="text-xs font-semibold text-white">{c.category}</span>
                </div>
                <ul className="space-y-1">
                  {c.checks.map(check => (
                    <li key={check} className="flex items-center gap-1.5 text-xs text-gray-400">
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div id="rug-detection">
          <h3 className="text-sm font-semibold text-white mb-3">Safety Score Ranges</h3>
          <div className="space-y-2">
            {SCORE_RANGES.map(s => (
              <div key={s.range} className={`flex items-center gap-4 ${s.bg} rounded-xl p-3 border border-transparent`}>
                <span className={`text-base font-bold font-mono ${s.color} w-16 flex-shrink-0`}>{s.range}</span>
                <span className={`text-xs font-bold ${s.color} w-14 flex-shrink-0`}>{s.label}</span>
                <span className="text-xs text-gray-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-white mb-1">Scan Limitations</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Shadow Guardian cannot detect social engineering attacks, off-chain team behavior, or future contract upgrades via proxy patterns not flagged at scan time. Always conduct your own research.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
