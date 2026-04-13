import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-11-20.acacia' as any,
    });
  }
  return _stripe;
}

// Lazy proxy — Stripe only initialises on first actual usage (inside a request
// handler), not at module-load time during Next.js build.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return (getStripeInstance() as any)[prop];
  },
});

export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY!,
  PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY!,
  PREMIUM_YEARLY: process.env.STRIPE_PRICE_PREMIUM_YEARLY!,
};
