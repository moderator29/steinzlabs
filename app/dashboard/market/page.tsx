"use client";

import { Suspense, lazy } from "react";
import { HowItWorksButton } from "@/components/common/HowItWorks";
import BackButton from "@/components/ui/BackButton";
import { marketHowItWorks } from "@/lib/howItWorks/content/market";

// Same canonical markets front the dashboard home Markets sub-tab renders,
// so the standalone route and the sub-tab are guaranteed identical (the
// side-nav "Market" entry points here). Lazy so the heavy token list + RWA
// board only load once this route is opened.
const MarketsView = lazy(() => import("@/components/market/MarketsView"));

function MarketsSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
    </div>
  );
}

export default function DashboardMarketPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Explicit back-to-dashboard breadcrumb so a user opening
          /dashboard/market via a direct link always has a clear way home. */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <a href="/dashboard" className="hover:text-slate-200 transition-colors">Dashboard</a>
        <span className="text-slate-700">/</span>
        <span className="text-slate-300">Market</span>
      </nav>
      <div className="flex items-start gap-2 sm:gap-3">
        <BackButton className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white">Market</h1>
          <p className="text-sm text-slate-400">Live prices across the top assets. Click any row to open its trading terminal.</p>
        </div>
        <HowItWorksButton content={marketHowItWorks} className="shrink-0 mt-1" />
      </div>

      <Suspense fallback={<MarketsSpinner />}>
        <MarketsView />
      </Suspense>
    </div>
  );
}
