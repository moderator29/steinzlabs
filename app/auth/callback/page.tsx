'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SESSION_HOURS = 4;

function persistSession(session: any) {
  if (!session?.access_token) return;
  if (typeof window === 'undefined') return;
  const maxAge = SESSION_HOURS * 60 * 60;
  try {
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      expires_in: session.expires_in || 14400,
      expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 14400),
      user: session.user,
    };
    localStorage.setItem('steinz-auth-token', JSON.stringify(sessionData));
    localStorage.setItem('steinz_has_session', 'true');
  } catch {}
  document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax; Secure; max-age=${maxAge}`;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') as any;

        // Path 1: verify-email flow — we have a token_hash to exchange
        if (tokenHash) {
          // Race against an 8-second timeout so we never hang forever
          const verifyPromise = supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type || 'magiclink',
          });
          const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));

          const result = await Promise.race([verifyPromise, timeoutPromise]);

          if (!mounted) return;

          if (!result || result.error || !result.data?.session) {

            router.replace('/login?verified=true');
            return;
          }

          persistSession(result.data.session);
          // Set the middleware cookie too
          if (typeof window !== 'undefined') {
            const maxAge = 4 * 60 * 60;
            document.cookie = `steinz_session=${result.data.session.access_token}; path=/; SameSite=Lax; Secure; max-age=${maxAge}`;
          }
          setStatus('success');
          setTimeout(() => { if (mounted) window.location.href = '/dashboard'; }, 800);
          return;
        }

        // Path 2: OAuth / magic link redirect from Supabase — session is in URL hash
        await new Promise(r => setTimeout(r, 600));
        if (!mounted) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          persistSession(session);
          setStatus('success');
          setTimeout(() => { if (mounted) window.location.href = '/dashboard'; }, 800);
          return;
        }

        // Path 3: listen for onAuthStateChange (Supabase processes hash fragment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (!mounted) return;
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
              persistSession(session);
              setStatus('success');
              setTimeout(() => { if (mounted) window.location.href = '/dashboard'; }, 800);
              subscription.unsubscribe();
            }
          }
        );

        // Timeout fallback — 8 seconds then send to login
        setTimeout(() => {
          if (mounted && status === 'verifying') {
            router.replace('/login?verified=true');
          }
        }, 8000);

      } catch (err: any) {

        if (mounted) router.replace('/login?error=callback_failed');
      }
    }

    handleCallback();

    return () => { mounted = false; };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center px-6">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 text-[#0A1EFF] animate-spin mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">Verifying your account...</p>
            <p className="text-gray-500 text-sm">Logging you in now</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">You are in!</p>
            <p className="text-gray-500 text-sm">Taking you to your dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-white text-xl font-bold mb-2">Something went wrong</p>
            <p className="text-gray-500 text-sm">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#0A1EFF] animate-spin" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
