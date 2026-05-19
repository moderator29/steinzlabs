import { ReactNode } from 'react';
import type { Metadata } from 'next';
import AlertMonitorProvider from '@/components/AlertMonitorProvider';
import SessionGuardProvider from '@/components/SessionGuardProvider';
import PlatformEventMonitor from '@/components/PlatformEventMonitor';
import FloatingNotificationBell from '@/components/FloatingNotificationBell';
import { PendingTradesBanner } from '@/components/trading/PendingTradesBanner';
import PendingSignerProvider from '@/components/trading/PendingSignerProvider';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Real-time AI-powered crypto intelligence dashboard — track whales, scan tokens, monitor your portfolio.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Aurora is lifted to the layout so every dashboard page inherits the
  // brand canvas. Per-page solid backgrounds were stripped via the
  // second-wave sweep so the aurora actually shows through.
  return (
    <AuroraBackground fullHeight>
      {/* PDF S2.4 — naka-thick-borders bumps every border-1 utility to
          1.5px inside the dashboard, giving cards / dividers / form
          inputs the firmer presence the audit asked for. Marketing
          + landing pages outside this layout stay 1px. */}
      <div className="naka-thick-borders contents">
        <SessionGuardProvider />
        <AlertMonitorProvider />
        <PlatformEventMonitor />
        <FloatingNotificationBell />
        <PendingSignerProvider />
        <PendingTradesBanner />
        {children}
      </div>
    </AuroraBackground>
  );
}
