'use client';

// Platform-wide back-button behavior. Owner bug (2026-07-03): every feature's
// Back button hardcoded router.push('/dashboard'), so going Feature → detail
// page → Back dumped the user on the dashboard instead of the page they came
// from. window.history.length alone can't distinguish "navigated here in-app"
// from "arrived with pre-existing browser history" (SPA navs never update
// document.referrer), so we count in-app route changes ourselves in
// sessionStorage and only walk real in-app history.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { useRouter } from 'next/navigation';

const DEPTH_KEY = 'naka_nav_depth';

function readDepth(): number {
  try {
    return parseInt(sessionStorage.getItem(DEPTH_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeDepth(n: number): void {
  try {
    sessionStorage.setItem(DEPTH_KEY, String(Math.max(0, n)));
  } catch {
    /* storage unavailable — smartBack falls back to the fallback route */
  }
}

/**
 * Mount once (dashboard layout). Increments the in-app depth on every
 * pathname change; popstate (browser/hardware back) decrements so the
 * counter tracks the real stack instead of growing forever.
 */
export function useNavDepthTracker(): void {
  const pathname = usePathname();

  useEffect(() => {
    const onPop = () => writeDepth(readDepth() - 2); // popstate also fires the pathname effect (+1), net -1
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    writeDepth(readDepth() + 1);
  }, [pathname]);
}

/**
 * Go back to the page that actually brought the user here; only when this is
 * the first in-app page of the session (deep link, refresh, new tab) route to
 * the fallback instead of walking out of the site.
 */
export function smartBack(router: ReturnType<typeof useRouter>, fallback = '/dashboard'): void {
  if (typeof window !== 'undefined' && readDepth() > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}
