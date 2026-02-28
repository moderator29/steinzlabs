'use client';

import { Check, Zap, Crown, ArrowRight } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pt-32 pb-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full mb-6">
            <span className="text-[#00E5FF] text-sm font-semibold">PRIVATE BETA ACCESS</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">
            Join the Private Beta
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get early access to STEINZ with exclusive pricing. Limited spots available.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="glass rounded-2xl p-8 border border-white/10 hover:border-[#00E5FF]/30 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-bold">Pro</h3>
                <p className="text-sm text-gray-400">For active traders</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold">$2</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-sm text-[#00E5FF]">90% OFF - Beta Pricing</p>
              <p className="text-xs text-gray-400 line-through">Regular: $20/month</p>
            </div>

            <ul className="space-y-4 mb-8">
              {['Unlimited Context Feed events', 'Real-time whale tracking', 'VTX AI Assistant (50 queries/day)', 'Token safety scanner', 'Multi-chain portfolio tracking', 'Smart alerts & notifications', 'Community access'].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-4 rounded-xl font-semibold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
              Get Pro <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="glass rounded-2xl p-8 border-2 border-[#FFD700] relative hover:scale-105 transition-transform">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-1 rounded-full text-sm font-bold text-black">
              MOST POPULAR
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-bold">Max</h3>
                <p className="text-sm text-gray-400">For serious traders</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold">$6</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-sm text-[#FFD700]">88% OFF - Beta Pricing</p>
              <p className="text-xs text-gray-400 line-through">Regular: $50/month</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#FFD700] mt-0.5 flex-shrink-0" />
                <span className="text-white font-semibold">Everything in Pro, plus:</span>
              </li>
              {['Unlimited VTX AI queries', 'Predictions Market access', 'Copy Trading (Coming Soon)', 'Trading DNA Analyzer (Coming Soon)', 'Advanced charting & analytics', 'Priority support', 'API access'].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#FFD700] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black px-6 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
              Get Max <Crown className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-12 max-w-2xl mx-auto glass rounded-xl p-6 border border-[#00E5FF]/30 text-center">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-semibold text-[#00E5FF]">Beta users lock in this pricing forever.</span> Price increases to regular rates after beta ends. No credit card required during beta - pay with crypto only. Cancel anytime.
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Compare Features</h2>
          <div className="glass rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-sm text-gray-400 font-normal">Feature</th>
                  <th className="text-center p-4 text-sm font-semibold">Pro</th>
                  <th className="text-center p-4 text-sm font-semibold">Max</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Context Feed Events', pro: true, max: true },
                  { feature: 'VTX AI Queries', pro: '50/day', max: 'Unlimited' },
                  { feature: 'Predictions Market', pro: false, max: true },
                  { feature: 'Copy Trading', pro: false, max: 'Coming Soon' },
                  { feature: 'Trading DNA Report', pro: false, max: 'Coming Soon' },
                  { feature: 'API Access', pro: false, max: true },
                ].map((row, i) => (
                  <tr key={i} className={i < 5 ? 'border-b border-white/10' : ''}>
                    <td className="p-4 text-sm">{row.feature}</td>
                    <td className="p-4 text-center">
                      {row.pro === true ? <Check className="w-5 h-5 text-[#10B981] mx-auto" /> :
                       row.pro === false ? <span className="text-gray-500">&mdash;</span> :
                       <span className="text-sm">{row.pro}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {row.max === true ? <Check className="w-5 h-5 text-[#FFD700] mx-auto" /> :
                       row.max === false ? <span className="text-gray-500">&mdash;</span> :
                       row.max === 'Coming Soon' ? <span className="text-xs text-gray-400">Coming Soon</span> :
                       <span className="text-sm">{row.max}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
