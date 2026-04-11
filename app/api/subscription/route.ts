import { NextRequest, NextResponse } from 'next/server';
import { TIER_FEATURES, TIER_PRICING } from '@/lib/subscriptions/tiers';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'FREE';
    const features = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || TIER_FEATURES.FREE;

    return NextResponse.json({
      tier,
      status: profile?.subscription_status || 'active',
      features,
      pricing: TIER_PRICING,
    });
  } catch (error: any) {

    return NextResponse.json({
      tier: 'FREE',
      status: 'active',
      features: TIER_FEATURES.FREE,
      pricing: TIER_PRICING,
    });
  }
}
