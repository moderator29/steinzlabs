'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase, setRememberMe, isSupabaseReady } from '@/lib/supabase';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'pending') showToast('Account created! Sign in below.', 'success');
  }, [searchParams, showToast]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting.current) return;

    submitting.current = true;
    setLoading(true);
    setRememberMe(rememberMe);

    if (!isSupabaseReady()) {
      showToast('Auth service is not configured. Please contact support.', 'error');
      setLoading(false);
      submitting.current = false;
      return;
    }

    try {
      let email = identifier.trim();

      if (!email.includes('@')) {
        const { data: profile, error: lookupError } = await supabase.from('profiles').select('email').eq('username', email.toLowerCase()).maybeSingle();
        if (lookupError) {
          showToast('Unable to connect. Check your internet connection.', 'error');
          return;
        }
        if (!profile?.email) {
          showToast('No account found with that username.', 'error');
          setErrors({ identifier: 'Username not found' });
          return;
        }
        email = profile.email;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')) {
          showToast('Incorrect email/username or password.', 'error');
          setErrors({ password: 'Incorrect credentials' });
        } else if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
          showToast('Unable to connect. Check your internet connection.', 'error');
        } else {
          showToast(error.message || 'Sign in failed.', 'error');
        }
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('steinz_has_session', 'true');
        if (signInData?.session?.access_token) {
          const remember = rememberMe;
          const maxAge = remember ? `; max-age=${60 * 60 * 24 * 7}` : '';
          document.cookie = `steinz_session=${signInData.session.access_token}; path=/; SameSite=Lax${maxAge}`;
        }
      }
      showToast('Welcome back!', 'success');
      const from = searchParams.get('from');
      router.push(from || '/dashboard');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('network') || msg.includes('CORS')) {
        showToast('Unable to connect to auth server. Check your connection.', 'error');
      } else {
        showToast('Sign in failed. Please try again.', 'error');
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
          <p className="text-gray-400 text-sm leading-relaxed">Access your intelligence dashboard. Track whales, analyze wallets, and act on real blockchain data before the crowd.</p>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrors({}); }}
                  className={`w-full bg-white/[0.04] border ${errors.identifier ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="john@example.com or johndoe"
                  autoComplete="username"
                />
              </div>
              {errors.identifier && <p className="text-red-400 text-xs mt-1.5">{errors.identifier}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
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

            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setRememberMeState(!rememberMe)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${rememberMe ? 'bg-[#0A1EFF] border-[#0A1EFF]' : 'border-white/20 bg-transparent'}`}>
                {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <span className="text-sm text-gray-400">Keep me signed in for 7 days</span>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0A1EFF]/20">
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
