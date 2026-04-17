'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Mail, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CoinIcon } from '@/components/landing/CoinIcon';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { SignInWithWallet } from '@/components/auth/SignInWithWallet';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SESSION_HOURS = 1;

// Deterministic coin positions (no Math.random for SSR safety)
const BG_COINS = [
  { coin: 'BTC' as const, size: 40, top: '12%',  left: '7%',   opacity: 0.18, dur: '6s',   delay: '0s'   },
  { coin: 'ETH' as const, size: 30, top: '72%',  right: '8%',  opacity: 0.15, dur: '7.5s', delay: '1.4s' },
  { coin: 'SOL' as const, size: 24, top: '45%',  left: '4%',   opacity: 0.12, dur: '5.5s', delay: '2.2s' },
  { coin: 'AVAX'as const, size: 28, bottom: '15%',left: '12%', opacity: 0.14, dur: '8s',   delay: '0.8s' },
];

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
  const [captchaReady, setCaptchaReady] = useState(false);
  const submitting = useRef(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Explicit Turnstile render — implicit auto-render is unreliable on mobile
  // Safari when the script loads after hydration. (Production bug 2026-04-17.)
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryRender = () => {
      if (cancelled) return;
      const ts = (window as any).turnstile;
      if (!ts || !turnstileRef.current) return false;
      if (widgetIdRef.current) return true;
      try {
        widgetIdRef.current = ts.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => setCaptchaToken(token),
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => setCaptchaToken(''),
        });
        setCaptchaReady(true);
        return true;
      } catch (err) {
        console.error('[login] Turnstile render failed:', err);
        return false;
      }
    };

    if (!tryRender()) {
      pollTimer = setInterval(() => {
        if (tryRender() && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      const ts = (window as any).turnstile;
      if (ts && widgetIdRef.current) {
        try { ts.remove(widgetIdRef.current); } catch { /* widget already gone */ }
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const verified = searchParams.get('verified');
    const err = searchParams.get('error');
    const session = searchParams.get('session');
    if (confirmed === 'pending') showToast('Account created! Check your email to verify, then sign in.', 'success');
    if (confirmed === 'reset') showToast('Password updated! Sign in with your new password.', 'success');
    if (verified === 'true') showToast('Email verified! Sign in below.', 'success');
    if (err) showToast('Verification link issue. Try resending below.', 'error');
    if (session === 'expired') showToast('Your session has expired. Please sign in again.', 'error');
  }, [searchParams, showToast]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    if (TURNSTILE_SITE_KEY && captchaReady && !captchaToken) e.captcha = 'Please complete the security check';
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
      if (res.ok && data.success) showToast('Verification email sent! Check your inbox.', 'success');
      else showToast(data.error || 'Failed to resend.', 'error');
    } catch { showToast('Failed to resend. Check your connection.', 'error'); }
    finally { setResending(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setNeedsVerification(false);
    try {
      // ── CAPTCHA backend verification ──────────────────────────────────────
      if (TURNSTILE_SITE_KEY && captchaToken) {
        const captchaRes = await fetch('/api/auth/verify-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: captchaToken, action: 'login' }),
        });
        const captchaData = await captchaRes.json();
        if (!captchaData.success) {
          showToast('Security check failed. Please try again.', 'error');
          setErrors({ captcha: 'Security verification failed' });
          // Reset widget
          const ts = (window as any).turnstile;
          if (ts && widgetIdRef.current && typeof ts.reset === 'function') {
            try { ts.reset(widgetIdRef.current); } catch { /* ignore */ }
          }
          setCaptchaToken('');
          return;
        }
      }

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

      if (!data.session) { showToast('Sign in failed. Please try again.', 'error'); return; }

      // @supabase/ssr writes session cookies automatically — do NOT set
      // a custom `steinz_session` cookie; middleware ignores it.
      if (typeof window !== 'undefined') {
        localStorage.setItem('steinz_last_activity', Date.now().toString());
      }

      // Force a session refresh so the cookies are flushed before navigation.
      // Without this, `window.location.href` can race the cookie write and
      // middleware sees no session → redirects back to /login.
      try {
        await supabase.auth.getSession();
      } catch (refreshErr) {
        console.error('[login] getSession after sign-in failed:', refreshErr);
      }

      showToast('Welcome back!', 'success');
      const destination = searchParams.get('from') || '/dashboard';
      // Hard navigation guarantees the cookies are sent with the new request.
      window.location.assign(destination);
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

  const inputBase: React.CSSProperties = {
    background: 'rgba(10,10,30,.8)',
    border: '1px solid rgba(26,58,204,.18)',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: 'white',
    width: '100%',
    outline: 'none',
    transition: 'border-color 200ms, box-shadow 200ms',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#07090f' }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(26,58,204,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(26,58,204,.04) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Top radial glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[700px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse,rgba(13,30,140,.13) 0%,transparent 70%)' }} />

      {/* Floating coins */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {BG_COINS.map((c, i) => (
          <div key={i} className="absolute hidden md:block" style={{
            top: c.top, left: (c as any).left, right: (c as any).right, bottom: (c as any).bottom,
          }}>
            <CoinIcon coin={c.coin} size={c.size} opacity={c.opacity}
              floatDuration={c.dur} floatDelay={c.delay} floatAmplitude={c.size * 0.3} />
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="relative z-10 w-full" style={{ maxWidth: 440 }}>
        <div
          className="w-full rounded-3xl"
          style={{
            background: 'rgba(6,6,15,.92)',
            border: '1px solid rgba(26,58,204,.14)',
            padding: '44px 40px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(0,0,0,.6),0 0 40px rgba(13,30,140,.06)',
          }}
        >
          {/* Top */}
          <div className="flex flex-col items-center mb-7">
            <SteinzLogo size={48} animated={true} />
            <p className="mt-2 text-[10px] font-bold tracking-[6px] uppercase" style={{ color: '#1a2855', letterSpacing: 6 }}>
              NAKA LABS
            </p>
          </div>

          <h2 className="text-[26px] font-bold text-white mb-1">Welcome back.</h2>
          <p className="text-sm mb-7" style={{ color: '#1e2e50' }}>Continue your intelligence session.</p>

          {/* Verification banner */}
          {needsVerification && (
            <div className="mb-5 rounded-xl p-4" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
              <p className="text-amber-300 text-sm mb-3">Your email is not verified. Check your inbox and spam folder.</p>
              <button onClick={handleResendVerification} disabled={resending}
                className="flex items-center gap-2 text-sm font-medium disabled:opacity-50" style={{ color: '#4d80ff' }}>
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-5">
            <GoogleSignInButton />
            <SignInWithWallet />
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-slate-700/40" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500">or email</span>
              <div className="flex-1 h-px bg-slate-700/40" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5"
                style={{ color: '#0e1535' }}>EMAIL</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrors({}); setNeedsVerification(false); }}
                  style={{ ...inputBase, paddingLeft: 38, borderColor: errors.identifier ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)' }}
                  placeholder="john@example.com or username"
                  autoComplete="username"
                  autoFocus
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.identifier ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              {errors.identifier && !needsVerification && <p className="text-red-400 text-xs mt-1.5">{errors.identifier}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[1.5px]" style={{ color: '#0e1535' }}>PASSWORD</label>
                <Link href="/forgot-password" className="text-[12px] transition-colors hover:opacity-80" style={{ color: '#1a3acc' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors({}); }}
                  style={{ ...inputBase, paddingLeft: 38, paddingRight: 44, borderColor: errors.password ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)' }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.password ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,.25)' }}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>}
            </div>

            {/* Turnstile CAPTCHA — explicit render via window.turnstile */}
            {TURNSTILE_SITE_KEY && (
              <div>
                {/* Load the script with `?render=explicit` so it does not try
                    to auto-render `.cf-turnstile` before our ref mount. */}
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                  strategy="afterInteractive"
                />
                <div
                  ref={turnstileRef}
                  style={{ minHeight: 65, colorScheme: 'dark', width: '100%' }}
                />
                {errors.captcha && <p className="text-red-400 text-xs mt-1">{errors.captcha}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                marginTop: 4,
                padding: 14,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#1a3acc,#0d1f88)',
                border: '1px solid rgba(77,128,255,.28)',
                boxShadow: '0 0 20px rgba(26,58,204,.25)',
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.06)' }} />
            <span className="text-[11px]" style={{ color: '#0e1535' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.06)' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#0e1535' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium transition-colors hover:opacity-80" style={{ color: '#4d80ff' }}>Sign up</Link>
          </p>

          <p className="text-center text-[11px] mt-4" style={{ color: '#080e20' }}>
            By continuing you agree to our{' '}
            <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</Link>
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
