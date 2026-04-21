'use client';

/**
 * Fixed top-right cluster shown on every dashboard page:
 *   [ quick-translate ] [ language ] [ theme ]  [ bell* ]
 * Bell is whitelisted to /dashboard + /dashboard/profile + /profile
 * per product spec; the theme/language toggles ride along on every
 * route so they're always one tap away (user wanted them at the top,
 * next to the bell — not floating in a corner).
 */

import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import GlobalControls from '@/components/GlobalControls';

const BELL_ALLOWED = new Set([
  '/dashboard', '/dashboard/',
  '/dashboard/profile', '/dashboard/profile/',
  '/profile', '/profile/',
]);

export default function FloatingNotificationBell() {
  const pathname = usePathname();
  const showBell = !!pathname && BELL_ALLOWED.has(pathname);
  return (
    <div
      className="fixed top-3 right-3 z-50 flex items-center gap-2 print:hidden"
      style={{ pointerEvents: 'auto' }}
      data-no-translate
    >
      <GlobalControls />
      {showBell && <NotificationBell />}
    </div>
  );
}
