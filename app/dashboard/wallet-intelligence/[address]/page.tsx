"use client";

import { use } from "react";
import BackButton from "@/components/ui/BackButton";
import { WalletIntelligenceTabs } from "@/components/intelligence/WalletIntelligenceTabs";

export default function WalletIntelligenceDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4">
          <BackButton href="/dashboard/wallet-intelligence" label="Wallet intelligence" />
        </div>
        <WalletIntelligenceTabs address={address} />
      </div>
    </div>
  );
}
