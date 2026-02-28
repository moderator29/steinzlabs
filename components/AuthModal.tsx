'use client';

import { useState } from 'react';
import { X, Mail, Chrome, Wallet, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signIn, signUp, connectWallet } = useAuth();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!email || !password) throw new Error('Please fill in all fields');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');

      if (mode === 'signup') {
        signUp(email, password);
        setSuccess('Account created successfully!');
        setTimeout(() => onSuccess(), 800);
      } else {
        signIn(email, password);
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
      signIn('demo@steinz.io', 'google-oauth');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleWalletConnect = async () => {
    setLoading(true);
    setError('');
    try {
      await connectWallet();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0A0E1A] border border-white/10 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-heading font-bold">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Access the full STEINZ platform</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-xs text-[#EF4444]">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg text-xs text-[#10B981]">{success}</div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
            <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00E5FF]/50 transition-colors" required />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00E5FF]/50 transition-colors pr-10" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-gray-500 uppercase">or continue with</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="space-y-2 mb-5">
          <button onClick={handleGoogleAuth} disabled={loading}
            className="w-full glass px-4 py-3 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10">
            <Chrome className="w-4 h-4" /> Google
          </button>
          <button onClick={handleWalletConnect} disabled={loading}
            className="w-full glass px-4 py-3 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10">
            <Wallet className="w-4 h-4" /> Connect Wallet
          </button>
        </div>

        <div className="text-center text-xs">
          <span className="text-gray-500">{mode === 'signin' ? "Don't have an account? " : "Already have an account? "}</span>
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
            className="text-[#00E5FF] font-semibold hover:underline">
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
