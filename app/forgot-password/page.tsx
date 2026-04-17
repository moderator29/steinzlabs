'use client';

import { useState } from 'react';
import { Shield, Mail, ArrowLeft, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import { useToast } from '@/components/Toast';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to send reset email.', 'error');
        return;
      }

      setSent(true);
    } catch {
      showToast('Unable to connect. Check your internet connection.', 'error');
    } finally {
      setLoading(false);
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
          <span className="text-base font-bold tracking-tight">NAKA LABS</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">Reset your<br /><span className="text-[#0A1EFF]">password</span></h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">Enter your email and we will send you a link to reset your password and get back into your account.</p>
          <div className="space-y-3">
            {['Secure password reset', 'Link expires in 1 hour', 'Check spam folder if not received'].map(t => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0A1EFF]/10 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-[#0A1EFF]" /></div>
                <span className="text-sm text-gray-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600">&copy; 2026 NAKA LABS. All rights reserved.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2"><SteinzLogo size={28} /><span className="text-sm font-bold">NAKA LABS</span></Link>
            <Link href="/login" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Back to login</Link>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-[#0A1EFF]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#0A1EFF]/20">
              <Shield className="w-8 h-8 text-[#0A1EFF]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{sent ? 'Check your email' : 'Forgot password?'}</h2>
            <p className="text-gray-500 text-sm">{sent ? 'We sent a password reset link to your email' : 'Enter your email to receive a reset link'}</p>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div className="bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-xl p-5 text-center">
                <Mail className="w-10 h-10 text-[#0A1EFF] mx-auto mb-3" />
                <p className="text-sm text-gray-300 mb-1">Reset link sent to</p>
                <p className="text-white font-medium">{email}</p>
                <p className="text-xs text-gray-500 mt-3">Check your inbox and spam folder for the email from NAKA LABS.</p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="w-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white py-4 rounded-xl font-semibold text-base transition-all"
              >
                Try another email
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Back to sign in</Link>
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      className={`w-full bg-white/[0.04] border ${error ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl pl-12 pr-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors`}
                      placeholder="john@example.com"
                      autoComplete="email"
                      autoFocus
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{' '}
                <Link href="/login" className="text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-medium transition-colors">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
