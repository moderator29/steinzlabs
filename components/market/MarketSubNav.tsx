'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Star } from 'lucide-react';

// §4.7 — "Trade" tab removed. The standalone trading terminal at
// /market/trade was deleted per product spec; users now click any coin
// from /market/prices to open its coin-detail page (chart + Buy/Sell).
const TABS = [
  { label: 'Prices', path: '/market/prices', icon: BarChart2 },
  { label: 'Watchlist', path: '/market/watchlist', icon: Star },
];

export function MarketSubNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 p-1 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path);
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              active
                ? 'bg-[#0A1EFF] text-white shadow-[0_0_12px_rgba(10,30,255,0.4)]'
                : 'text-gray-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
