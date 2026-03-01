'use client';

import { Users, Copy, MessageCircle, Crown, Star, TrendingUp, Clock, Shield, Eye, Heart } from 'lucide-react';
import Link from 'next/link';

export default function SocialTradingPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6">
        <div className="glass rounded-2xl p-6 border border-[#7C3AED]/20 bg-gradient-to-br from-[#7C3AED]/5 to-transparent text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#7C3AED]/30">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-2">Social Trading</h1>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
            Follow top traders, copy their strategies in real-time, and build your reputation. The future of collaborative trading is almost here.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full">
            <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-xs text-[#F59E0B] font-semibold">Coming Soon</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { icon: Copy, title: 'Copy Trading', desc: 'Mirror top performers automatically', color: 'text-[#00E5FF]' },
            { icon: Crown, title: 'Leaderboards', desc: 'Compete and climb the ranks', color: 'text-[#F59E0B]' },
            { icon: TrendingUp, title: 'Track Records', desc: 'Verified on-chain performance', color: 'text-[#10B981]' },
            { icon: Shield, title: 'Risk Controls', desc: 'Set limits on every copy trade', color: 'text-[#7C3AED]' },
          ].map((f, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/5 text-center">
              <f.icon className={`w-6 h-6 mx-auto mb-2 ${f.color}`} />
              <div className="text-xs font-bold mb-1">{f.title}</div>
              <div className="text-[9px] text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-xl p-4 border border-white/5 mb-4">
          <div className="text-xs font-bold mb-3">What to Expect</div>
          <div className="space-y-3">
            {[
              { label: 'Create your trader profile', desc: 'Showcase your strategy, risk level, and track record' },
              { label: 'Follow and copy top traders', desc: 'Automatically mirror trades with custom allocation' },
              { label: 'Compete on leaderboards', desc: 'Weekly, monthly, and all-time rankings by P&L' },
              { label: 'Earn from followers', desc: 'Revenue share when others copy your trades' },
              { label: 'Live trading streams', desc: 'Go live and trade with an audience watching' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[8px] font-bold">{i + 1}</span>
                </div>
                <div>
                  <div className="text-[10px] font-semibold">{item.label}</div>
                  <div className="text-[9px] text-gray-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link href="/dashboard/trading-suite">
          <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
            Explore Trading Suite Instead
          </button>
        </Link>
      </div>
    </div>
  );
}
