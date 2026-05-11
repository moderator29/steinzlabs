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
      <SessionGuardProvider />
      <AlertMonitorProvider />
      <PlatformEventMonitor />
      <FloatingNotificationBell />
      <PendingSignerProvider />
      <PendingTradesBanner />
      {children}
    </AuroraBackground>
  );
}
