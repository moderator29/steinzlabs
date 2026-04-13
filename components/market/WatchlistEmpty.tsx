'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';

export function WatchlistEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#111827] border border-[#1E2433] flex items-center justify-center mb-5">
        <Star size={28} className="text-gray-600" />
      </div>

      <h3 className="text-white font-semibold text-base mb-2">No tokens in watchlist</h3>

      <p className="text-gray-500 text-sm max-w-xs mb-6">
        Add tokens from the Markets tab to track their prices and performance here.
      </p>

      <Link
        href="/dashboard/market"
        className="
          inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
          bg-[#0A1EFF] hover:bg-[#0A1EFF]/90
          text-white text-sm font-semibold
          transition-colors
        "
      >
        Browse Markets
      </Link>
    </div>
  );
}
