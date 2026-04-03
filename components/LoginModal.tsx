'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, X, Loader2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, setRememberMe } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import NakaLogo from '@/components/NakaLogo';

interface LoginModalProps {
  onClose: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        if (error.message?.toLowerCase().includes('unsupported provider') || error.message?.toLowerCase().includes('not enabled')) {
          showToast('Google sign-in is not available yet. Please use email/password.', 'error');
        } else {
          showToast('Google sign-in failed. Try again.', 'error');
        }
        return;
      }
      if (data?.url) {
        try {
          const testRes = await fetch(data.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => null);
          window.location.href = data.url;
        } catch {
          window.location.href = data.url;
        }
      }
    } catch {
      showToast('Google sign-in failed. Try again.', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setRememberMe(true);
    try {
      let email = identifier.trim();
      if (!email.includes('@')) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('username', email.toLowerCase()).maybeSingle();
        if (!profile?.email) {
          showToast('No account found with that username.', 'error');
          setErrors({ identifier: 'Username not found' });
          setLoading(false);
          return;
        }
        email = profile.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          showToast('Check your email and click the confirmation link first.', 'error');
        } else if (error.message.toLowerCase().includes('invalid')) {
          setErrors({ password: 'Incorrect email/username or password' });
        } else {
          showToast(error.message || 'Sign in failed.', 'error');
        }
        return;
      }
      if (typeof window !== 'undefined') localStorage.setItem('naka_has_session', 'true');
      showToast('Welcome back!', 'success');
      onClose();
      router.push('/dashboard');
    } catch {
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm bg-[#111827] border border-white/[0.1] rounded-2xl shadow-2xl p-6 animate-fade-slide-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <NakaLogo size={28} />
          <span className="text-sm font-bold tracking-tight">NAKA LABS</span>
        </div>

        <h2 className="text-xl font-bold mb-1">Login</h2>
        <p className="text-sm text-gray-400 mb-5">
          Don&apos;t have an account?{' '}
          <Link href="/signup" onClick={onClose} className="text-[#0A1EFF] hover:underline font-medium">Sign Up</Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setErrors({}); }}
                className={`w-full bg-white/[0.04] border ${errors.identifier ? 'border-red-500/60' : 'border-white/[0.1]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors`}
                placeholder="email@site.com"
                autoComplete="username"
                autoFocus
              />
            </div>
            {errors.identifier && <p className="text-red-400 text-[11px] mt-1">{errors.identifier}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">Password</label>
              <Link href="/forgot-password" onClick={onClose} className="text-xs text-[#0A1EFF] hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors({}); }}
                className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/60' : 'border-white/[0.1]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-[11px] mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Continue'}
          </button>
        </form>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
        >
          {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>
      </div>
    </div>
  );
}
