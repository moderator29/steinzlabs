'use client';

import { useState } from 'react';
import { Users, Bell, ArrowRight, MessageCircle, Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const PANEL_GLOW = { boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' };

export default function CommunityPage() {
  return (
    <div className="min-h-screen text-white pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-[#7C3AED] to-[#0066FF] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Users className="w-12 h-12" />
        </div>

        <div className="inline-block px-4 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full mb-6">
          <span className="text-[#F59E0B] text-sm font-semibold">COMING SOON</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">
          Naka Community Dashboard
        </h1>

        <p className="text-xl text-gray-300 mb-12 leading-relaxed max-w-2xl mx-auto">
          Connect with thousands of on-chain traders. Share strategies, discuss signals, and learn from the best in the game.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12 text-start">
          <div className="nl-card rounded-xl p-6">
            <MessageCircle className="w-10 h-10 text-[#0066FF] mb-3" />
            <h3 className="font-bold text-lg mb-2">Live Discussions</h3>
            <p className="text-sm text-gray-400">
              Real-time chat channels for different chains, strategies, and topics
            </p>
          </div>

          <div className="nl-card rounded-xl p-6">
            <Trophy className="w-10 h-10 text-[#FFD700] mb-3" />
            <h3 className="font-bold text-lg mb-2">Leaderboards</h3>
            <p className="text-sm text-gray-400">
              Compete with other traders and climb the ranks based on prediction accuracy
            </p>
          </div>

          <div className="nl-card rounded-xl p-6">
            <TrendingUp className="w-10 h-10 text-[#10B981] mb-3" />
            <h3 className="font-bold text-lg mb-2">Signal Sharing</h3>
            <p className="text-sm text-gray-400">
              Share and discover trading signals with reputation-weighted visibility
            </p>
          </div>
        </div>

        <div className="nl-glass rounded-2xl p-8 max-w-md mx-auto" style={PANEL_GLOW}>
          <Bell className="w-8 h-8 text-[#0066FF] mx-auto mb-4" />
          <h3 className="font-bold text-xl mb-3">Join the Waitlist</h3>
          <p className="text-sm text-gray-400 mb-4">
            Be among the first to access the NAKA community when it launches.
          </p>
          <WaitlistForm feature="community" />
        </div>

        <div className="mt-8">
          <a href="/dashboard/pricing">
            <button className="nl-button inline-flex items-center gap-2">
              View Pricing <ArrowRight className="w-4 h-4" />
            </button>
          </a>
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
    return <p className="text-green-400 text-sm">You are on the waitlist. We will notify you when this launches.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="flex-1 nl-glass rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/50"
      />
      <button type="submit" disabled={loading} className="nl-btn-neon px-6 py-3">
        Notify Me
      </button>
    </form>
  );
}
