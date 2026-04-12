'use client';

import { useState } from 'react';
import { X, Mail, Chrome, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setError('Check your email for confirmation link!');
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
      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('Please install MetaMask to connect your wallet');
      }

      // Request wallet connection
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      });

      const walletAddress = accounts[0];

      // Sign message for verification
      const message = `Sign this message to authenticate with STEINZ\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress]
      });

      // Create or get user
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (!existingUser) {
        await supabase.from('users').insert({
          wallet_address: walletAddress,
          username: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        });
      }

      // Store wallet in localStorage
      localStorage.setItem('wallet_address', walletAddress);
      localStorage.setItem('wallet_signature', signature);

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0A0E1A] border border-white/10 rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 mb-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#00E5FF]/50"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#00E5FF]/50"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Mail className="w-5 h-5" />
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-sm text-gray-400">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10"
          >
            <Chrome className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            onClick={handleWalletConnect}
            disabled={loading}
            className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="text-center text-sm">
          <span className="text-gray-400">
            {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-[#00E5FF] font-semibold hover:underline"
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
