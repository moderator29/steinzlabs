'use client';

import { useState } from 'react';
import { Check, ArrowLeft, Star, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth, effectiveTier } from '@/lib/hooks/useAuth';
import { TierBadge } from '@/components/ui/TierBadge';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started with on-chain intelligence',
    accent: '#6B7280',
    popular: false,
    features: [
      '25 VTX AI messages per day',
      'Basic wallet intelligence (EVM only)',
      '3 price alerts',
      'Standard swap (0.4% fee)',
      'Access to market data and charts',
      'Basic security scanner',
      '1 connected wallet',
    ],
  },
  {
    id: 'mini',
    name: 'Mini',
    price: '$5',
    period: '/month',
    description: 'More power for active traders',
    accent: '#10B981',
    popular: false,
    features: [
      '100 VTX AI messages per day',
      'Full wallet intelligence (all chains)',
      '10 price alerts',
      'Standard swap',
      'Whale tracker (view only)',
      'DNA Analyzer',
      '3 connected wallets',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'Full platform access for serious traders',
    accent: '#0A1EFF',
    popular: true,
    features: [
      'Unlimited VTX AI messages',
      'All features unlocked',
      '50 price alerts',
      'Gasless swaps on EVM',
      'Copy trading',
      'Smart money tracking',
      'Advanced security tools',
      'Wallet clusters',
      'Bubble map',
      '10 connected wallets',
      'Priority email support',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '$15',
    period: '/month',
    description: 'Everything, including the Sniper Bot',
    accent: '#F59E0B',
    popular: false,
    features: [
      'Everything in Pro',
      'Sniper Bot access',
      'Real-time sniper alerts',
      'Advanced sniper configuration',
      'Unlimited connected wallets',
      'Priority support with fastest response',
      'Early access to new features',
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentPlan = effectiveTier(user);

  const handleSubscribe = (tierId: string) => {
    if (tierId === 'free') return;
    toast.info('Crypto payment integration coming soon. Join our waitlist at support@nakalabs.com');
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="sticky top-0 z-10 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <span className="text-white font-semibold">Pricing</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-12 pb-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Choose Your Plan</h1>
          <p className="text-gray-400 text-lg">Professional on-chain intelligence. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(tier => {
            const isCurrent = currentPlan === tier.id;
            return (
              <div
                key={tier.id}
                className={`relative bg-[#141824] rounded-2xl border p-5 flex flex-col ${
                  tier.popular
                    ? 'border-[#0A1EFF] shadow-lg shadow-[#0A1EFF]/10'
                    : 'border-[#1E2433]'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#0A1EFF] text-white text-xs font-bold px-3 py-1 rounded-full">
                    <Star size={10} /> Most Popular
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    Current
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: tier.accent }}>{tier.name}</span>
                    {/* Inline tier badge — same SVG users see beside their display
                        name once they subscribe, so they know exactly what they're
                        getting. Free tier renders nothing. */}
                    <TierBadge tier={tier.id} size={16} title={`${tier.name} verified mark`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    <span className="text-gray-500 text-sm">{tier.period}</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">{tier.description}</p>
                </div>

                <div className="flex-1 space-y-2 mb-5">
                  {tier.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={12} className="mt-0.5 shrink-0" style={{ color: tier.accent }} />
                      <span className="text-gray-300 text-xs">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={isCurrent || tier.id === 'free'}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                    isCurrent
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                      : tier.id === 'free'
                      ? 'bg-[#1E2433] text-gray-500 cursor-default'
                      : tier.popular
                      ? 'bg-[#0A1EFF] hover:bg-[#0916CC] text-white'
                      : 'border text-white hover:bg-white/5 transition-colors'
                  }`}
                  style={!isCurrent && tier.id !== 'free' && !tier.popular ? { borderColor: tier.accent, color: tier.accent } : {}}
                >
                  {isCurrent ? 'Current Plan' : tier.id === 'free' ? 'Free Forever' : `Get ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
            <Zap size={12} className="text-yellow-400" />
            Crypto payment integration coming soon. Join our waitlist for early access.
          </p>
        </div>

        <div className="mt-12 bg-[#141824] rounded-2xl border border-[#1E2433] p-6">
          <h2 className="text-white font-bold text-xl mb-4">All plans include</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'Non-custodial wallet',
              'Real-time market data',
              'Mobile-optimized interface',
              'Multi-chain support',
              'Email support',
              'Automatic security scanning',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check size={14} className="text-green-400 shrink-0" />
                <span className="text-gray-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
