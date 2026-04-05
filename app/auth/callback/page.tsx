'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        if (!mounted) return;
        if (event === 'SIGNED_IN' && session?.user) {
          setStatus('success');
          if (typeof window !== 'undefined') {
            localStorage.setItem('steinz_has_session', 'true');
            document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax; Secure; max-age=${60 * 60 * 48}`;
          }
          setTimeout(() => {
            if (mounted) router.replace('/dashboard');
          }, 1500);
        }
      }
    );

    async function checkSession() {
      try {
        await new Promise(r => setTimeout(r, 1000));
        if (!mounted) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setStatus('success');
          if (typeof window !== 'undefined') {
            localStorage.setItem('steinz_has_session', 'true');
            document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax; Secure; max-age=${60 * 60 * 48}`;
          }
          setTimeout(() => {
            if (mounted) router.replace('/dashboard');
          }, 1500);
        } else {
          setStatus('success');
          setTimeout(() => {
            if (mounted) router.replace('/login?confirmed=pending');
          }, 2000);
        }
      } catch {
        if (mounted) {
          setStatus('success');
          router.replace('/login?confirmed=pending');
        }
      }
    }

    checkSession();

    timeout = setTimeout(() => {
      if (mounted && status === 'verifying') {
        setStatus('success');
        router.replace('/login?confirmed=pending');
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      try { subscription?.unsubscribe(); } catch {}
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Verifying your account...</p>
            <p className="text-gray-500 text-sm">This will only take a moment</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Email verified!</p>
            <p className="text-gray-500 text-sm">Redirecting you now...</p>
          </>
        )}
      </div>
    </div>
  );
}
