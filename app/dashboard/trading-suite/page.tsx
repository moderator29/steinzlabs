"use client";

import { Suspense } from "react";
import { TradingTerminalLayout } from "@/components/trading/TradingTerminalLayout";
import { NakaLoader } from "@/components/brand/NakaLoader";

export default function TradingSuitePage() {
  return (
    <Suspense fallback={<NakaLoader text="Loading trading terminal..." />}>
      <TradingTerminalLayout />
    </Suspense>
  );
}
