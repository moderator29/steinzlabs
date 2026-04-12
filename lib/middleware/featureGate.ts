import { hasFeatureAccess, requiresUpgrade, SubscriptionTier, TierFeatures } from '../subscriptions/tiers';

export class FeatureGateError extends Error {
  requiredTier: SubscriptionTier;

  constructor(message: string, requiredTier: SubscriptionTier) {
    super(message);
    this.requiredTier = requiredTier;
    this.name = 'FeatureGateError';
  }
}

// =====================================================================
// Check feature access (throw error if no access)
// =====================================================================
export function requireFeature(
  userTier: SubscriptionTier,
  feature: keyof TierFeatures,
  requiredTier: SubscriptionTier = 'PRO'
): void {
  if (requiresUpgrade(userTier, requiredTier)) {
    throw new FeatureGateError(
      `This feature requires ${requiredTier} subscription`,
      requiredTier
    );
  }
}

// =====================================================================
// Check usage limit
// =====================================================================
export function checkLimit(
  userTier: SubscriptionTier,
  limitType: string,
  currentUsage: number,
  maxLimit: number
): boolean {
  return currentUsage < maxLimit;
}

// =====================================================================
// Gate response helper for API routes
// =====================================================================
export function gateResponse(requiredTier: SubscriptionTier) {
  return {
    error: `This feature requires ${requiredTier} subscription`,
    requiredTier,
    upgradeUrl: '/pricing',
  };
}
