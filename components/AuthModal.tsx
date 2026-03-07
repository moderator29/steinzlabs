'use client';

import { useState } from 'react';
import { X, Mail, Chrome, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWallet } from '@/lib/hooks/useWallet';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { connectAuto, connecting: walletConnecting } = useWallet();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!supabase) throw new Error('Authentication service unavailable');

      if (mode === 'signup') {
        const signupRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const signupData = await signupRes.json();
        if (!signupRes.ok) throw new Error(signupData.error);

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error('Authentication service unavailable');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleWalletConnect = async () => {
    setLoading(true);
    setError('');

    try {
      await connectAuto();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#0B0D14] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#0B0D14]">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#00D4AA]/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#6366F1]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="absolute top-6 left-6 flex items-center gap-2.5">
        <img src="/naka-logo.svg" alt="NAKA" className="w-8 h-8" />
        <span className="text-base font-bold tracking-tight text-[#F9FAFB]">NAKA</span>
      </div>

      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-[#6B7280] hover:text-[#F9FAFB]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="relative max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F9FAFB] mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-[#6B7280]">
            {mode === 'signin' ? 'Sign in to access your dashboard' : 'Get started with on-chain intelligence'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-sm text-[#EF4444]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg text-sm text-[#22C55E]">
            {success}
          </div>
        )}

        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-[#F9FAFB] text-[#0B0D14] px-6 py-3 rounded-lg font-medium hover:bg-[#E5E7EB] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Chrome className="w-4 h-4" />
            Continue with Google
          </button>

          <button
            onClick={handleWalletConnect}
            disabled={loading}
            className="w-full bg-[#161822] text-[#F9FAFB] border border-[#232637] px-6 py-3 rounded-lg font-medium hover:bg-[#1C1F2E] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-[#232637]" />
          <span className="text-xs text-[#6B7280]">or continue with email</span>
          <div className="flex-1 h-px bg-[#232637]" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3 mb-6">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-[#161822] border border-[#232637] rounded-lg px-4 py-3 text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#00D4AA]/50 transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="w-full bg-[#161822] border border-[#232637] rounded-lg px-4 py-3 text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#00D4AA]/50 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#161822] border border-[#232637] text-[#F9FAFB] px-6 py-3 rounded-lg font-medium hover:bg-[#1C1F2E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-sm mb-6">
          <span className="text-[#6B7280]">
            {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
            className="text-[#00D4AA] font-medium hover:underline"
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        <p className="text-center text-[11px] text-[#6B7280]">
          By creating an account you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
