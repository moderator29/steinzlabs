"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import type { Tier } from "@/lib/subscriptions/tierCheck";

interface TierGateOverlayProps {
  featureName: string;
  bulletPoints: string[];
  requiredTier: Exclude<Tier, "free">;
  children: ReactNode;
}

const TIER_LABEL: Record<Exclude<Tier, "free">, string> = {
  mini: "Mini",
  pro: "Pro",
  max: "Max",
};

/**
 * Wraps a feature's UI with a blurred preview + upgrade overlay when the
 * user's tier is below the required tier. Existing feature JSX is passed
 * as children; we render it at reduced opacity behind a glass card.
 */
export default function TierGateOverlay({
  featureName,
  bulletPoints,
  requiredTier,
  children,
}: TierGateOverlayProps) {
  const tierName = TIER_LABEL[requiredTier];

  return (
    <div className="relative min-h-[60vh]">
      <div aria-hidden className="pointer-events-none select-none opacity-20 blur-md">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800/70 bg-slate-950/80 p-6 text-center shadow-2xl shadow-[#0A1EFF]/10 backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#0A1EFF]/30 bg-[#0A1EFF]/10">
            <Lock className="h-5 w-5 text-[#0A1EFF]" />
          </div>
          <h3 className="mb-1 text-lg font-bold text-white">
            {featureName} requires {tierName}
          </h3>
          <p className="mb-5 text-xs text-slate-400">
            Upgrade your plan to unlock this and more.
          </p>

          <ul className="mb-6 space-y-2 text-left">
            {bulletPoints.map((bp) => (
              <li key={bp} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0A1EFF]" />
                <span>{bp}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Link
              href="/dashboard/pricing"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A1EFF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0918D0]"
            >
              Upgrade to {tierName}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/pricing"
              className="block text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              View all plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
