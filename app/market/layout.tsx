import type { Metadata } from 'next';
import BackButton from '@/components/ui/BackButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export const metadata: Metadata = {
  title: 'Market — Naka Labs',
  description: 'Real-time prices, live charts, and on-chain intelligence across all chains.',
};

// Bug §3c — the side-nav MarketSubNav (Prices / Watchlist / Orders
// chips) was the entry point to the deprecated /market list pages.
// Those pages now redirect to /dashboard/market, so the sub-nav is
// gone. Only /market/orders remains a real surface (trading orders),
// reachable from /dashboard.
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 py-4">
          <div className="mb-5">
            <BackButton href="/dashboard" label="Dashboard" />
          </div>
          {children}
        </div>
      </div>
    </AuroraBackground>
  );
}
