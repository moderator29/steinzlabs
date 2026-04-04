export type SubscriptionTier = 'FREE' | 'PRO' | 'PREMIUM';

export interface TierFeatures {
  basicTrading: boolean;
  shadowGuardian: boolean;
  contextFeed: boolean;
  viewProofAccess: boolean;
  bubblemapsAccess: boolean;
  smartMoneyPanel: boolean;
  holderAnalysis: 'basic' | 'deep' | 'elite';
  historicalData: boolean;
  patternMatching: boolean;
  advancedOrders: boolean;
  dcaBots: boolean;
  moneyRadar: boolean;
  copyTrading: boolean;
  autoExit: boolean;
  maxWallets: number;
  maxFollowedEntities: number;
  maxAlerts: number;
  maxDCABots: number;
  apiAccess: boolean;
  realtimeData: boolean;
  historicalSnapshots: number;
  prioritySupport: boolean;
  customAlerts: boolean;
  unlimitedVtxAi: boolean;
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  FREE: {
    basicTrading: true,
    shadowGuardian: true,
    contextFeed: true,
    viewProofAccess: false,
    bubblemapsAccess: false,
    smartMoneyPanel: false,
    holderAnalysis: 'basic',
    historicalData: false,
    patternMatching: false,
    advancedOrders: false,
    dcaBots: false,
    moneyRadar: false,
    copyTrading: false,
    autoExit: false,
    maxWallets: 1,
    maxFollowedEntities: 0,
    maxAlerts: 3,
    maxDCABots: 0,
    apiAccess: false,
    realtimeData: false,
    historicalSnapshots: 0,
    prioritySupport: false,
    customAlerts: false,
    unlimitedVtxAi: false,
  },
  PRO: {
    basicTrading: true,
    shadowGuardian: true,
    contextFeed: true,
    viewProofAccess: true,
    bubblemapsAccess: true,
    smartMoneyPanel: true,
    holderAnalysis: 'deep',
    historicalData: true,
    patternMatching: true,
    advancedOrders: true,
    dcaBots: true,
    moneyRadar: true,
    copyTrading: true,
    autoExit: true,
    maxWallets: 3,
    maxFollowedEntities: 5,
    maxAlerts: 20,
    maxDCABots: 3,
    apiAccess: false,
    realtimeData: true,
    historicalSnapshots: 30,
    prioritySupport: false,
    customAlerts: false,
    unlimitedVtxAi: true,
  },
  PREMIUM: {
    basicTrading: true,
    shadowGuardian: true,
    contextFeed: true,
    viewProofAccess: true,
    bubblemapsAccess: true,
    smartMoneyPanel: true,
    holderAnalysis: 'elite',
    historicalData: true,
    patternMatching: true,
    advancedOrders: true,
    dcaBots: true,
    moneyRadar: true,
    copyTrading: true,
    autoExit: true,
    maxWallets: 10,
    maxFollowedEntities: 999,
    maxAlerts: 100,
    maxDCABots: 10,
    apiAccess: true,
    realtimeData: true,
    historicalSnapshots: 365,
    prioritySupport: true,
    customAlerts: true,
    unlimitedVtxAi: true,
  },
};

export const TIER_PRICING = {
  PRO: { monthly: 19, yearly: 190 },
  PREMIUM: { monthly: 99, yearly: 990 },
};

export function hasFeatureAccess(
  userTier: SubscriptionTier,
  feature: keyof TierFeatures
): boolean {
  const value = TIER_FEATURES[userTier][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return value !== 'basic';
}

export function getFeatureLimit(
  userTier: SubscriptionTier,
  feature: keyof TierFeatures
): number | string | boolean {
  return TIER_FEATURES[userTier][feature];
}

export function requiresUpgrade(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const tierOrder = { FREE: 0, PRO: 1, PREMIUM: 2 };
  return tierOrder[userTier] < tierOrder[requiredTier];
}
