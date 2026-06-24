'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * /dashboard/profile is a thin redirect into the dashboard with the
 * profile tab pre-selected (the dashboard owns the bottom-nav chrome
 * and the lazily-mounted ProfileTab). Two failure modes existed before:
 *
 *   1. The redirect target was /dashboard?tab=profile but the dashboard
 *      ignored the ?tab param, landing the user on the home tab. Fixed
 *      in app/dashboard/page.tsx by reading the query string.
 *   2. If useAuth() never resolved (network drop, Supabase hiccup) the
 *      spinner ran forever. Added a 10s timeout fallback with a retry
 *      button so the user is never trapped.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setTimedOut(true), 10_000);
      return () => clearTimeout(t);
    }
    if (!user) {
      router.replace('/login?from=/dashboard/profile');
    } else {
      router.replace('/dashboard?tab=profile');
    }
  }, [user, loading, router]);

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EF4444]/10">
            <AlertCircle className="w-6 h-6 text-[#EF4444]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Taking longer than expected</h2>
            <p className="text-sm text-gray-400 mt-1">
              We couldn&apos;t reach your session. Check your connection and try again.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => { setTimedOut(false); window.location.reload(); }}
              className="px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-semibold transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-sm font-semibold border border-white/[0.08] transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#0066FF] animate-spin" />
    </div>
  );
}
