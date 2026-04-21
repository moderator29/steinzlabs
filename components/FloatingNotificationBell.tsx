'use client';

/**
 * Fixed top-right cluster shown ONLY on the main dashboard + profile
 * pages (same whitelist as the notification bell). Product rule:
 *   [ quick-translate ] [ language ] [ theme ]  [ bell ]
 * never appears on wallet / market / whale-tracker / coin-detail etc.
 * because those pages have their own sticky headers and the floating
 * cluster disrupts the layout (reported against the coin-detail page).
 */

import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import GlobalControls from '@/components/GlobalControls';

const ALLOWED = new Set([
  '/dashboard', '/dashboard/',
  '/dashboard/profile', '/dashboard/profile/',
  '/profile', '/profile/',
]);

export default function FloatingNotificationBell() {
  const pathname = usePathname();
  if (!pathname || !ALLOWED.has(pathname)) return null;
  return (
    <div
      className="fixed top-3 right-3 z-50 flex items-center gap-2 print:hidden"
      style={{ pointerEvents: 'auto' }}
      data-no-translate
    >
      <GlobalControls />
      <NotificationBell />
    </div>
  );
}
