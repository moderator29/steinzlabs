import { ReactNode } from "react";
import { checkTierServer } from "@/lib/subscriptions/serverTierCheck";
import TierGateOverlay from "@/components/tier/TierGateOverlay";

export default async function WhaleTrackerLayout({ children }: { children: ReactNode }) {
  // Viewing the tracker is a Mini feature (matches the pricing page and the
  // 'mini'-gated feed/top-today/watchlist APIs). Write actions — following
  // whales, alerts, copy-trade — stay Pro+ and are enforced at those APIs, so
  // Mini users can browse the feed they paid for instead of hitting a wall.
  const check = await checkTierServer("mini");
  if (check.allowed) return <>{children}</>;
  return (
    <TierGateOverlay
      featureName="Whale Tracker"
      requiredTier="mini"
      bulletPoints={[
        "Live feed of large on-chain moves across EVM and Solana",
        "Entity labels (exchanges, market makers, known funds)",
        "Whale directory with scores, PnL and win rates",
        "Upgrade to Pro to follow whales and get real-time alerts",
      ]}
    >
      {children}
    </TierGateOverlay>
  );
}
