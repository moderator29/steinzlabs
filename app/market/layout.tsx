import type { Metadata } from 'next';
import BackButton from '@/components/ui/BackButton';
import { MarketSubNav } from '@/components/market/MarketSubNav';

export const metadata: Metadata = {
  title: 'Market — Naka Labs',
  description: 'Real-time prices, live charts, and on-chain intelligence across all chains.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Top bar: back button + sub-nav */}
        <div className="flex items-center justify-between mb-5">
          <BackButton href="/dashboard" label="Dashboard" />
          <MarketSubNav />
        </div>
        {children}
      </div>
    </div>
  );
}
