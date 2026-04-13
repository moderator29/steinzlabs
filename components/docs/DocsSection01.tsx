import { CheckCircle, Terminal, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  { step: '01', title: 'Create your account', desc: 'Sign up with your email at steinzlabs.com. Verify your email address to activate your account.' },
  { step: '02', title: 'Connect a wallet', desc: 'Navigate to Portfolio and link up to 10 wallets across Ethereum, Base, Solana, Arbitrum, and BSC.' },
  { step: '03', title: 'Explore the Context Feed', desc: 'Your personalized on-chain intelligence feed starts populating with whale movements and smart money signals.' },
  { step: '04', title: 'Set up alerts', desc: 'Configure price alerts, wallet move alerts, and security scan triggers from the Alerts page.' },
];

const REQUIREMENTS = [
  'Modern browser (Chrome 90+, Firefox 88+, Safari 14+)',
  'Web3 wallet for on-chain trading (MetaMask, Phantom, etc.)',
  'No installation required — fully browser-based',
];

export function DocsSection01() {
  return (
    <section id="getting-started" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">01</span>
        <h2 className="text-2xl font-bold text-white">Getting Started</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        STEINZ LABS is a browser-based intelligence platform. No installation, no node setup — access everything from your dashboard.
      </p>

      <div className="ml-12 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">System Requirements</h3>
          <ul className="space-y-2">
            {REQUIREMENTS.map((req, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Quick Setup</h3>
          <div className="space-y-3">
            {STEPS.map(s => (
              <div key={s.step} className="flex gap-4 bg-[#141824] border border-[#1E2433] rounded-xl p-4">
                <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#0A1EFF]">{s.step}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                  <div className="text-xs text-gray-400 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-[#0A1EFF]" />
            <span className="text-sm font-semibold text-white">Pro Tip</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Bookmark your dashboard URL after signing in. The app uses a persistent session — you will stay logged in across browser restarts for up to 1 hour.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-1.5 text-xs text-[#0A1EFF] hover:text-white transition-colors mt-3 font-medium">
            Create your account <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
