/**
 * Tier comparison helpers. Pure, no IO — safe to import from client and
 * server. Source of truth for the tier ordering lives here; every gate
 * (API route, UI wrapper, middleware) must use checkTier so upgrades to
 * the ordering propagate.
 */

export type Tier = "free" | "mini" | "pro" | "max";

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  mini: 1,
  pro: 2,
  max: 3,
};

export interface TierCheckResult {
  allowed: boolean;
  currentTier: Tier;
  requiredTier: Tier;
  expired: boolean;
}

function normalizeTier(raw: string | null | undefined): Tier {
  const v = (raw ?? "free").toLowerCase();
  if (v === "mini" || v === "pro" || v === "max") return v;
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
