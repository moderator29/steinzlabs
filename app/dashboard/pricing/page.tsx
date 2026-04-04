'use client';

import { Check, Zap, Crown, ArrowLeft, Star, Shield, Bot, TrendingUp, BarChart3, Target, Bell, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: '/forever',
      description: 'Get started with essential tools',
      accent: '#6B7280',
      features: [
        'Shadow Guardian protection',
        'Context Feed (live signals)',
        'Basic swap trading',
        '1 wallet',
        'VTX Agent (15 msgs/day)',
        '3 active alerts',
        'Security scanner',
      ],
      cta: 'Current Plan',
      ctaStyle: 'bg-[#1E2433] text-gray-400 cursor-default',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/month',
      description: 'For serious traders & analysts',
      accent: '#0A1EFF',
      features: [
        'Everything in Free, plus:',
        'View Proof intelligence reports',
        'Bubblemaps visualization',
        'Smart Money panel',
        'Deep holder analysis (top 20)',
        'Limit orders & stop loss',
        'DCA bots (3 active)',
        'Money Radar (follow 5 entities)',
        'Copy trading',
        'Auto-exit positions',
        '3 wallets',
        'Unlimited VTX Agent',
        '20 active alerts',
        'Real-time price feeds',
      ],
      cta: 'Coming Soon',
      ctaStyle: 'bg-[#0A1EFF] text-white',
      popular: true,
    },
    {
      name: 'Premium',
      price: '$99',
      period: '/month',
      description: 'Maximum intelligence & power',
      accent: '#F59E0B',
      features: [
        'Everything in Pro, plus:',
        'Elite holder analysis (top 50)',
        'Network graph analysis',
        'Historical data (365 days)',
        'Pattern matching & AI predictions',
        'Unlimited entity following',
        '10 wallets',
        '10 DCA bots',
        '100 active alerts',
        'Custom webhook alerts',
        'API access',
        'Priority support',
      ],
      cta: 'Coming Soon',
      ctaStyle: 'bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-black',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 h-14 max-w-6xl mx-auto">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold">Pricing</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Institutional-grade intelligence at accessible prices. All plans include Shadow Guardian protection.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl">
            <Lock className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm text-[#F59E0B] font-semibold">Payment integration launching soon</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 transition-all ${
                tier.popular
                  ? 'border-[#0A1EFF] bg-[#0A1EFF]/[0.03] scale-[1.02]'
                  : 'border-white/[0.06] bg-[#0D1117]'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0A1EFF] text-white px-4 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{tier.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-sm text-gray-500">{tier.period}</span>
                </div>
              </div>

              <button
                className={`w-full py-3 rounded-xl font-semibold text-sm mb-6 transition-all ${tier.ctaStyle}`}
                disabled
              >
                {tier.cta}
              </button>

              <ul className="space-y-3">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: i === 0 && tier.name !== 'Free' ? '#fff' : tier.accent }}
                    />
                    <span className={`text-xs ${i === 0 && tier.name !== 'Free' ? 'font-semibold text-white' : 'text-gray-400'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-2xl mx-auto text-center">
          <p className="text-xs text-gray-600">
            All plans include 0.5% transaction fee on trades. Beta users will lock in pricing forever.
            Cancel anytime. No credit card required until payments launch.
          </p>
        </div>
      </div>
    </div>
  );
}
