import { ReactNode } from 'react';
import type { Metadata } from 'next';
import FloatingBackButton from '@/components/FloatingBackButton';
import AlertMonitorProvider from '@/components/AlertMonitorProvider';
import SessionGuardProvider from '@/components/SessionGuardProvider';
import PlatformEventMonitor from '@/components/PlatformEventMonitor';
import FloatingNotificationBell from '@/components/FloatingNotificationBell';
import { FloatingSupportButton } from '@/components/support/FloatingSupportButton';

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
      {children}
      <FloatingBackButton />
      <FloatingSupportButton />
    </div>
  );
}
