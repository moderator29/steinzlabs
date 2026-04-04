import { getStripe, STRIPE_PRICE_IDS } from './client';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { SubscriptionTier } from '../subscriptions/tiers';

export interface CreateCheckoutParams {
  userId: string;
  tier: 'PRO' | 'PREMIUM';
  interval: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<string> {
  const stripe = await getStripe();
  const { userId, tier, interval, successUrl, cancelUrl } = params;

  const priceKey = `${tier}_${interval.toUpperCase()}` as keyof typeof STRIPE_PRICE_IDS;
  const priceId = STRIPE_PRICE_IDS[priceKey];

  if (!priceId) {
    throw new Error(`Invalid price configuration: ${tier} ${interval}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, tier, interval },
    subscription_data: { metadata: { userId, tier } },
  });

  return session.url!;
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function handleSubscriptionSuccess(subscription: any): Promise<void> {
  const userId = subscription.metadata.userId;
  const tier = subscription.metadata.tier as SubscriptionTier;

  if (!userId || !tier) return;

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      subscription_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', userId);
}

export async function handleSubscriptionCancellation(subscription: any): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'FREE',
      subscription_status: 'canceled',
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', userId);
}

export async function getUserSubscription(userId: string): Promise<{
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('subscription_tier, subscription_status, subscription_current_period_end, stripe_subscription_id')
    .eq('id', userId)
    .single();

  if (!user) {
    throw new Error('User not found');
  }

  let cancelAtPeriodEnd = false;

  if (user.stripe_subscription_id) {
    try {
      const stripe = await getStripe();
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch {}
  }

  return {
    tier: user.subscription_tier || 'FREE',
    status: user.subscription_status || 'active',
    currentPeriodEnd: user.subscription_current_period_end
      ? new Date(user.subscription_current_period_end)
      : null,
    cancelAtPeriodEnd,
  };
}
