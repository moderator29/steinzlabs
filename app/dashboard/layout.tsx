import { ReactNode } from 'react';
import type { Metadata } from 'next';
import AlertMonitorProvider from '@/components/AlertMonitorProvider';
import SessionGuardProvider from '@/components/SessionGuardProvider';
import PlatformEventMonitor from '@/components/PlatformEventMonitor';
import FloatingNotificationBell from '@/components/FloatingNotificationBell';
import { PendingTradesBanner } from '@/components/trading/PendingTradesBanner';
import PendingSignerProvider from '@/components/trading/PendingSignerProvider';
import GlobalControls from '@/components/GlobalControls';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Real-time AI-powered crypto intelligence dashboard — track whales, scan tokens, monitor your portfolio.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <SessionGuardProvider />
      <AlertMonitorProvider />
      <PlatformEventMonitor />
      <FloatingNotificationBell />
      <PendingSignerProvider />
      <PendingTradesBanner />
      <div className="fixed top-3 right-3 z-30" data-no-translate>
        <GlobalControls />
      </div>
      {children}
    </div>
  );
}
