import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MarketSubNav } from '@/components/market/MarketSubNav';

export const metadata: Metadata = {
  title: 'Market — Steinz Labs',
  description: 'Real-time prices, live charts, and on-chain intelligence across all chains.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Top bar: back button + sub-nav */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <MarketSubNav />
        </div>
        {children}
      </div>
    </div>
  );
}
