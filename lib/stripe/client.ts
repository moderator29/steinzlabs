import 'server-only';
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as any,
});

export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY!,
  PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY!,
  PREMIUM_YEARLY: process.env.STRIPE_PRICE_PREMIUM_YEARLY!,
};
