'use client';

import { useState } from 'react';
import { Users, Copy, TrendingUp, Shield, Award, BarChart3, Signal, UserCheck, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const PLANNED_FEATURES = [
  {
    icon: Copy,
    title: 'Copy Trading',
    description: 'Automatically mirror trades from top-performing traders in real-time. Set your own risk limits, position sizes, and stop-losses while following proven strategies.',
    color: '#0A1EFF',
  },
  {
    icon: Signal,
    title: 'Signal Sharing',
    description: 'Share and receive trading signals with the community. Get notified when top traders open positions, with full transparency on entry, exit, and reasoning.',
    color: '#7C3AED',
  },
  {
    icon: UserCheck,
    title: 'Trader Profiles',
    description: 'Build your on-chain trading reputation. Verified performance stats, win rates, PnL history, and strategy breakdowns, all backed by real blockchain data.',
    color: '#10B981',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    description: 'Compete for the top spot on weekly, monthly, and all-time leaderboards. Earn badges, unlock rewards, and gain followers as you climb the ranks.',
    color: '#F59E0B',
  },
  {
    icon: Shield,
    title: 'Risk Management',
    description: 'Built-in risk controls for copy trading. Set max allocation per trade, daily loss limits, and auto-pause when drawdown thresholds are hit.',
    color: '#EF4444',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Deep analytics on every trader. Sharpe ratio, max drawdown, average hold time, best/worst trades, and strategy consistency scores.',
    color: '#06B6D4',
  },
];

export default function SocialTradingPage() {
  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">Social Trading</h1>
            <p className="text-xs text-gray-400">Follow and copy top traders</p>
          </div>
        </div>

        <div className="relative glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A1EFF]/5 via-transparent to-[#7C3AED]/5" />
          <div className="relative p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-white/10">
              <Users className="w-9 h-9 text-[#0A1EFF]" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full border border-[#0A1EFF]/30 mb-4">
              <div className="w-2 h-2 bg-[#0A1EFF] rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-[#0A1EFF]">Coming Soon</span>
            </div>
            <h2 className="text-2xl font-heading font-bold mb-3 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] bg-clip-text text-transparent">
              Social Trading is Coming
            </h2>
            <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
              We&apos;re building the most powerful social trading platform in crypto. Copy top traders, share signals, compete on leaderboards, and build your on-chain trading reputation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANNED_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${feature.color}15`, border: `1px solid ${feature.color}30` }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold mb-1.5 group-hover:text-white transition-colors">{feature.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass rounded-xl p-6 border border-white/10 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#0A1EFF]">Q3</div>
              <div className="text-[10px] text-gray-400">2025</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Estimated Launch</div>
              <div className="text-sm font-semibold">Private Beta</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Social Trading will launch first to NAKA private beta members. Stay tuned for early access announcements.
          </p>
          <WaitlistForm feature="social-trading" />
        </div>
      </div>
    </div>
  );
}

function WaitlistForm({ feature }: { feature: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    try {
      await supabase.from('waitlist').insert({ email: email.trim().toLowerCase(), feature, created_at: new Date().toISOString() });
      setSubmitted(true);
      toast.success('You\'re on the waitlist!');
    } catch (err) {
      console.error('[Waitlist] Submit failed:', err instanceof Error ? err.message : err);
      toast.error('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return <p className="text-green-400 text-sm mt-4">You are on the waitlist. We will notify you when this launches.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4 max-w-sm mx-auto">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="flex-1 bg-[#141824] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50"
      />
      <button type="submit" disabled={loading}
        className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
        Notify Me
      </button>
    </form>
  );
}
