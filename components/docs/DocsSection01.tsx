import { CheckCircle, ArrowRight, Zap, Globe, Shield, Brain, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign up at nakalabs.com with your email. Verify to activate · no credit card required for the free tier.' },
  { n: '02', title: 'Connect your wallets', desc: 'Go to Portfolio and link up to 10 wallets across Ethereum, Base, Solana, Arbitrum, Polygon, and BSC for automatic tracking.' },
  { n: '03', title: 'Explore the Context Feed', desc: 'Your personalized real-time intelligence stream activates immediately · showing whale moves, smart money signals, and on-chain alerts.' },
  { n: '04', title: 'Run your first scan', desc: 'Paste any token address into the search bar or Security Center for an instant Trust Score, holder analysis, and risk breakdown.' },
  { n: '05', title: 'Set up alerts', desc: 'Configure price alerts, whale movement notifications, and security triggers from the Alerts page to stay ahead of the market.' },
];

const CAPABILITIES = [
  { icon: Brain, label: 'VTX AI Engine', desc: 'Ask any on-chain question in plain English' },
  { icon: Shield, label: 'Security Center', desc: 'Trust scores, rug detection, contract analysis' },
  { icon: TrendingUp, label: 'Smart Money', desc: 'Track wallets that consistently win' },
  { icon: Globe, label: '12+ Chains', desc: 'Unified view across all major blockchains' },
];

export function DocsSection01() {
  return (
    <section id="getting-started" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">01</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Getting Started</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        NAKA LABS is a browser-based on-chain intelligence platform. No installation, no node setup, no command line. Everything you need to analyze wallets, track smart money, detect risks, and trade safely is in one unified dashboard.
      </p>

      {/* What you can do */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] transition-colors">
            <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-[#4D6BFF]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Setup steps */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#0A1EFF]" />Quick Setup · 5 Steps
        </h3>
        <div className="space-y-3">
          {STEPS.map(s => (
            <div key={s.n} className="flex gap-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#4D6BFF]">{s.n}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">What You Need</h3>
        <ul className="space-y-2">
          {[
            'Modern browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+',
            'A wallet for on-chain swap. Naka ships a fully non-custodial Naka Wallet built in (always back up your seed phrase). External wallets like MetaMask, Phantom, and Coinbase Wallet also connect.',
            'An email address to create your NAKA LABS account',
          ].map((req, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
              <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
              {req}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/signup" className="inline-flex items-center justify-center gap-2 text-sm bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-4 py-2.5 rounded-xl font-semibold transition-colors">
          Create free account <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 text-sm bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 px-4 py-2.5 rounded-xl font-semibold border border-white/[0.06] transition-colors">
          Open Dashboard
        </Link>
      </div>
    </section>
  );
}
