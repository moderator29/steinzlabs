import 'server-only';

// Crypto-native tier pricing (no Stripe — the owner pays only Anthropic +
// Vercel, and the platform is non-custodial/crypto-native). Users pay USDC to
// a treasury address; the payment-verify cron grants the tier on confirmation.

export type PaidTier = 'mini' | 'pro' | 'max';

export const TIER_PRICE_USD: Record<PaidTier, number> = {
  mini: 5,
  pro: 9,
  max: 15,
};

/** Tier length granted per payment. */
export const TIER_DURATION_DAYS = 30;

/** How long a created payment stays open before it expires unpaid. */
export const PAYMENT_WINDOW_MINUTES = 60;

/**
 * EVM chains we watch for incoming USDC. Treasury address is shared across
 * EVM chains (same address works on all EVM networks). Solana support is a
 * follow-up (needs SPL transfer parsing) — intentionally omitted for v1 so we
 * never claim a path we don't verify.
 */
export const PAYMENT_CHAINS: Array<{ id: string; label: string; usdc: string }> = [
  { id: 'base', label: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 'arbitrum', label: 'Arbitrum', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { id: 'polygon', label: 'Polygon', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  { id: 'ethereum', label: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
];

export function isPaymentChain(chain: string): boolean {
  return PAYMENT_CHAINS.some((c) => c.id === chain);
}

/** Treasury address that receives payments. Configured in Vercel env. */
export function treasuryAddress(): string | null {
  return process.env.TREASURY_EVM_ADDRESS || null;
}

/**
 * Amount tolerance (in USDC) when matching an on-chain transfer to a pending
 * payment. Small because we use a unique cents offset per payment.
 */
export const AMOUNT_MATCH_TOLERANCE = 0.005;
