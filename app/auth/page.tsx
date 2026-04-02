'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Shield, Zap, Eye, TrendingUp, ArrowLeft, Check } from 'lucide-react';
import NakaLogo from '@/components/NakaLogo';
import Link from 'next/link';

export default function AuthPage() {
  const { login, authenticated, ready, user } = usePrivy();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);

  useEffect(() => {
    if (authenticated && user && !sessionCreated) {
      createServerSession();
    }
  }, [authenticated, user, sessionCreated]);

  const createServerSession = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const privyToken = localStorage.getItem('privy:token') || '';
      await fetch('/api/auth/privy-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyToken }),
      });
      setSessionCreated(true);
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    login();
  };

  const benefits = [
    { icon: Eye, text: "Real-time whale movement tracking" },
    { icon: TrendingUp, text: "Trading DNA analysis (AI-powered)" },
    { icon: Shield, text: "Token security scanner & risk scoring" },
    { icon: Zap, text: "Priority on-chain signals & alerts" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-[#0A1EFF]/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-[#7C3AED]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative">
        <Link href="/" className="flex items-center gap-2.5">
          <NakaLogo size={32} />
          <span className="text-base font-bold tracking-tight">NAKA LABS</span>
        </Link>

        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full mb-6">
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            <span className="text-[12px] text-gray-400 font-medium">Live on 12+ blockchains</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            The intelligence layer<br />
            <span className="text-[#0A1EFF]">for on-chain alpha</span>
          </h1>

          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Join thousands of analysts using Naka Labs to track whale movements, analyze trading patterns, and act on real blockchain data before the crowd.
          </p>

          <div className="space-y-4">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0A1EFF]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#0A1EFF]" />
                  </div>
                  <span className="text-sm text-gray-300">{b.text}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/[0.06]">
            <p className="text-xs text-gray-500 mb-3">Trusted by analysts on</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>Ethereum</span>
              <span>·</span>
              <span>Solana</span>
              <span>·</span>
              <span>BSC</span>
              <span>·</span>
              <span>Base</span>
              <span>·</span>
              <span>Arbitrum</span>
              <span>+7 more</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600">&copy; 2026 Naka Labs. Powered by $NAKA.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-between mb-10">
            <Link href="/" className="flex items-center gap-2">
              <NakaLogo size={28} />
              <span className="text-sm font-bold">NAKA LABS</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>

          <div className="hidden lg:flex justify-end mb-8">
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </Link>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
                <Shield className="w-7 h-7 text-[#0A1EFF]" />
              </div>
              <h2 className="text-xl font-bold mb-1">Sign in to Naka Labs</h2>
              <p className="text-gray-500 text-sm">Access your intelligence dashboard</p>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={handleLogin}
                disabled={!ready || loading}
                className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5"
              >
                <Shield className="w-4 h-4" />
                {loading ? 'Signing in...' : !ready ? 'Loading...' : 'Continue with Email / Wallet'}
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-500 mb-6">
              Sign in with email, Google, Twitter, or connect your wallet
            </p>

            <div className="space-y-2 pt-4 border-t border-white/[0.06]">
              {[
                "Non-custodial — your keys, your crypto",
                "Read-only blockchain data access",
                "Secured by Privy",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2 text-[11px] text-gray-500">
                  <Check className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-4">
            By continuing, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Terms of Service</span>
            {' '}and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
