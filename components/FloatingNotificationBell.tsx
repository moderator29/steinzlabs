'use client';

/**
 * FloatingNotificationBell — renders ONLY on /dashboard and /dashboard/profile
 * per product spec. Every other route returns null (landing, trading, whale
 * tracker, copy trading, clusters, etc.).
 */

import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

const ALLOWED = new Set([
  '/dashboard',
  '/dashboard/',
  '/dashboard/profile',
  '/dashboard/profile/',
  '/profile',
  '/profile/',
]);

export default function FloatingNotificationBell() {
  const pathname = usePathname();
  if (!pathname || !ALLOWED.has(pathname)) return null;
  return (
    <div className="fixed top-3 right-3 z-50" style={{ pointerEvents: 'auto' }}>
      <NotificationBell />
    </div>
  );
}
