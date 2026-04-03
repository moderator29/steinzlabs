'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, ArrowLeft, Check, Loader2, User, Mail, Lock, AtSign } from 'lucide-react';
import Link from 'next/link';
import NakaLogo from '@/components/NakaLogo';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function SignUpPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!form.username || form.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', form.username.toLowerCase())
          .maybeSingle();
        setUsernameAvailable(!data);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.username]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) e.username = '3-20 chars, letters/numbers/underscore';
    else if (usernameAvailable === false) e.username = 'Username is taken';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            username: form.username.trim().toLowerCase(),
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          showToast('An account with this email already exists', 'error');
        } else {
          showToast(error.message, 'error');
        }
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          created_at: new Date().toISOString(),
        });

        if (profileError) {
          // Hard fail — clean up the auth user and surface the error
          await supabase.auth.signOut();
          if (profileError.message?.includes('duplicate') || profileError.code === '23505') {
            showToast('Username is already taken. Please choose another.', 'error');
            setErrors({ username: 'Username taken' });
          } else if (profileError.message?.includes('relation') || profileError.code === '42P01') {
            showToast('Database setup required. Please contact support.', 'error');
          } else {
            showToast('Failed to create profile. Please try again.', 'error');
          }
          return;
        }

        if (data.session) {
          showToast('Account created! Welcome to Naka Labs', 'success');
          router.push('/dashboard');
        } else {
          showToast('Account created! Signing you in...', 'success');
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: form.email.trim().toLowerCase(),
            password: form.password,
          });
          if (!signInError) {
            router.push('/dashboard');
          } else {
            router.push('/login');
          }
        }
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
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
            Join the intelligence<br />
            <span className="text-[#0A1EFF]">revolution</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Create your account and start tracking whale movements, analyzing trading patterns, and acting on real blockchain data.
          </p>
          <div className="space-y-3">
            {['Real-time on-chain intelligence', 'AI-powered trading analysis', 'Professional security scanning'].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0A1EFF]/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-[#0A1EFF]" />
                </div>
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
              <h2 className="text-xl font-bold mb-1">Create your account</h2>
              <p className="text-gray-500 text-sm">Get started with Naka Labs</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      className={`w-full bg-white/[0.04] border ${errors.firstName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                      placeholder="John"
                      autoComplete="given-name"
                    />
                  </div>
                  {errors.firstName && <p className="text-red-400 text-[11px] mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      className={`w-full bg-white/[0.04] border ${errors.lastName ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                      placeholder="Doe"
                      autoComplete="family-name"
                    />
                  </div>
                  {errors.lastName && <p className="text-red-400 text-[11px] mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => updateField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className={`w-full bg-white/[0.04] border ${errors.username ? 'border-red-500/50' : usernameAvailable === true ? 'border-emerald-500/40' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                    placeholder="johndoe"
                    maxLength={20}
                    autoComplete="username"
                  />
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
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={`w-full bg-white/[0.04] border ${errors.email ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                    placeholder="john@example.com"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-[11px] mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className={`w-full bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-[11px] mt-1">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-4">
            By creating an account, you agree to our{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Terms of Service</span>
            {' '}and{' '}
            <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
