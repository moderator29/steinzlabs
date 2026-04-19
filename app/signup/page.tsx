'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check, X, Loader2, User, Mail, Lock, AtSign, Clock } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { CoinIcon } from '@/components/landing/CoinIcon';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

const BG_COINS = [
  { coin: 'ETH'  as const, size: 36, top: '10%',  right: '6%',  opacity: 0.16, dur: '7s',   delay: '0.5s' },
  { coin: 'SOL'  as const, size: 26, top: '60%',  left: '4%',   opacity: 0.13, dur: '5.5s', delay: '2s'   },
  { coin: 'BTC'  as const, size: 30, bottom: '12%',right: '8%', opacity: 0.14, dur: '6.5s', delay: '1s'   },
  { coin: 'MATIC'as const, size: 22, top: '40%',  left: '3%',   opacity: 0.11, dur: '8s',   delay: '1.5s' },
];

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' };
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const hasSym   = /[^a-zA-Z0-9]/.test(pw);
  const long     = pw.length >= 10;
  const score    = [pw.length >= 8, hasLower, hasUpper, hasNum, hasSym, long].filter(Boolean).length;
  if (score <= 2) return { level: 20,  label: 'Weak',        color: '#ef4444' };
  if (score <= 3) return { level: 45,  label: 'Fair',        color: '#f59e0b' };
  if (score <= 4) return { level: 70,  label: 'Strong',      color: '#10b981' };
  return           { level: 100, label: 'Very Strong',  color: '#4d80ff' };
}

function getPasswordChecks(pw: string) {
  return [
    { label: '8–100 characters',          ok: pw.length >= 8 && pw.length <= 100 },
    { label: 'One lowercase letter',       ok: /[a-z]/.test(pw) },
    { label: 'One uppercase letter',       ok: /[A-Z]/.test(pw) },
    { label: 'One number',                 ok: /[0-9]/.test(pw) },
    { label: 'One special character',      ok: /[^a-zA-Z0-9]/.test(pw) },
  ];
}

