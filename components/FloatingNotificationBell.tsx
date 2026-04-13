'use client';

/**
 * FloatingNotificationBell — fixed-position bell icon visible on all dashboard
 * sub-pages (whale-tracker, smart-money, etc.) even though those pages build
 * their own headers without a notification bell.
 *
 * Placed in app/dashboard/layout.tsx so it renders on every route under /dashboard.
 * z-index 150 keeps it below full-screen modals (z-50 / inset-0) but above regular content.
 */

import NotificationBell from '@/components/NotificationBell';

export default function FloatingNotificationBell() {
  return (
    <div
      className="fixed top-3 right-3 z-[150]"
      style={{ pointerEvents: 'auto' }}
    >
      <NotificationBell />
    </div>
  );
}
