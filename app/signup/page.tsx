'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Check, X, Loader2, User, Mail, Lock, AtSign, Clock } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { AuthRightPanel } from '@/components/auth/AuthRightPanel';

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

      showToast('Account created! Check your email to verify your account.', 'success');
      router.push('/login?confirmed=pending');
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

  const inputStyle = (field: string) => ({
    background: 'rgba(255,255,255,.04)',
    border: `1px solid ${errors[field] ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.08)'}`,
  });

  return (
    <div className="min-h-screen bg-[#07090f] text-white flex flex-row-reverse">
      {/* Right: 3D visual panel */}
      <AuthRightPanel mode="signup" />

      {/* Left: form (45%) */}
      <div className="flex-1 lg:max-w-[45%] flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-[#0A1EFF]/[0.04] rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-md relative z-10 py-4">
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
            <h2 className="text-2xl font-black text-white mb-1">Create your account</h2>
            <p className="text-white/40 text-sm">Get started with STEINZ LABS — free forever</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* First / Last Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">First Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input type="text" value={form.firstName} onChange={e => updateField('firstName', e.target.value)}
                    className="w-full rounded-xl pl-10 pr-3 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none"
                    style={inputStyle('firstName')} placeholder="John" autoComplete="given-name" />
                </div>
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input type="text" value={form.lastName} onChange={e => updateField('lastName', e.target.value)}
                    className="w-full rounded-xl pl-10 pr-3 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none"
                    style={inputStyle('lastName')} placeholder="Doe" autoComplete="family-name" />
                </div>
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Username</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input type="text" value={form.username}
                  onChange={e => updateField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full rounded-xl pl-11 pr-10 py-4 text-sm text-white placeholder-white/20 focus:outline-none"
                  style={{ ...inputStyle('username'), border: `1px solid ${usernameAvailable === true ? 'rgba(74,222,128,.35)' : errors.username ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.08)'}` }}
                  placeholder="johndoe" maxLength={20} autoComplete="username" />
                {checkingUsername && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
                {!checkingUsername && usernameAvailable === true && form.username.length >= 3 &&
                  <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4ade80' }} />}
              </div>
              {errors.username && <p className="text-red-400 text-xs mt-1.5">{errors.username}</p>}
              {!errors.username && usernameAvailable === false && <p className="text-red-400 text-xs mt-1.5">Username is taken</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                  className="w-full rounded-xl pl-11 pr-4 py-4 text-sm text-white placeholder-white/20 focus:outline-none"
                  style={inputStyle('email')} placeholder="john@example.com" autoComplete="email" />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => updateField('password', e.target.value)}
                  className="w-full rounded-xl pl-11 pr-11 py-4 text-sm text-white placeholder-white/20 focus:outline-none"
                  style={inputStyle('password')} placeholder="Create a strong password" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {getPasswordChecks(form.password).map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      {ok ? <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#4ade80' }} />
                           : <X className="w-3 h-3 flex-shrink-0 text-white/20" />}
                      <span className={`text-[10px] ${ok ? 'text-emerald-400' : 'text-white/30'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', boxShadow: '0 0 30px rgba(10,30,255,.3)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {cooldown > 0 ? `Wait ${cooldown}s` : loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="font-medium transition-colors hover:text-white" style={{ color: '#6d85ff' }}>Sign in</Link>
          </p>

          <p className="text-center text-[11px] text-white/20 mt-5">
            By creating an account, you agree to our{' '}
            <span className="text-white/40 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-white/40 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
