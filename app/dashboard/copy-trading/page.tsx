'use client';

import { Users, Bell, ArrowRight, Copy } from 'lucide-react';

export default function CopyTradingPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-[#10B981] to-[#00E5FF] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Copy className="w-12 h-12" />
        </div>

        <div className="inline-block px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full mb-6">
          <span className="text-[#F59E0B] text-sm font-semibold">COMING SOON</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">
          Copy Trading Protocol
        </h1>

        <p className="text-xl text-gray-300 mb-12 leading-relaxed max-w-2xl mx-auto">
          Automatically mirror the trades of proven whale wallets and top traders. Set it and forget it - let the pros trade for you.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12 text-left">
          {[
            { title: 'Follow Top Whales', desc: 'Copy wallets with proven track records. Filter by win rate, total profit, and trading style.' },
            { title: 'Instant Execution', desc: "Trades execute within seconds of the whale's transaction. No manual work required." },
            { title: 'Custom Settings', desc: 'Set allocation amounts, stop-loss limits, and risk parameters for each trader you copy.' },
            { title: 'Non-Custodial', desc: 'Your funds stay in your wallet. We never have access to your private keys.' },
          ].map((f) => (
            <div key={f.title} className="glass rounded-xl p-6 border border-white/10">
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-8 border border-white/10 mb-8">
          <h3 className="font-bold text-2xl mb-6">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { step: '1', title: 'Choose Trader', desc: 'Browse verified traders, filter by performance, and select who to copy' },
              { step: '2', title: 'Set Allocation', desc: 'Decide how much to allocate and configure risk settings' },
              { step: '3', title: 'Auto-Pilot', desc: 'System automatically mirrors their trades in real-time' },
            ].map((s) => (
              <div key={s.step}>
                <div className="w-10 h-10 bg-[#00E5FF]/20 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-[#00E5FF] font-bold">{s.step}</span>
                </div>
                <h4 className="font-semibold mb-2">{s.title}</h4>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-[#00E5FF]/30 max-w-md mx-auto">
          <Bell className="w-8 h-8 text-[#00E5FF] mx-auto mb-4" />
          <h3 className="font-bold text-xl mb-3">Get Early Access</h3>
          <p className="text-sm text-gray-400 mb-4">
            Copy Trading launches next month for Max tier users. Join the waitlist now.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#00E5FF]/50 text-sm"
            />
            <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform">
              Join Waitlist
            </button>
          </div>
        </div>

        <div className="mt-8">
          <a href="/dashboard/pricing">
            <button className="glass px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors inline-flex items-center gap-2">
              Upgrade to Max Tier <ArrowRight className="w-4 h-4" />
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
