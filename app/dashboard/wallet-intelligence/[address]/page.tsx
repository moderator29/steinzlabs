"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WalletIntelligenceTabs } from "@/components/intelligence/WalletIntelligenceTabs";

export default function WalletIntelligenceDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link
          href="/dashboard/wallet-intelligence"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-4"
        >
          <ArrowLeft size={12} /> Wallet intelligence
        </Link>
        <WalletIntelligenceTabs address={address} />
      </div>
    </div>
  );
}
