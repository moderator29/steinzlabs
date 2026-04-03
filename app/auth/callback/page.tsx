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
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.user) {
          router.replace('/login?error=oauth_failed');
          return;
        }

        const user = session.user;
        const meta = user.user_metadata || {};

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!existingProfile) {
          const firstName = meta.full_name?.split(' ')[0] || meta.name?.split(' ')[0] || '';
          const lastName = meta.full_name?.split(' ').slice(1).join(' ') || meta.name?.split(' ').slice(1).join(' ') || '';
          const baseUsername = (meta.email || user.email || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
          const username = `${baseUsername}${Math.floor(Math.random() * 9000) + 1000}`;

          await supabase.from('profiles').upsert({
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            username: username.toLowerCase(),
            email: user.email || '',
            created_at: new Date().toISOString(),
          });
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('steinz_has_session', 'true');
        }

        router.replace('/dashboard');
      } catch {
        router.replace('/login?error=oauth_failed');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-[#0A1EFF] animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
