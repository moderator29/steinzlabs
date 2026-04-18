import 'server-only';
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
    // FIX 5A.1: was reading `subscription_tier` column (doesn't exist) and returning 'FREE' uppercase —
    // DB column is `tier` with lowercase enum values; mismatch is why paid users saw "Upgrade" button.
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, tier_expires_at, verified_badge')
      .eq('id', user.id)
      .single();

    const tier = (profile?.tier || 'free').toLowerCase();
    const upperTier = tier.toUpperCase();
    const features =
      TIER_FEATURES[upperTier as keyof typeof TIER_FEATURES] || TIER_FEATURES.FREE;

    return NextResponse.json({
      tier: upperTier,
      status: 'active',
      tierLower: tier,
      tierExpiresAt: profile?.tier_expires_at || null,
      verifiedBadge: profile?.verified_badge || null,
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
