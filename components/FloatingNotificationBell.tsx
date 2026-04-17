'use client';

/**
 * FloatingNotificationBell — fixed-position bell icon visible on all dashboard
 * sub-pages (whale-tracker, smart-money, etc.) even though those pages build
 * their own headers without a notification bell.
 *
 * Placed in app/dashboard/layout.tsx so it renders on every route under /dashboard.
 * z-50 sits above sidebar (z-20) and dropdowns (z-30), below modals (z-40 inset-0).
 */

import NotificationBell from '@/components/NotificationBell';

export default function FloatingNotificationBell() {
  return (
    <div
      className="fixed top-3 right-3 z-50"
      style={{ pointerEvents: 'auto' }}
    >
      <NotificationBell />
    </div>
  );
}
