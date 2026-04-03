'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, Lock, Loader2, Check, X } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';

function getPasswordChecks(pw: string) {
  return [
    { label: 'Between 8 and 100 characters', ok: pw.length >= 8 && pw.length <= 100 },
    { label: 'At least one lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'At least one uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'At least one number', ok: /[0-9]/.test(pw) },
    { label: 'At least one special character', ok: /[^a-zA-Z0-9]/.test(pw) },
  ];
}

function ResetPasswordInner() {
  const router = useRouter();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function checkSession() {
      try {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setReady(true);
        }
      } catch {}
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true);
      }
    });

    return () => { try { listener?.subscription?.unsubscribe(); } catch {} };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!getPasswordChecks(password).every(c => c.ok)) {
      setError('Password does not meet requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        if (updateError.message.toLowerCase().includes('same')) {
          showToast('New password must be different from current password.', 'error');
        } else {
          showToast(updateError.message, 'error');
        }
        return;
      }

      showToast('Password updated successfully!', 'success');
      router.push('/login?confirmed=reset');
    } catch (err: any) {
      showToast('Failed to update password. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
            <Shield className="w-8 h-8 text-[#0A1EFF]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Invalid or expired link</h2>
          <p className="text-gray-500 text-sm mb-6">This password reset link is no longer valid. Please request a new one.</p>
          <Link href="/forgot-password" className="inline-block bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">
            Request New Link
          </Link>
        </div>
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
          <SteinzLogo size={32} />
          <span className="text-base font-bold tracking-tight">STEINZ LABS</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">Set your new<br /><span className="text-[#0A1EFF]">password</span></h1>
          <p className="text-gray-400 text-sm leading-relaxed">Choose a strong password to secure your account. You'll be signed in immediately after.</p>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 STEINZ LABS. All rights reserved.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center mb-8">
            <Link href="/" className="flex items-center gap-2"><SteinzLogo size={28} /><span className="text-sm font-bold">STEINZ LABS</span></Link>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
              <Lock className="w-8 h-8 text-[#0A1EFF]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create new password</h2>
            <p className="text-gray-500 text-sm">Your new password must be different from your previous one</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-12 pr-12 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {getPasswordChecks(password).map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2">
                      {ok ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <X className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                      <span className={`text-xs ${ok ? 'text-emerald-400' : 'text-gray-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  className={`w-full bg-white/[0.04] border ${error ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0A1EFF]/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0E1A]" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
