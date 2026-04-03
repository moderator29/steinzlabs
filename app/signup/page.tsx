'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Check, X, Loader2, User, Mail, Lock, AtSign, Clock } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || !validate()) return;

    setLoading(true);
    try {
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
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const errMsg = data.error || 'Signup failed';

        if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('too many')) {
          if (newAttempts >= MAX_ATTEMPTS) {
            startCooldown();
            showToast(`Too many attempts. Please wait ${COOLDOWN_SECONDS} seconds.`, 'error');
          } else {
            showToast(`Rate limited. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} left before waiting.`, 'error');
          }
        } else if (errMsg.includes('already') || errMsg.includes('exists')) {
          showToast('An account with this email already exists. Try signing in.', 'error');
        } else if (errMsg.includes('Username')) {
          showToast(errMsg, 'error');
          setErrors(prev => ({ ...prev, username: 'Username taken' }));
        } else {
          showToast(errMsg, 'error');
        }
        return;
      }

      if (data.needsConfirmation) {
        showToast('Account created! Check your email to confirm, then sign in.', 'success');
      } else {
        showToast('Account created! You can now sign in.', 'success');
      }
      router.push('/login');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('network')) {
        showToast('Unable to connect. Check your internet connection.', 'error');
      } else {
        showToast('Sign up failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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
        <p className="text-xs text-gray-600">&copy; 2026 STEINZ LABS. All rights reserved.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-md py-4">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2"><SteinzLogo size={28} /><span className="text-sm font-bold">STEINZ LABS</span></Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
              <Shield className="w-8 h-8 text-[#0A1EFF]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create your account</h2>
            <p className="text-gray-500 text-sm">Get started with STEINZ LABS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  className={`w-full bg-white/[0.04] border ${errors.firstName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>
              {errors.firstName && <p className="text-red-400 text-xs mt-1.5">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  className={`w-full bg-white/[0.04] border ${errors.lastName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
              {errors.lastName && <p className="text-red-400 text-xs mt-1.5">{errors.lastName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => updateField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className={`w-full bg-white/[0.04] border ${errors.username ? 'border-red-500/50' : usernameAvailable === true ? 'border-emerald-500/40' : 'border-white/[0.08]'} rounded-xl pl-12 pr-12 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="johndoe"
                  maxLength={20}
                  autoComplete="username"
                />
                {checkingUsername && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 animate-spin" />}
                {!checkingUsername && usernameAvailable === true && form.username.length >= 3 && <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />}
              </div>
              {errors.username && <p className="text-red-400 text-xs mt-1.5">{errors.username}</p>}
              {!errors.username && usernameAvailable === false && <p className="text-red-400 text-xs mt-1.5">Username is taken</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className={`w-full bg-white/[0.04] border ${errors.email ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="john@example.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => updateField('password', e.target.value)}
                  className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-12 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {getPasswordChecks(form.password).map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2">
                      {ok
                        ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        : <X className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                      }
                      <span className={`text-xs ${ok ? 'text-emerald-400' : 'text-gray-500'}`}>{label}</span>
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
              className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0A1EFF]/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {cooldown > 0 ? `Wait ${cooldown}s` : loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Sign in</Link>
          </p>

          <p className="text-center text-[11px] text-gray-600 mt-6">
            By creating an account, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
