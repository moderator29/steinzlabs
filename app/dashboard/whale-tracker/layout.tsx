import { ReactNode } from "react";
import { checkTierServer } from "@/lib/subscriptions/serverTierCheck";
import TierGateOverlay from "@/components/tier/TierGateOverlay";

export default async function WhaleTrackerLayout({ children }: { children: ReactNode }) {
  const check = await checkTierServer("pro");
  if (check.allowed) return <>{children}</>;
  return (
    <TierGateOverlay
      featureName="Whale Tracker"
      requiredTier="pro"
      bulletPoints={[
        "Live feed of large on-chain moves across EVM and Solana",
        "Follow up to 50 whales with real-time alerts",
        "Entity labels (exchanges, market makers, known funds)",
        "Full whale profile: holdings, PnL, counterparties",
      ]}
    >
      {children}
    </TierGateOverlay>
  );
}
