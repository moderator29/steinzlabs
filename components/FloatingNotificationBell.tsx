'use client';

/**
 * FloatingNotificationBell — fixed-position bell shown ONLY on the main
 * dashboard (/dashboard) and profile (/dashboard/profile, /profile) per
 * product spec. Any other route renders nothing.
 */

import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

const ALLOWED = new Set(['/dashboard', '/dashboard/', '/dashboard/profile', '/dashboard/profile/', '/profile', '/profile/']);

export default function FloatingNotificationBell() {
  const pathname = usePathname();
  if (!pathname || !ALLOWED.has(pathname)) return null;
  return (
    <div className="fixed top-3 right-3 z-50" style={{ pointerEvents: 'auto' }}>
      <NotificationBell />
    </div>
  );
}
