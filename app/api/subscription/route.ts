import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription } from '@/lib/stripe/subscriptions';
import { TIER_FEATURES, TIER_PRICING } from '@/lib/subscriptions/tiers';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);
    const features = TIER_FEATURES[subscription.tier];

    return NextResponse.json({
      ...subscription,
      features,
      pricing: TIER_PRICING,
    });
  } catch (error: any) {
    console.error('Subscription lookup error:', error);
    return NextResponse.json({
      tier: 'FREE',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      features: TIER_FEATURES.FREE,
      pricing: TIER_PRICING,
    });
  }
}
