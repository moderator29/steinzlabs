'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SESSION_HOURS = 4;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success'>('verifying');

  useEffect(() => {
    let mounted = true;

    function persistSession(session: any) {
      if (!session?.access_token) return;
      if (typeof window === 'undefined') return;
      const maxAge = SESSION_HOURS * 60 * 60;
      localStorage.setItem('steinz_has_session', 'true');
      document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax; Secure; max-age=${maxAge}`;
    }

    function goToDashboard() {
      if (!mounted) return;
      setStatus('success');
      setTimeout(() => { if (mounted) router.replace('/dashboard'); }, 800);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        if (!mounted) return;
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          persistSession(session);
          goToDashboard();
        }
      }
    );

    async function checkExisting() {
      try {
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          persistSession(session);
          goToDashboard();
          return;
        }
      } catch {}

      setTimeout(() => {
        if (mounted && status === 'verifying') {
          router.replace('/login?verified=true');
        }
      }, 6000);
    }

    checkExisting();

    return () => {
      mounted = false;
      try { subscription?.unsubscribe(); } catch {}
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center px-6">
        {status === 'verifying' ? (
          <>
            <Loader2 className="w-12 h-12 text-[#0A1EFF] animate-spin mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">Verifying your account...</p>
            <p className="text-gray-500 text-sm">Logging you in now</p>
          </>
        ) : (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">You are in!</p>
            <p className="text-gray-500 text-sm">Taking you to your dashboard...</p>
          </>
        )}
      </div>
    </div>
  );
}
