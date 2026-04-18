import { ReactNode } from "react";
import { checkTierServer } from "@/lib/subscriptions/serverTierCheck";
import TierGateOverlay from "@/components/tier/TierGateOverlay";

export default async function WalletClustersLayout({ children }: { children: ReactNode }) {
  const check = await checkTierServer("pro");
  if (check.allowed) return <>{children}</>;
  return (
    <TierGateOverlay
      featureName="Wallet Clusters"
      requiredTier="pro"
      bulletPoints={[
        "Interactive graph of coordinated wallet groups",
        "Community + AI-generated cluster labels",
        "Evidence trail behind every connection",
        "Jump from a cluster to any member's full profile",
      ]}
    >
      {children}
    </TierGateOverlay>
  );
}
