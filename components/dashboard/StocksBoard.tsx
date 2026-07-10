'use client';

import { Suspense, lazy } from 'react';
import { CandlestickChart } from 'lucide-react';

// The RWA / TradFi (stocks + tokenized real-world-asset) board is the real
// data source here. It used to render at the bottom of MarketsView; the home
// shell now splits crypto (Market tab) from equities/RWA (this Stocks tab) so
// the two asset classes stop competing on one screen. Lazy so its price feeds
// only load when the Stocks tab is actually opened.
const RwaBoard = lazy(() => import('@/components/markets/RwaBoard'));

function StocksSectionSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
    </div>
  );
}

/**
 * StocksBoard — the home **Stocks** sub-tab surface.
 *
 * Wraps the canonical RWA / TradFi board (real equity + tokenized-RWA prices)
 * that was carved out of MarketsView. Structured with a labelled section so
 * real per-equity charts can be slotted in above the board later without
 * another refactor. Real data only — no fabricated tickers or charts.
 */
export default function StocksBoard() {
  return (
    <div className="space-y-4">
      {/* Section intro — flat lucide icon, glass, brand blue. */}
      <div className="nl-glass rounded-2xl px-4 py-3.5 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#0066FF]/[0.10] shrink-0">
          <CandlestickChart className="w-4 h-4 text-[#4D6BFF]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Stocks &amp; Real-World Assets</h3>
          <p className="text-xs text-[#B4C0E0] mt-0.5">
            Live equities and tokenized RWA prices — kept separate from the crypto Market view.
          </p>
        </div>
      </div>

      {/* Real RWA / TradFi board (equities + tokenized RWA). */}
      <Suspense fallback={<StocksSectionSpinner />}>
        <RwaBoard />
      </Suspense>
    </div>
  );
}
