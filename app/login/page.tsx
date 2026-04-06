'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock, Check, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const SESSION_HOURS = 4;

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resending, setResending] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const verified = searchParams.get('verified');
    const err = searchParams.get('error');
    if (confirmed === 'pending') showToast('Account created! Check your email to verify, then sign in.', 'success');
    if (confirmed === 'reset') showToast('Password updated! Sign in with your new password.', 'success');
    if (verified === 'true') showToast('Email verified! Sign in below.', 'success');
    if (err) showToast('Verification link issue. Try resending below.', 'error');
  }, [searchParams, showToast]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResendVerification = async () => {
    if (resending || !verificationEmail) return;
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Verification email sent! Check your inbox and spam folder.', 'success');
      } else {
        showToast(data.error || 'Failed to resend. Try again.', 'error');
      }
    } catch {
      showToast('Failed to resend. Check your connection.', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setNeedsVerification(false);

    try {
      let email = identifier.trim();

      if (!email.includes('@')) {
        const res = await fetch('/api/auth/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email.toLowerCase() }),
        });
        const result = await res.json();
        if (!res.ok || !result.email) {
          showToast(result.error || 'No account found with that username.', 'error');
          setErrors({ identifier: 'Username not found' });
          return;
        }
        email = result.email;
      }

      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'EMAIL_NOT_CONFIRMED') {
          setNeedsVerification(true);
          setVerificationEmail(email);
          showToast('Please verify your email first.', 'error');
          setErrors({ identifier: 'Email not verified' });
          return;
        }
        showToast(data.error || 'Sign in failed.', 'error');
        if (res.status === 401) setErrors({ password: 'Incorrect credentials' });
        return;
      }

      if (!data.access_token) {
        showToast('Sign in failed. Please try again.', 'error');
        return;
      }

      try {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      } catch (sessionErr: any) {
        console.error('[Login] setSession failed:', sessionErr?.message);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('steinz_has_session', 'true');
        const maxAge = `; max-age=${60 * 60 * SESSION_HOURS}`;
        const isSecure = window.location.protocol === 'https:';
        document.cookie = `steinz_session=${data.access_token}; path=/; SameSite=Lax${maxAge}${isSecure ? '; Secure' : ''}`;
      }

      showToast('Welcome back!', 'success');
      router.push(searchParams.get('from') || '/dashboard');
    } catch (err: any) {
      console.error('[Login] unexpected error:', err?.message);
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        showToast('Connection error. Check your internet and try again.', 'error');
      } else {
        showToast(`Sign in failed: ${msg || 'Please try again.'}`, 'error');
      }
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-[#0A1EFF]/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-[#7C3AED]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-12 relative">
        <Link href="/" className="flex items-center gap-2.5">
          <SteinzLogo size={32} />
          <span className="text-base font-bold tracking-tight">STEINZ LABS</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">Welcome back to<br /><span className="text-[#0A1EFF]">STEINZ LABS</span></h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">Access your intelligence dashboard. Track whales, analyze wallets, and act on real blockchain data before the crowd.</p>
          <div className="space-y-3">
            {['Real-time on-chain intelligence', 'AI-powered trading analysis', 'Professional security scanning'].map(t => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0A1EFF]/10 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-[#0A1EFF]" /></div>
                <span className="text-sm text-gray-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 STEINZ LABS. All rights reserved.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2"><SteinzLogo size={28} /><span className="text-sm font-bold">STEINZ LABS</span></Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
              <Shield className="w-8 h-8 text-[#0A1EFF]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Sign in to your account</h2>
            <p className="text-gray-500 text-sm">Access your intelligence dashboard</p>
          </div>

          {needsVerification && (
            <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 text-sm mb-3">Your email is not verified. Check your inbox and spam folder for the verification link.</p>
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="flex items-center gap-2 text-sm font-medium text-[#0A1EFF] hover:text-white transition-colors disabled:opacity-50"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrors({}); setNeedsVerification(false); }}
                  className={`w-full bg-white/[0.04] border ${errors.identifier ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="john@example.com or username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.identifier && !needsVerification && <p className="text-red-400 text-xs mt-1.5">{errors.identifier}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-[#0A1EFF] hover:text-[#0A1EFF]/80 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors({}); }}
                  className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-12 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0A1EFF]/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Sign up</Link>
          </p>

          <p className="text-center text-[11px] text-gray-600 mt-6">
            By continuing, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0E1A]" />}>
      <LoginPageInner />
    </Suspense>
  );
}
