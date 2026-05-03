/**
 * Tier comparison helpers. Pure, no IO — safe to import from client and
 * server. Source of truth for the tier ordering lives here; every gate
 * (API route, UI wrapper, middleware) must use checkTier so upgrades to
 * the ordering propagate.
 */

/**
 * Five-tier ladder. `naka_cult` is the apex tier, gated by holding
 * 600,000 $NAKA OR a NakaLabs NFT — not a Stripe purchase. It implies
 * full Max-tier access plus Vault / NakaCult / Sanctum / Conclave.
 */
export type Tier = "free" | "mini" | "pro" | "max" | "naka_cult";

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  mini: 1,
  pro: 2,
  max: 3,
  naka_cult: 4,
};

export interface TierCheckResult {
  allowed: boolean;
  currentTier: Tier;
  requiredTier: Tier;
  expired: boolean;
}

function normalizeTier(raw: string | null | undefined): Tier {
  const v = (raw ?? "free").toLowerCase();
  if (v === "mini" || v === "pro" || v === "max" || v === "naka_cult") return v;
  return "free";
}

export function checkTier(
  userTier: string | null | undefined,
  userTierExpiresAt: string | null | undefined,
  requiredTier: Tier,
): TierCheckResult {
  const expiresAt = userTierExpiresAt ? new Date(userTierExpiresAt) : null;
  const expired = !!(expiresAt && expiresAt.getTime() < Date.now());
  const rawTier = normalizeTier(userTier);
  const effectiveTier: Tier = expired ? "free" : rawTier;
  const allowed = TIER_ORDER[effectiveTier] >= TIER_ORDER[requiredTier];
  return { allowed, currentTier: effectiveTier, requiredTier, expired };
}
