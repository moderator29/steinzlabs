'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Crosshair, Zap, Shield, Clock, Bell, Target, CheckCircle, Lock, TrendingUp, AlertTriangle } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Launch Detection',
    desc: 'Monitors mempool and contract deployment events in real time. Detects new token launches within milliseconds across Ethereum, Base, BSC, and Solana.',
  },
  {
    icon: Shield,
    title: 'Built-in Safety Filters',
    desc: 'Automatic honeypot simulation, liquidity lock verification, contract ownership renouncement check, and tax analysis before any trade is executed.',
  },
  {
    icon: Target,
    title: 'Precision Entry Configuration',
    desc: 'Set max buy amount, slippage tolerance, gas multiplier, minimum liquidity thresholds, and auto-sell multipliers for each chain separately.',
  },
  {
    icon: TrendingUp,
    title: 'Auto-Sell & Stop Loss',
    desc: 'Configure automatic profit-taking at custom multipliers and stop-loss triggers. Let the bot manage exits so you never miss a pump or ride a dump.',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    desc: 'Push alerts for every detected launch, safety scan result, entry execution, and exit. Full audit trail with transaction hashes and P&L per snipe.',
  },
  {
    icon: CheckCircle,
    title: 'Anti-MEV Protection',
    desc: 'Private transaction routing via Flashbots and private RPC endpoints to protect against front-running and sandwich attacks.',
  },
];

export default function SniperPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#F59E0B] to-[#EF4444] rounded-xl flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Sniper Bot</div>
            <div className="text-[10px] text-gray-600">Automated launch detection</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 max-w-2xl mx-auto">
        {/* Coming Soon Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full text-xs text-[#F59E0B] font-semibold mb-5">
            <Clock className="w-3 h-3" />
            Coming Soon — Max Plan Feature
          </div>

          <div className="w-20 h-20 bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 border border-[#F59E0B]/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Crosshair className="w-10 h-10 text-[#F59E0B]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Sniper Bot</h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
            Automated token launch detection with built-in safety scanning. Be first in, with full protection against honeypots and MEV attacks.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            Requires Max plan · Launching soon
          </div>
        </div>

        {/* Risk Notice */}
        <div className="bg-[#EF4444]/[0.06] border border-[#EF4444]/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-[#EF4444] mb-1">High Risk Feature</div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Sniper bots carry significant financial risk. New token launches are frequently scams, rugs, or honeypots. STEINZ LABS safety filters reduce but do not eliminate risk. Only use capital you can afford to lose entirely.
            </p>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            What&apos;s Coming
          </h2>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] transition-colors">
                <div className="w-8 h-8 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#F59E0B]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white mb-0.5">{title}</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Chains */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-8">
          <div className="text-xs font-semibold text-white mb-3">Supported Chains at Launch</div>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Ethereum', color: '#627EEA' },
              { name: 'Base', color: '#0052FF' },
              { name: 'BSC', color: '#F3BA2F' },
              { name: 'Solana', color: '#9945FF' },
              { name: 'Arbitrum', color: '#12AAFF' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="text-xs text-gray-300">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
