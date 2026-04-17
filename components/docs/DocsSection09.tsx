import { BarChart3, Wallet, TrendingUp, Target, BookOpen } from 'lucide-react';

const PORTFOLIO_FEATURES = [
  { title: 'Multi-wallet sync', desc: 'Add up to 25 wallets across any supported chain. Holdings and balances sync automatically without manual input.' },
  { title: 'USD P&L tracking', desc: 'Real-time profit and loss in USD, with historical charting so you can see how your portfolio has changed over time.' },
  { title: 'Chain breakdown', desc: 'See your exposure split by chain — how much value you hold on Ethereum vs Solana vs Base, etc.' },
  { title: 'Token history', desc: 'Full history of every token you\'ve held, including entry price, exit price, and realized gain/loss.' },
  { title: 'Risk exposure', desc: 'Portfolio-level concentration risk — what percentage of your capital is in a single token, sector, or chain.' },
];

const PREDICTION_MECHANICS = [
  { step: '1', title: 'Browse markets', desc: 'View open prediction questions — price targets, protocol milestones, on-chain events.' },
  { step: '2', title: 'Stake your position', desc: 'Stake tokens on the YES or NO side. Staking size is your conviction — larger stakes mean larger potential payout.' },
  { step: '3', title: 'Market resolves', desc: 'When the event occurs (or the time window closes), the market resolves on-chain and winners claim their rewards.' },
];

export function DocsSection09() {
  return (
    <section id="portfolio" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">09</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Portfolio & Analytics</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        A unified portfolio view across every chain and wallet you own — with real-time USD values, P&L tracking, risk metrics, and access to on-chain prediction markets.
      </p>

      {/* Portfolio Tracker */}
      <div id="portfolio-tracker" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#0A1EFF]" />Portfolio Tracker
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Connect any number of wallets by address (no private keys required) and get a unified view of your holdings across all supported chains. The tracker auto-syncs with live price data so your portfolio value is always current.
        </p>
        <div className="space-y-2 mb-6">
          {PORTFOLIO_FEATURES.map(f => (
            <div key={f.title} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <BarChart3 className="w-3.5 h-3.5 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">{f.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#10B981]/[0.05] border border-[#10B981]/20 rounded-xl p-3">
          <p className="text-xs text-gray-400">
            <span className="text-[#10B981] font-semibold">Privacy first:</span> Portfolio tracking is read-only. You provide only a wallet address — no private keys, no seed phrases, no signing. Your funds are never at risk from the tracking feature.
          </p>
        </div>
      </div>

      {/* Prediction Markets */}
      <div id="predictions" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#8B5CF6]" />Prediction Markets
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Create or participate in on-chain prediction markets for crypto events — price targets, protocol achievements, or market milestones. Outcomes resolve on-chain with verifiable data.
        </p>
        <div className="space-y-2 mb-5">
          {PREDICTION_MECHANICS.map(s => (
            <div key={s.step} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#8B5CF6]">{s.step}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Research Lab */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-semibold text-white">Research Lab</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          In-depth protocol analysis, sector reports, and on-chain thesis write-ups. The Research Lab houses NAKA LABS original research and allows Pro users to submit their own findings for community review.
        </p>
      </div>
    </section>
  );
}
