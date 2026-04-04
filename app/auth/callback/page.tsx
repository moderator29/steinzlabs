'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('steinz_has_session', 'true');
            document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax; Secure; max-age=${60 * 60 * 48}`;
          }
          router.replace('/dashboard');
        } else {
          router.replace('/login?verified=true');
        }
      } catch {
        router.replace('/login?verified=true');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Verifying your account...</p>
      </div>
    </div>
  );
}
