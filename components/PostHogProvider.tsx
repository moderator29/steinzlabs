'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, getPostHog } from '@/lib/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    const ph = getPostHog();
    if (ph && pathname) {
      ph.capture('$pageview', { $current_url: window.location.href });
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}
