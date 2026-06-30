import { ReactNode } from 'react';
import type { Metadata } from 'next';
import SessionGuardProvider from '@/components/SessionGuardProvider';
import PlatformEventMonitor from '@/components/PlatformEventMonitor';
import NotificationBell from '@/components/NotificationBell';
import GlobalControls from '@/components/GlobalControls';
import { PendingTradesBanner } from '@/components/trading/PendingTradesBanner';
import PendingSignerProvider from '@/components/trading/PendingSignerProvider';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { MaxWelcomeJourney } from '@/components/onboarding/MaxWelcomeJourney';

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
        <PlatformEventMonitor />
        <PendingSignerProvider />
        <PendingTradesBanner />
        <MaxWelcomeJourney />
        {/* Persistent top-right header cluster — the realtime notification bell
            now lives in the layout so it renders on EVERY authenticated route,
            not just the dashboard home tab. */}
        <div
          className="fixed top-3 right-3 z-[var(--z-header-items)] flex items-center gap-2 print:hidden"
          data-no-translate
        >
          <GlobalControls />
          <NotificationBell />
        </div>
        {children}
      </div>
    </AuroraBackground>
  );
}
