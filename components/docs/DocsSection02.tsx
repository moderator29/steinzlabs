import { Globe, Layers, BarChart3, ShieldCheck, Repeat, Star } from 'lucide-react';

const CHAINS = [
  { name: 'Ethereum', symbol: 'ETH', color: '#627EEA' },
  { name: 'Solana', symbol: 'SOL', color: '#9945FF' },
  { name: 'Base', symbol: 'BASE', color: '#0052FF' },
  { name: 'Arbitrum', symbol: 'ARB', color: '#12AAFF' },
  { name: 'Polygon', symbol: 'MATIC', color: '#8247E5' },
  { name: 'BSC', symbol: 'BNB', color: '#F3BA2F' },
  { name: 'Optimism', symbol: 'OP', color: '#FF0420' },
  { name: 'Avalanche', symbol: 'AVAX', color: '#E84142' },
  { name: 'Sui', symbol: 'SUI', color: '#6FBCF0' },
  { name: 'TON', symbol: 'TON', color: '#0088CC' },
  { name: 'More coming', symbol: '+', color: '#6B7280' },
];

const FEATURE_GROUPS = [
  {
    icon: Layers, color: '#0A1EFF', title: 'Intelligence Layer',
    features: ['Context Feed — real-time on-chain signal stream', 'VTX AI Engine — natural language on-chain analyst', 'Trading DNA Analyzer — complete wallet behavioral profiles', 'Wallet Intelligence — automatic wallet classification', 'On-Chain Trends — momentum and narrative detection'],
  },
  {
    icon: ShieldCheck, color: '#10B981', title: 'Security Layer',
    features: ['Token Trust Score — 0–100 risk assessment', 'Shadow Guardian — pre-trade honeypot simulation', 'Contract Analyzer — AI-powered bytecode analysis', 'Domain Shield — real-time phishing detection', 'Approval Manager — token permission risk audit'],
  },
  {
    icon: Repeat, color: '#F59E0B', title: 'Trading Layer',
    features: ['Multi-Chain Swap — DEX aggregation on 6+ chains', 'Copy Trading — one-click wallet mirroring', 'Sniper Bot — automated launch detection with safety', 'Trading Suite — advanced orders and P&L tracking', 'Limit Orders — price-conditional trade execution'],
  },
  {
    icon: BarChart3, color: '#8B5CF6', title: 'Analytics Layer',
    features: ['Portfolio Tracker — multi-wallet auto-sync', 'Prediction Markets — on-chain position staking', 'Smart Money Tracking — elite wallet watchlists', 'Whale Tracker — large movement monitoring', 'Research Lab — deep-dive protocol reports'],
  },
];

const TIERS = [
  { name: 'Free', color: '#6B7280', perks: ['Context Feed (limited)', 'Basic wallet lookup', 'Token Trust Score', '10 alerts', '5 wallets tracked'] },
  { name: 'Pro', color: '#0A1EFF', perks: ['Full Context Feed', 'VTX AI Engine', 'DNA Analyzer', 'Copy Trading', '50 alerts', '25 wallets', 'Advanced security'] },
  { name: 'Enterprise', color: '#F59E0B', perks: ['Everything in Pro', 'Unlimited wallets', 'Sniper Bot access', 'Priority data feeds', 'Dedicated support'] },
];

export function DocsSection02() {
  return (
    <section id="platform-overview" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">02</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Platform Overview</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        STEINZ LABS is built in four integrated layers — Intelligence, Security, Trading, and Analytics — all unified in one dashboard. It pulls from 15+ blockchain data sources and uses AI to surface what matters, when it matters.
      </p>

      <div id="overview-features" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4">Feature Categories</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURE_GROUPS.map(({ icon: Icon, color, title, features }) => (
            <div key={title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] transition-colors">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-sm font-semibold text-white">{title}</span>
              </div>
              <ul className="space-y-1.5">
                {features.map(f => (
                  <li key={f} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0 mt-1.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div id="overview-chains" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#0A1EFF]" />Supported Chains
        </h3>
        <div className="flex flex-wrap gap-2">
          {CHAINS.map(c => (
            <div key={c.name} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="text-xs font-semibold text-gray-300">{c.symbol}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-[#F59E0B]" />Subscription Tiers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIERS.map(t => (
            <div key={t.name} className="bg-white/[0.02] rounded-xl p-4 border" style={{ borderColor: t.color + '30' }}>
              <div className="text-sm font-bold mb-3" style={{ color: t.color }}>{t.name}</div>
              <ul className="space-y-1.5">
                {t.perks.map(p => (
                  <li key={p} className="text-xs text-gray-400 flex items-start gap-1.5">
                    <span style={{ color: t.color }} className="flex-shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
