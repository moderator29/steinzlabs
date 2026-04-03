'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import NakaLogo from '@/components/NakaLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase, setRememberMe } from '@/lib/supabase';
import { socialSignIn } from '@/lib/socialAuth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const error = searchParams.get('error');
    if (confirmed === 'pending') showToast('Check your email and click the confirmation link, then sign in.', 'success');
    if (error === 'oauth_failed') showToast('Google sign-in failed. Please try again.', 'error');
  }, [searchParams, showToast]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    const setLoaderFn = provider === 'google' ? setGoogleLoading : setAppleLoading;
    setLoaderFn(true);
    try {
      const result = await socialSignIn(provider);
      if (result.success) {
        showToast('Welcome back!', 'success');
        const from = searchParams.get('from');
        router.push(from || '/dashboard');
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
    if (!validate()) return;

    setLoading(true);
    setRememberMe(rememberMe);
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
          setResendEmail(email);
          setShowResend(true);
          showToast('Email not confirmed yet. Check your inbox or resend below.', 'error');
        } else if (error.message.toLowerCase().includes('invalid')) {
          showToast('Incorrect email/username or password.', 'error');
          setErrors({ password: 'Incorrect credentials' });
        } else {
          showToast(error.message || 'Sign in failed. Please try again.', 'error');
        }
        return;
      }

      if (typeof window !== 'undefined') localStorage.setItem('naka_has_session', 'true');
      showToast('Welcome back!', 'success');
      const from = searchParams.get('from');
      router.push(from || '/dashboard');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-4xl font-bold leading-tight mb-4">Welcome back to<br /><span className="text-[#0A1EFF]">Naka Labs</span></h1>
          <p className="text-gray-400 text-sm leading-relaxed">Access your intelligence dashboard. Track whales, analyze wallets, and act on real blockchain data before the crowd.</p>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 Naka Labs. Powered by $NAKA.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2"><NakaLogo size={28} /><span className="text-sm font-bold">NAKA LABS</span></Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-3 border border-[#0A1EFF]/20"><Shield className="w-6 h-6 text-[#0A1EFF]" /></div>
              <h2 className="text-xl font-bold mb-1">Sign in</h2>
              <p className="text-gray-500 text-sm">Access your intelligence dashboard</p>
            </div>

            <button
              onClick={() => handleSocialSignIn('google')}
              disabled={googleLoading || appleLoading}
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
              disabled={appleLoading || googleLoading}
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
              <span className="text-xs text-gray-600">or sign in with email</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" value={identifier} onChange={e => { setIdentifier(e.target.value); setErrors({}); }} className={`w-full bg-white/[0.04] border ${errors.identifier ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="john@example.com or johndoe" autoComplete="username" />
                </div>
                {errors.identifier && <p className="text-red-400 text-[11px] mt-1">{errors.identifier}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErrors({}); }} className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`} placeholder="Enter your password" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-[11px] mt-1">{errors.password}</p>}
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setRememberMeState(!rememberMe)} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${rememberMe ? 'bg-[#0A1EFF] border-[#0A1EFF]' : 'border-white/20 bg-transparent'}`}>
                  {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className="text-xs text-gray-400">Keep me signed in for 7 days</span>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {showResend && (
              <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                <p className="text-xs text-yellow-400/90 mb-2">Email not confirmed. Didn&apos;t receive it?</p>
                <button
                  type="button"
                  disabled={resending}
                  onClick={async () => {
                    setResending(true);
                    try {
                      const { error } = await supabase.auth.resend({ type: 'signup', email: resendEmail });
                      if (error) {
                        showToast(error.message || 'Failed to resend. Try again later.', 'error');
                      } else {
                        showToast('Confirmation email resent! Check your inbox.', 'success');
                        setShowResend(false);
                      }
                    } catch {
                      showToast('Failed to resend. Try again later.', 'error');
                    } finally {
                      setResending(false);
                    }
                  }}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {resending ? 'Sending...' : 'Resend Confirmation Email'}
                </button>
              </div>
            )}

            <p className="text-center text-sm text-gray-500 mt-5">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Sign up</Link>
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-4">
            By continuing, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Terms of Service</span> and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
