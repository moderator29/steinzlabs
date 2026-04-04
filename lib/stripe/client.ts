let stripeInstance: any = null;

export async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  if (!stripeInstance) {
    const Stripe = (await import('stripe')).default;
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as any,
    });
  }

  return stripeInstance;
}

export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
  PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  PREMIUM_YEARLY: process.env.STRIPE_PRICE_PREMIUM_YEARLY || '',
};
