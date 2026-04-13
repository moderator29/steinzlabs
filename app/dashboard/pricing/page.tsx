'use client';

import { Check, ArrowLeft, Lock, Zap, Shield, Brain, TrendingUp, BarChart3, Fish, Copy, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TIERS = [
  {
    name: 'Mini',
    price: '$6',
    period: '/month',
    description: 'Core intelligence for active traders',
    accent: '#10B981',
    popular: false,
    features: [
      'Context Feed — full signal stream',
      'Whale Tracker (all chains)',
      'Token Trust Score',
      'Shadow Guardian protection',
      'Basic wallet lookup',
      'On-Chain Trends',
      'VTX Agent (50 msgs/day)',
      '5 wallets tracked',
      '10 active alerts',
      'Swap trading',
    ],
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'Full intelligence suite for serious traders',
    accent: '#0A1EFF',
    popular: true,
    features: [
      'Everything in Mini, plus:',
      'Smart Money Tracker',
      'DNA Analyzer (wallet profiling)',
      'Copy Trading',
      'Wallet Clusters & Network Graph',
      'Contract Analyzer',
      'Domain Shield',
      'Approval Manager',
      'Research Lab access',
      'VTX Agent — unlimited',
      '25 wallets tracked',
      '50 active alerts',
      'Limit orders & stop loss',
      'Priority data feeds',
    ],
  },
  {
    name: 'Max',
    price: '$15',
    period: '/month',
    description: 'Everything + API access for power users',
    accent: '#F59E0B',
    popular: false,
    features: [
      'Everything in Pro, plus:',
      'API access (full platform)',
      'Sniper Bot (early access)',
      'Prediction Markets',
      'Historical data — 365 days',
      'Custom webhook alerts',
      'Unlimited wallets tracked',
      'Unlimited alerts',
      'Dedicated support',
      'Early access to new features',
      'Beta program participation',
    ],
  },
];

const FEATURE_HIGHLIGHTS = [
  { icon: Brain, label: 'VTX AI Engine', desc: 'Natural language on-chain analyst' },
  { icon: Fish, label: 'Whale Tracker', desc: 'Real human traders, 7+ chains' },
  { icon: Shield, label: 'Security Suite', desc: 'Trust scores, rug detection, contract analysis' },
  { icon: TrendingUp, label: 'Smart Money', desc: 'Track wallets that consistently win' },
  { icon: BarChart3, label: 'Analytics', desc: 'Portfolio, predictions, research' },
  { icon: Copy, label: 'Copy Trading', desc: 'One-click wallet mirroring' },
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <div className="text-sm font-bold">Pricing</div>
            <div className="text-[10px] text-gray-600">STEINZ LABS Plans</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-full text-xs text-[#4D6BFF] font-semibold mb-4">
            <Zap className="w-3 h-3" />
            Simple, Transparent Pricing
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Institutional Intelligence,<br />Accessible to Every Trader
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            All plans include real-time on-chain data, multi-chain support, and Shadow Guardian protection.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl">
            <Lock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-xs text-[#F59E0B] font-semibold">Beta pricing — locked in forever when you upgrade</span>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-5 transition-all ${
                tier.popular
                  ? 'border-[#0A1EFF]/50 bg-[#0A1EFF]/[0.04] ring-1 ring-[#0A1EFF]/20'
                  : 'border-white/[0.06] bg-[#0D1117]'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0A1EFF] text-white px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold" style={{ color: tier.accent }}>{tier.name}</span>
                </div>
                <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{tier.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{tier.price}</span>
                  <span className="text-sm text-gray-500">{tier.period}</span>
                </div>
              </div>

              <button
                className="w-full py-2.5 rounded-xl font-semibold text-sm mb-5 transition-all opacity-70 cursor-not-allowed"
                style={{
                  background: tier.popular ? '#0A1EFF' : tier.accent + '20',
                  color: tier.popular ? '#fff' : tier.accent,
                  border: `1px solid ${tier.accent}40`,
                }}
                disabled
              >
                Coming Soon
              </button>

              <ul className="space-y-2">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check
                      className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                      style={{ color: i === 0 && tier.name !== 'Mini' ? tier.accent : tier.accent }}
                    />
                    <span className={`text-xs leading-relaxed ${i === 0 && tier.name !== 'Mini' ? 'font-semibold text-white' : 'text-gray-400'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Feature Highlights */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-white mb-4 text-center">What's Included Across All Plans</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#4D6BFF]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compare note */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <Bell className="w-4 h-4 text-[#0A1EFF] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-white mb-1">Free tier available forever</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Get started with the free plan — Context Feed (limited), basic wallet lookup, Token Trust Score, 10 alerts, and 5 wallets tracked. Upgrade when you're ready for the full intelligence suite. Beta users lock in pricing for life.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-gray-600">
            All plans include 0.5% transaction fee on trades. Cancel anytime. No credit card required until payments launch.
          </p>
        </div>
      </div>
    </div>
  );
}
