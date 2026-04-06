'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// This page redirects to the main dashboard profile tab
// to avoid showing stale "Guest User" data
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login?from=/dashboard/profile');
      } else {
        // Send them to the dashboard with the profile tab active
        router.replace('/dashboard?tab=profile');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#0A1EFF] animate-spin" />
    </div>
  );
}
