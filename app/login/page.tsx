'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { AuthRightPanel } from '@/components/auth/AuthRightPanel';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

const SESSION_HOURS = 1;

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
  const [captchaToken, setCaptchaToken] = useState('');
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
    if (TURNSTILE_SITE_KEY && !captchaToken) e.captcha = 'Please complete the security check';
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

      // Sign in with a 12-second timeout — signInWithPassword has no built-in
      // timeout and will hang forever on a bad mobile connection.
      const TIMEOUT_MS = 12000;
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      );

      let signInResult: Awaited<typeof signInPromise>;
      try {
        signInResult = await Promise.race([signInPromise, timeoutPromise]);
      } catch (raceErr: any) {
        if (raceErr?.message === 'timeout') {
          showToast('Sign in timed out. Check your connection and try again.', 'error');
          return;
        }
        throw raceErr;
      }

      const { data, error } = signInResult;

      if (error) {
        const msg = error.message || '';
        const lower = msg.toLowerCase();
        if (lower.includes('not confirmed') || lower.includes('email not confirmed')) {
          setNeedsVerification(true);
          setVerificationEmail(email);
          showToast('Please verify your email first.', 'error');
          setErrors({ identifier: 'Email not verified' });
          return;
        }
        if (lower.includes('invalid') || lower.includes('credentials') || lower.includes('wrong') || lower.includes('password')) {
          showToast('Incorrect email or password.', 'error');
          setErrors({ password: 'Incorrect credentials' });
          return;
        }
        if (lower.includes('rate') || lower.includes('too many')) {
          showToast('Too many attempts. Wait a minute then try again.', 'error');
          return;
        }
        showToast(msg || 'Sign in failed. Please try again.', 'error');
        return;
      }

      if (!data.session) {
        showToast('Sign in failed. Please try again.', 'error');
        return;
      }

      // Set cookie for middleware (Supabase writes localStorage, we write the cookie)
      if (typeof window !== 'undefined') {
        const maxAge = `; max-age=${60 * 60 * SESSION_HOURS}`;
        const isSecure = window.location.protocol === 'https:';
        document.cookie = `steinz_session=${data.session.access_token}; path=/; SameSite=Lax${maxAge}${isSecure ? '; Secure' : ''}`;
      }

      showToast('Welcome back!', 'success');

      // Hard redirect — fresh page load reads the localStorage Supabase just wrote
      const destination = searchParams.get('from') || '/dashboard';
      window.location.href = destination;
    } catch (err: any) {
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
    <div className="min-h-screen bg-[#07090f] text-white flex flex-row-reverse">
      {/* Right: 3D visual panel (rendered first in DOM but visually on the right via flex-row-reverse) */}
      <AuthRightPanel mode="login" />

      {/* Left: form (45%) */}
      <div className="flex-1 lg:max-w-[45%] flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-[#0A1EFF]/[0.04] rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Top nav row */}
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="flex items-center gap-2">
              <SteinzLogo size={28} />
              <span className="text-sm font-bold tracking-tight">STEINZ LABS</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(10,30,255,.1)', border: '1px solid rgba(10,30,255,.2)' }}>
              <Shield className="w-7 h-7" style={{ color: '#6d85ff' }} />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Welcome back</h2>
            <p className="text-white/40 text-sm">Sign in to your intelligence dashboard</p>
          </div>

          {/* Verification warning */}
          {needsVerification && (
            <div className="mb-5 rounded-xl p-4" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
              <p className="text-amber-300 text-sm mb-3">Your email is not verified. Check your inbox and spam folder.</p>
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ color: '#6d85ff' }}
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrors({}); setNeedsVerification(false); }}
                  className={`w-full rounded-xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/20 focus:outline-none transition-colors ${errors.identifier ? 'border-red-500/50' : 'border-white/[0.08]'}`}
                  style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${errors.identifier ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.08)'}` }}
                  placeholder="john@example.com or username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.identifier && !needsVerification && <p className="text-red-400 text-xs mt-1.5">{errors.identifier}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white/60">Password</label>
                <Link href="/forgot-password" className="text-xs transition-colors hover:text-white" style={{ color: '#6d85ff' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors({}); }}
                  className="w-full rounded-xl pl-12 pr-12 py-4 text-sm text-white placeholder-white/20 focus:outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${errors.password ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.08)'}` }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>}
            </div>

            {TURNSTILE_SITE_KEY && (
              <div>
                <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY}
                  data-callback="onTurnstileSuccess" data-theme="dark" data-size="flexible" />
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload"
                  onLoad={() => { (window as any).onTurnstileSuccess = (token: string) => setCaptchaToken(token); }} />
                {errors.captcha && <p className="text-red-400 text-xs mt-1.5">{errors.captcha}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', boxShadow: '0 0 30px rgba(10,30,255,.3)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium transition-colors hover:text-white" style={{ color: '#6d85ff' }}>Sign up</Link>
          </p>

          <p className="text-center text-[11px] text-white/20 mt-5">
            By continuing, you agree to our{' '}
            <span className="text-white/40 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-white/40 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090f]" />}>
      <LoginPageInner />
    </Suspense>
  );
}
