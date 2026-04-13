'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, CandlestickChart, Clock, Lock, TrendingUp, TrendingDown, Target, Zap, BarChart3, RefreshCw, Bell, ArrowLeftRight, ChevronRight } from 'lucide-react';

const FEATURES = [
  {
    icon: CandlestickChart,
    title: 'Advanced Charting',
    desc: 'Professional TradingView-powered charts with 100+ indicators, drawing tools, multi-timeframe analysis, and custom alert zones.',
  },
  {
    icon: Target,
    title: 'Limit Orders & Stop Loss',
    desc: 'Set price-conditional buy and sell orders across all supported chains. Automatic stop-loss triggers to protect your positions.',
  },
  {
    icon: TrendingUp,
    title: 'DCA Bots',
    desc: 'Dollar-cost average into positions automatically. Configure buy frequency, amount, and token targets. Pause or stop anytime.',
  },
  {
    icon: RefreshCw,
    title: 'Auto-Rebalance',
    desc: 'Keep your portfolio at target allocations automatically. Set threshold triggers and the suite handles rebalancing trades for you.',
  },
  {
    icon: BarChart3,
    title: 'P&L Tracking',
    desc: 'Complete trade history with realized and unrealized P&L per position. Export reports for tax purposes with full transaction detail.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Price alerts, volume spikes, moving average crossovers, and RSI threshold notifications delivered via push or Telegram.',
  },
];

const COMING_INTEGRATIONS = [
  { name: 'Uniswap V4', color: '#FF007A' },
  { name: 'Jupiter', color: '#9945FF' },
  { name: 'PancakeSwap', color: '#F3BA2F' },
  { name: 'Curve', color: '#3498DB' },
  { name: '1inch', color: '#1B314F' },
  { name: 'Orca', color: '#00C2D4' },
];

export default function TradingSuitePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#8B5CF6] rounded-xl flex items-center justify-center">
            <CandlestickChart className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Trading Suite</div>
            <div className="text-[10px] text-gray-600">Advanced trading tools</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-full text-xs text-[#4D6BFF] font-semibold mb-5">
            <Clock className="w-3 h-3" />
            Coming Soon — Pro & Max Plans
          </div>

          <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#8B5CF6]/20 border border-[#0A1EFF]/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <CandlestickChart className="w-10 h-10 text-[#4D6BFF]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Trading Suite</h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
            Professional-grade trading tools with advanced charting, automated strategies, and full P&L tracking across all supported chains.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-gray-400">
              <Lock className="w-3.5 h-3.5" />
              Requires Pro or Max plan
            </div>
            <button
              onClick={() => router.push('/dashboard/swap')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-xl text-xs text-[#4D6BFF] hover:bg-[#0A1EFF]/20 transition-colors font-semibold"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Use Swap in the meantime
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#0A1EFF]" />
            What&apos;s Coming
          </h2>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] transition-colors">
                <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#4D6BFF]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white mb-0.5">{title}</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DEX Integrations */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-8">
          <div className="text-xs font-semibold text-white mb-3">DEX Integrations at Launch</div>
          <div className="flex flex-wrap gap-2">
            {COMING_INTEGRATIONS.map(c => (
              <div key={c.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="text-xs text-gray-300">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Use Swap CTA */}
        <div className="bg-[#0A1EFF]/[0.06] border border-[#0A1EFF]/20 rounded-2xl p-5 flex items-start gap-3">
          <ArrowLeftRight className="w-4 h-4 text-[#4D6BFF] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-white mb-1">Basic Swap available now</div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
              Multi-chain swap with DEX aggregation is available today. Access it from the Swap page while the full Trading Suite is being built.
            </p>
            <button
              onClick={() => router.push('/dashboard/swap')}
              className="text-xs px-3 py-1.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 text-[#4D6BFF] rounded-lg hover:bg-[#0A1EFF]/20 transition-colors font-semibold"
            >
              Open Swap →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
