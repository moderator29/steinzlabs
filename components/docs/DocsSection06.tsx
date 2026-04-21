import { Shield, AlertTriangle, Globe, FileCode, CheckCircle, XCircle } from 'lucide-react';

const TRUST_FACTORS = [
  { label: 'Contract verification', desc: 'Is the source code verified on-chain and match the deployed bytecode?' },
  { label: 'Liquidity lock', desc: 'Is liquidity locked in a timelock contract, and for how long?' },
  { label: 'Holder concentration', desc: 'What percentage of supply is held by the top 10 wallets?' },
  { label: 'Buy/sell tax', desc: 'Does the contract charge hidden taxes on trades above normal?' },
  { label: 'Ownership renounced', desc: 'Has the contract owner key been burned, removing admin control?' },
  { label: 'Honeypot simulation', desc: 'Can the token actually be sold, or does the contract block sells?' },
];

const SECURITY_TOOLS = [
  {
    icon: Shield, color: '#10B981',
    title: 'Shadow Guardian',
    desc: 'Before every trade, Shadow Guardian simulates the transaction to detect honeypots, hidden sell taxes, and blacklist functions. If a token cannot be sold, you\'ll be warned before losing funds.',
  },
  {
    icon: FileCode, color: '#0A1EFF',
    title: 'Contract Analyzer',
    desc: 'Paste any smart contract address and VTX AI will decode the bytecode and explain exactly what the contract does · in plain English. Identifies dangerous functions like mint, pause, blacklist, and proxy upgrades.',
  },
  {
    icon: Globe, color: '#F59E0B',
    title: 'Domain Shield',
    desc: 'Real-time phishing domain detection. Checks URLs against known scam databases and analyzes domain age, SSL, and pattern matching to warn you before interacting with fraudulent sites.',
  },
  {
    icon: AlertTriangle, color: '#EF4444',
    title: 'Risk Scanner',
    desc: 'Portfolio-level risk assessment. Analyzes all your tracked wallets and holdings for concentrated risk, dangerous approvals, correlated positions, and chain-specific exposure.',
  },
  {
    icon: CheckCircle, color: '#8B5CF6',
    title: 'Approval Manager',
    desc: 'Lists all active token approvals across your wallets. Shows which contracts have unlimited spend access and lets you revoke risky approvals in one click without leaving the platform.',
  },
  {
    icon: FileCode, color: '#6B7280',
    title: 'Signature Insight',
    desc: 'Decodes and labels your full transaction history. Instead of raw hex data, see human-readable labels like "Swap ETH for USDC on Uniswap" or "Approved unlimited USDT to unknown contract".',
  },
];

export function DocsSection06() {
  return (
    <section id="security-center" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">06</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Security Center</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Every interaction on-chain carries risk. NAKA LABS Security Center gives you six tools to assess, verify, and protect yourself before moving any funds · from token safety scores to real-time phishing detection.
      </p>

      {/* Trust Score */}
      <div id="trust-score" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#10B981]" />Token Trust Score
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Every token receives a Trust Score from <span className="text-white">0 (maximum risk)</span> to <span className="text-white">100 (fully verified)</span>, calculated in real time from six security factors.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {TRUST_FACTORS.map(f => (
            <div key={f.label} className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">{f.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ range: '80–100', label: 'Safe', color: '#10B981' }, { range: '50–79', label: 'Caution', color: '#F59E0B' }, { range: '20–49', label: 'High risk', color: '#EF4444' }, { range: '0–19', label: 'Do not buy', color: '#7F1D1D' }].map(t => (
            <div key={t.range} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: t.color + '15', border: '1px solid ' + t.color + '30' }}>
              <span className="text-xs font-bold" style={{ color: t.color }}>{t.range}</span>
              <span className="text-xs text-gray-400">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security Tools */}
      <div id="shadow-guardian" className="scroll-mt-20 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Security Tools</h3>
        <div className="space-y-3">
          {SECURITY_TOOLS.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-1">{title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="domain-shield" className="scroll-mt-20 bg-[#EF4444]/[0.05] border border-[#EF4444]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          <span className="text-sm font-semibold text-white">Important</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          NAKA LABS security tools are advisory and based on on-chain data analysis. They do not guarantee safety. Always do your own research before investing. Never invest more than you can afford to lose.
        </p>
      </div>
    </section>
  );
}
