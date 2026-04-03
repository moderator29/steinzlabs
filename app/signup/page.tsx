'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Check, X, Loader2, User, Mail, Lock, AtSign, Clock } from 'lucide-react';
import Link from 'next/link';
import NakaLogo from '@/components/NakaLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { socialSignIn } from '@/lib/socialAuth';

const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

function getPasswordChecks(pw: string) {
  return [
    { label: 'Between 8 and 100 characters', ok: pw.length >= 8 && pw.length <= 100 },
    { label: 'At least one lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'At least one uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'At least one number', ok: /[0-9]/.test(pw) },
    { label: 'At least one special character', ok: /[^a-zA-Z0-9]/.test(pw) },
  ];
}

export default function SignUpPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!form.username || form.username.length < 3) { setUsernameAvailable(null); return; }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const { data } = await supabase.from('profiles').select('id').eq('username', form.username.toLowerCase()).maybeSingle();
        setUsernameAvailable(!data);
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
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          setAttempts(0);
          return 0;
        }
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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    const setLoaderFn = provider === 'google' ? setGoogleLoading : setAppleLoading;
    setLoaderFn(true);
    try {
      const result = await socialSignIn(provider);
      if (result.success) {
        showToast('Welcome to Naka Labs!', 'success');
        router.push('/dashboard');
      } else if (result.error && result.error !== 'Sign-in cancelled') {
        showToast(result.error, 'error');
      }
    } catch {
      showToast(`${provider === 'google' ? 'Google' : 'Apple'} sign-in failed. Try again.`, 'error');
    } finally {
      setLoaderFn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || !validate()) return;

    setLoading(true);
    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanUsername = form.username.trim().toLowerCase();

      const usernameRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const usernameData = await usernameRes.json();
      if (usernameData.available === false) {
        showToast('Username is already taken', 'error');
        setErrors(prev => ({ ...prev, username: 'Username taken' }));
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            username: cleanUsername,
          },
        },
      });

      if (signUpError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const errMsg = signUpError.message;

        if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('too many')) {
          if (newAttempts >= MAX_ATTEMPTS) {
            startCooldown();
            showToast(`Too many attempts. Please wait ${COOLDOWN_SECONDS} seconds.`, 'error');
          } else {
            showToast(`Rate limited. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} left before waiting.`, 'error');
          }
        } else if (errMsg.includes('already') || errMsg.includes('exists') || errMsg.includes('User already registered')) {
          showToast('An account with this email already exists. Try signing in.', 'error');
        } else {
          showToast(errMsg, 'error');
        }
        return;
      }

      showToast('Account created! Check your email to confirm, then sign in.', 'success');
      router.push('/login?confirmed=pending');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#0A1EFF] animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-[#0A1EFF]/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-[#7C3AED]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-12 relative">
        <Link href="/" className="flex items-center gap-2.5">
          <NakaLogo size={32} />
          <span className="text-base font-bold tracking-tight">NAKA LABS</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">Join the intelligence<br /><span className="text-[#0A1EFF]">revolution</span></h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">Create your account and start tracking whale movements, analyzing trading patterns, and acting on real blockchain data.</p>
          <div className="space-y-3">
            {['Real-time on-chain intelligence', 'AI-powered trading analysis', 'Professional security scanning'].map(t => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0A1EFF]/10 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-[#0A1EFF]" /></div>
                <span className="text-sm text-gray-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 Naka Labs. Powered by $NAKA.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2"><NakaLogo size={28} /><span className="text-sm font-bold">NAKA LABS</span></Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-3 border border-[#0A1EFF]/20"><Shield className="w-6 h-6 text-[#0A1EFF]" /></div>
              <h2 className="text-xl font-bold mb-1">Create your account</h2>
              <p className="text-gray-500 text-sm">Get started with Naka Labs</p>
            </div>

            <button
              onClick={() => handleSocialSignIn('google')}
              disabled={googleLoading || appleLoading || cooldown > 0}
              className="w-full flex items-center justify-center gap-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.12] rounded-xl py-3 text-sm font-medium transition-all mb-2.5 disabled:opacity-50"
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

            <button
              onClick={() => handleSocialSignIn('apple')}
              disabled={appleLoading || googleLoading || cooldown > 0}
              className="w-full flex items-center justify-center gap-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.12] rounded-xl py-3 text-sm font-medium transition-all mb-4 disabled:opacity-50"
            >
              {appleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continue with Apple
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-gray-600">or sign up with email</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={form.firstName} onChange={e => updateField('firstName', e.target.value)} className={`w-full bg-white/[0.04] border ${errors.firstName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="John" autoComplete="given-name" />
                  </div>
                  {errors.firstName && <p className="text-red-400 text-[11px] mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={form.lastName} onChange={e => updateField('lastName', e.target.value)} className={`w-full bg-white/[0.04] border ${errors.lastName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="Doe" autoComplete="family-name" />
                  </div>
                  {errors.lastName && <p className="text-red-400 text-[11px] mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" value={form.username} onChange={e => updateField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} className={`w-full bg-white/[0.04] border ${errors.username ? 'border-red-500/50' : usernameAvailable === true ? 'border-emerald-500/40' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="johndoe" maxLength={20} autoComplete="username" />
                  {checkingUsername && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
                  {!checkingUsername && usernameAvailable === true && form.username.length >= 3 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
                </div>
                {errors.username && <p className="text-red-400 text-[11px] mt-1">{errors.username}</p>}
                {!errors.username && usernameAvailable === false && <p className="text-red-400 text-[11px] mt-1">Username is taken</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className={`w-full bg-white/[0.04] border ${errors.email ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="john@example.com" autoComplete="email" />
                </div>
                {errors.email && <p className="text-red-400 text-[11px] mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => updateField('password', e.target.value)} className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="Create a strong password" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {getPasswordChecks(form.password).map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2">
                        {ok
                          ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          : <X className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                        }
                        <span className={`text-[11px] ${ok ? 'text-emerald-400' : 'text-gray-500'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cooldown > 0 && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">Too many attempts. Try again in <span className="font-bold">{cooldown}s</span></p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {cooldown > 0 ? `Wait ${cooldown}s` : loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-4">
            By creating an account, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
