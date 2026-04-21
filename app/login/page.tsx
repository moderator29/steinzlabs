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
    // FIX 5A.1: was router.replace (SPA nav preserves prior user's module state & caches),
    // now hard reload so middleware, SSR, and all in-memory caches reset to new user.
    if (!authLoading && user) window.location.href = '/dashboard';
  }, [user, authLoading, router]);

  // Pre-warm the auth API routes on mount so the first sign-in click doesn't
  // pay Vercel cold-start cost (typically 1-2s on first request to a serverless
  // function). HEAD requests are cheap and just spin up the function instance.
  useEffect(() => {
    const warm = (path: string) => {
      fetch(path, { method: 'HEAD', cache: 'no-store' }).catch(() => { /* best effort */ });
    };
    warm('/api/auth/verify-captcha');
    warm('/api/auth/lookup');
  }, []);

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
        let captchaData: { success?: boolean } = {};
        try {
          const captchaRes = await fetch('/api/auth/verify-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: captchaToken, action: 'login' }),
            signal: AbortSignal.timeout(8000),
          });
          captchaData = await captchaRes.json();
        } catch (captchaErr) {
          // Network/timeout reaching verify-captcha — fail open, the server
          // route also fails open on its own Cloudflare timeout. Without this
          // catch the whole login form silently hangs.
          console.warn('[login] verify-captcha unreachable, proceeding:', captchaErr);
          captchaData = { success: true };
        }
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
        try {
          const res = await fetch('/api/auth/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: email.toLowerCase() }),
            signal: AbortSignal.timeout(5000),
          });
          const result = await res.json();
          if (!res.ok || !result.email) {
            showToast(result.error || 'No account found with that username.', 'error');
            setErrors({ identifier: 'Username not found' });
            return;
          }
          email = result.email;
        } catch (lookupErr) {
          console.warn('[login] username lookup failed:', lookupErr);
          showToast('Could not look up that username. Try signing in with email.', 'error');
          setErrors({ identifier: 'Username lookup failed' });
          return;
        }
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

      // @supabase/ssr writes session cookies synchronously inside
      // signInWithPassword, so by this line cookies are already on document.
      // Do NOT add an extra getSession() roundtrip here — it can hang and
      // strand the user on "Signing in..." with no recovery. (P0 fix 2026-04-18.)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('steinz_last_activity', Date.now().toString()); } catch { /* private mode */ }
      }

      showToast('Welcome back!', 'success');
      const destination = searchParams.get('from') || '/dashboard';
      // Hard navigation so middleware reads the freshly-written cookies.
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

          <button
            type="button"
            onClick={async () => {
              if (!supabase) return;
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/auth/callback` },
              });
              if (error) setErrors({ oauth: error.message });
            }}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-white/10 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm transition-colors mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

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
