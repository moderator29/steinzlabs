'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import NakaLogo from '@/components/NakaLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      let email = identifier.trim();

      const isEmail = email.includes('@');
      if (!isEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', email.toLowerCase())
          .maybeSingle();

        if (!profile?.email) {
          showToast('Invalid username or password', 'error');
          setErrors({ password: 'Invalid credentials' });
          setLoading(false);
          return;
        }
        email = profile.email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showToast('Invalid email/username or password', 'error');
        setErrors({ password: 'Invalid credentials' });
        return;
      }

      showToast('Welcome back!', 'success');

      const params = new URLSearchParams(window.location.search);
      const from = params.get('from');
      router.push(from || '/dashboard');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0A1EFF] animate-spin" />
      </div>
    );
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
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Welcome back to<br />
            <span className="text-[#0A1EFF]">Naka Labs</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Access your intelligence dashboard. Track whales, analyze wallets, and act on real blockchain data before the crowd.
          </p>
        </div>

        <p className="text-xs text-gray-600">&copy; 2026 Naka Labs. Powered by $NAKA.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2">
              <NakaLogo size={28} />
              <span className="text-sm font-bold">NAKA LABS</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-3 border border-[#0A1EFF]/20">
                <Shield className="w-6 h-6 text-[#0A1EFF]" />
              </div>
              <h2 className="text-xl font-bold mb-1">Sign in</h2>
              <p className="text-gray-500 text-sm">Access your intelligence dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setErrors({}); }}
                    className={`w-full bg-white/[0.04] border ${errors.identifier ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                    placeholder="john@example.com or johndoe"
                    autoComplete="username"
                  />
                </div>
                {errors.identifier && errors.identifier !== ' ' && <p className="text-red-400 text-[11px] mt-1">{errors.identifier}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                    className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && errors.password !== 'Invalid credentials' && <p className="text-red-400 text-[11px] mt-1">{errors.password}</p>}
                {errors.password === 'Invalid credentials' && <p className="text-red-400 text-[11px] mt-1">Invalid email/username or password</p>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-[#0A1EFF] border-[#0A1EFF]' : 'border-white/20 bg-transparent'}`}
                >
                  {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className="text-xs text-gray-400">Remember me</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">
                Sign up
              </Link>
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-4">
            By continuing, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Terms of Service</span>
            {' '}and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
