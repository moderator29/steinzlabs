'use client';

import { Users, Bell, ArrowRight, MessageCircle, Trophy, TrendingUp } from 'lucide-react';

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-[#7C3AED] to-[#00E5FF] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Users className="w-12 h-12" />
        </div>

        <div className="inline-block px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full mb-6">
          <span className="text-[#F59E0B] text-sm font-semibold">COMING SOON</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">
          Steinz Community Dashboard
        </h1>

        <p className="text-xl text-gray-300 mb-12 leading-relaxed max-w-2xl mx-auto">
          Connect with thousands of on-chain traders. Share strategies, discuss signals, and learn from the best in the game.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12 text-left">
          <div className="glass rounded-xl p-6 border border-white/10">
            <MessageCircle className="w-10 h-10 text-[#00E5FF] mb-3" />
            <h3 className="font-bold text-lg mb-2">Live Discussions</h3>
            <p className="text-sm text-gray-400">
              Real-time chat channels for different chains, strategies, and topics
            </p>
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <Trophy className="w-10 h-10 text-[#FFD700] mb-3" />
            <h3 className="font-bold text-lg mb-2">Leaderboards</h3>
            <p className="text-sm text-gray-400">
              Compete with other traders and climb the ranks based on prediction accuracy
            </p>
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <TrendingUp className="w-10 h-10 text-[#10B981] mb-3" />
            <h3 className="font-bold text-lg mb-2">Signal Sharing</h3>
            <p className="text-sm text-gray-400">
              Share and discover trading signals with reputation-weighted visibility
            </p>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-[#00E5FF]/30 max-w-md mx-auto">
          <Bell className="w-8 h-8 text-[#00E5FF] mx-auto mb-4" />
          <h3 className="font-bold text-xl mb-3">Join the Waitlist</h3>
          <p className="text-sm text-gray-400 mb-4">
            Be among the first to access the STEINZ community when it launches.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#00E5FF]/50 text-sm"
            />
            <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform">
              Notify Me
            </button>
          </div>
        </div>

        <div className="mt-8">
          <a href="/dashboard/pricing">
            <button className="glass px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors inline-flex items-center gap-2">
              View Pricing <ArrowRight className="w-4 h-4" />
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
