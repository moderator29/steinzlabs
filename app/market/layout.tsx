import type { Metadata } from 'next';
import { MarketSubNav } from '@/components/market/MarketSubNav';

export const metadata: Metadata = {
  title: 'Market Intelligence — Steinz Labs',
  description: 'Real-time prices, live charts, and on-chain intelligence across all chains.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Market Intelligence</h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time prices and on-chain intelligence across all chains</p>
          </div>
          <MarketSubNav />
        </div>
        {children}
      </div>
    </div>
  );
}