export default function SignUpPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(false);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
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
        console.error('[signup] Turnstile render failed:', err);
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
    // FIX 5A.1: hard reload so no prior-user state carries over.
    if (!authLoading && user) window.location.href = '/dashboard';
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!form.username || form.username.length < 3) { setUsernameAvailable(null); return; }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username.trim().toLowerCase() }),
        });
        const data = await res.json();
        if (data.available === true) setUsernameAvailable(true);
        else if (data.available === false) setUsernameAvailable(false);
        else setUsernameAvailable(null);
      } catch { setUsernameAvailable(null); }
      finally { setCheckingUsername(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.username]);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); setAttempts(0); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.username.trim()) e.username = 'Required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) e.username = '3–20 chars, letters/numbers/_';
    else if (usernameAvailable === false) e.username = 'Username is taken';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Required';
    else if (!getPasswordChecks(form.password).every(c => c.ok)) e.password = 'Password does not meet requirements';
    if (form.password && form.confirm !== form.password) e.confirm = "Passwords don't match";
    if (TURNSTILE_SITE_KEY && captchaReady && !captchaToken) e.captcha = 'Please complete the security check';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || !validate()) return;
    setLoading(true);
    try {
      // ── CAPTCHA backend verification ──────────────────────────────────────
      if (TURNSTILE_SITE_KEY && captchaToken) {
        let captchaData: { success?: boolean } = {};
        try {
          const captchaRes = await fetch('/api/auth/verify-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: captchaToken, action: 'signup' }),
            signal: AbortSignal.timeout(8000),
          });
          captchaData = await captchaRes.json();
        } catch (captchaErr) {
          // Network/timeout — fail open (server route also fails open). Without
          // this catch the form silently hangs on "Creating account...".
          console.warn('[signup] verify-captcha unreachable, proceeding:', captchaErr);
          captchaData = { success: true };
        }
        if (!captchaData.success) {
          showToast('Security check failed. Please try again.', 'error');
          setErrors(prev => ({ ...prev, captcha: 'Security verification failed' }));
          const ts = (window as any).turnstile;
          if (ts && widgetIdRef.current && typeof ts.reset === 'function') {
            try { ts.reset(widgetIdRef.current); } catch { /* ignore */ }
          }
          setCaptchaToken('');
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim().toLowerCase(),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const errMsg = data.error || 'Signup failed';
        if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('too many')) {
          if (newAttempts >= MAX_ATTEMPTS) { startCooldown(); showToast(`Too many attempts. Wait ${COOLDOWN_SECONDS}s.`, 'error'); }
          else showToast(`Rate limited. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} left.`, 'error');
        } else if (errMsg.includes('already') || errMsg.includes('exists')) {
          showToast('An account with this email already exists.', 'error');
        } else if (errMsg.includes('Username')) {
          showToast(errMsg, 'error');
          setErrors(prev => ({ ...prev, username: 'Username taken' }));
        } else { showToast(errMsg, 'error'); }
        return;
      }
      showToast('Account created! Check your email to verify.', 'success');
      import('@/lib/posthog').then(({ track }) => {
        track('user_signed_up', { username: form.username.trim().toLowerCase() });
      }).catch(() => { /* PostHog not configured */ });
      router.push('/login?confirmed=pending');
    } catch (err: any) {
      const msg = err?.message || '';
      const name = err?.name || '';
      if (name === 'AbortError' || name === 'TimeoutError' || msg.includes('timed out') || msg.includes('timeout')) {
        showToast('Sign up timed out. Please try again.', 'error');
      } else if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('network')) {
        showToast('Unable to connect. Check your internet connection.', 'error');
      } else { showToast('Sign up failed. Please try again.', 'error'); }
    } finally { setLoading(false); }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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

  const inputStyle = (field: string, extra?: React.CSSProperties) => ({
    ...inputBase,
    borderColor: errors[field] ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)',
    ...extra,
  });

  const strength = getPasswordStrength(form.password);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#07090f' }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(26,58,204,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(26,58,204,.04) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[700px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse,rgba(13,30,140,.13) 0%,transparent 70%)' }} />

      {/* Floating coins */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {BG_COINS.map((c, i) => (
          <div key={i} className="absolute hidden md:block" style={{
            top: c.top, left: (c as any).left, right: (c as any).right, bottom: (c as any).bottom,
          }}>
            <CoinIcon coin={c.coin} size={c.size} opacity={c.opacity}
              floatDuration={c.dur} floatDelay={c.delay} floatAmplitude={c.size * 0.28} />
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="relative z-10 w-full py-4" style={{ maxWidth: 440 }}>
        <div className="w-full rounded-3xl"
          style={{
            background: 'rgba(6,6,15,.92)',
            border: '1px solid rgba(26,58,204,.14)',
            padding: '44px 40px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(0,0,0,.6),0 0 40px rgba(13,30,140,.06)',
          }}>

          <div className="flex flex-col items-center mb-7">
            <SteinzLogo size={48} animated={true} />
            <p className="mt-2 text-[10px] font-bold tracking-[6px] uppercase" style={{ color: '#1a2855', letterSpacing: 6 }}>
              NAKA LABS
            </p>
          </div>

          <h2 className="text-[26px] font-bold text-white mb-1">Create your account.</h2>
          <p className="text-sm mb-7" style={{ color: '#1e2e50' }}>Start with institutional intelligence. Free forever.</p>

          {/* Turnstile script — explicit render so widget mounts reliably on mobile */}
          {TURNSTILE_SITE_KEY && (
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              strategy="afterInteractive"
            />
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* First + Last Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>FIRST</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                  <input type="text" value={form.firstName} onChange={e => updateField('firstName', e.target.value)}
                    style={{ ...inputStyle('firstName'), paddingLeft: 34 }} placeholder="John" autoComplete="given-name"
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.firstName ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>LAST</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                  <input type="text" value={form.lastName} onChange={e => updateField('lastName', e.target.value)}
                    style={{ ...inputStyle('lastName'), paddingLeft: 34 }} placeholder="Doe" autoComplete="family-name"
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.lastName ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>USERNAME</label>
              <div className="relative">
                <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input type="text" value={form.username}
                  onChange={e => updateField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  style={{ ...inputStyle('username'), paddingLeft: 38, paddingRight: 38, borderColor: usernameAvailable === true ? 'rgba(74,222,128,.35)' : errors.username ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)' }}
                  placeholder="johndoe" maxLength={20} autoComplete="username"
                  onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }} />
                {checkingUsername && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: 'rgba(255,255,255,.3)' }} />}
                {!checkingUsername && usernameAvailable === true && form.username.length >= 3 &&
                  <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4ade80' }} />}
              </div>
              {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
              {!errors.username && usernameAvailable === false && <p className="text-red-400 text-xs mt-1">Username is taken</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>EMAIL</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                  style={{ ...inputStyle('email'), paddingLeft: 38 }} placeholder="john@example.com" autoComplete="email"
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.email ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }} />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => updateField('password', e.target.value)}
                  style={{ ...inputStyle('password'), paddingLeft: 38, paddingRight: 40 }}
                  placeholder="Create a strong password" autoComplete="new-password"
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(77,128,255,.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.password ? 'rgba(239,68,68,.4)' : 'rgba(26,58,204,.18)'; e.currentTarget.style.boxShadow = 'none'; }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,.25)' }}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 h-[3px] rounded-full mr-3" style={{ background: 'rgba(255,255,255,.05)' }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${strength.level}%`, background: strength.color }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: strength.color, minWidth: 64, textAlign: 'right' }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {getPasswordChecks(form.password).map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        {ok ? <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#4ade80' }} />
                             : <X className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,.15)' }} />}
                        <span className={`text-[10px] ${ok ? 'text-emerald-400' : 'text-white/25'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: '#0e1535' }}>CONFIRM PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,.2)' }} />
                <input type={showConfirm ? 'text' : 'password'} value={form.confirm}
                  onChange={e => updateField('confirm', e.target.value)}
                  style={{
                    ...inputBase,
                    paddingLeft: 38, paddingRight: 72,
                    borderColor: errors.confirm ? 'rgba(239,68,68,.4)' : form.confirm && form.confirm === form.password ? 'rgba(74,222,128,.35)' : 'rgba(26,58,204,.18)',
                  }}
                  placeholder="Repeat password" autoComplete="new-password"
                  onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,58,204,.08)'; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }} />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {form.confirm && form.confirm === form.password && <Check className="w-4 h-4" style={{ color: '#4ade80' }} />}
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,.25)' }}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm}</p>}
            </div>

            {/* Turnstile CAPTCHA — explicit render via window.turnstile */}
            {TURNSTILE_SITE_KEY && (
              <div>
                <div
                  ref={turnstileRef}
                  style={{ minHeight: 65, colorScheme: 'dark', width: '100%' }}
                />
                {errors.captcha && <p className="text-red-400 text-xs mt-1">{errors.captcha}</p>}
              </div>
            )}

            {cooldown > 0 && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
                <p className="text-xs" style={{ color: '#fbbf24' }}>
                  Too many attempts. Try again in <span className="font-bold">{cooldown}s</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0}
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
              {cooldown > 0 ? `Wait ${cooldown}s` : loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.06)' }} />
            <span className="text-[11px]" style={{ color: '#0e1535' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.06)' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#0e1535' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-medium transition-colors hover:opacity-80" style={{ color: '#4d80ff' }}>Sign in</Link>
          </p>

          <p className="text-center text-[11px] mt-4" style={{ color: '#080e20' }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
