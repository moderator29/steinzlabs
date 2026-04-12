import 'server-only';
import Stripe from 'stripe';
import { stripe, STRIPE_PRICE_IDS } from './client';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { SubscriptionTier } from '../subscriptions/tiers';

export interface CreateCheckoutParams {
  userId: string;
  tier: 'PRO' | 'PREMIUM';
  interval: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

// =====================================================================
// Create Stripe checkout session
// =====================================================================
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<string> {
  const { userId, tier, interval, successUrl, cancelUrl } = params;

  // Get price ID
  const priceKey = `${tier}_${interval.toUpperCase()}` as keyof typeof STRIPE_PRICE_IDS;
  const priceId = STRIPE_PRICE_IDS[priceKey];

  if (!priceId) {
    throw new Error(`Invalid price configuration: ${tier} ${interval}`);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      tier,
      interval,
    },
    subscription_data: {
      metadata: {
        userId,
        tier,
      },
    },
  });

  return session.url!;
}

// =====================================================================
// Create customer portal session (manage subscription)
// =====================================================================
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// =====================================================================
// Handle successful subscription
// =====================================================================
export async function handleSubscriptionSuccess(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;
  const tier = subscription.metadata.tier as SubscriptionTier;

  if (!userId || !tier) {
    console.error('Missing metadata in subscription');
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Update user subscription in database
  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq('id', userId);

  console.log(`✅ Subscription activated: User ${userId} → ${tier}`);
}

// =====================================================================
// Handle subscription cancellation
// =====================================================================
export async function handleSubscriptionCancellation(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;

  if (!userId) return;

  const supabaseAdmin = getSupabaseAdmin();

  // Downgrade to FREE at period end
  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'FREE',
      subscription_status: 'canceled',
      subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq('id', userId);

  console.log(`❌ Subscription canceled: User ${userId} → FREE at period end`);
}

// =====================================================================
// Get user's subscription status
// =====================================================================
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

  // If has active Stripe subscription, check cancel status
  if (user.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch (error) {
      console.error('Failed to get Stripe subscription:', error);
    }
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
