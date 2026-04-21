import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkTier, type Tier } from '@/lib/subscriptions/tierCheck';

// FIX 5A.1: unified tier resolver — profiles.tier is source of truth.
// Returns lowercase tier + booleans so UI has no reason to read raw fields.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({
        tier: 'free' as Tier,
        isPaid: false,
        isPro: false,
        isMax: false,
        verifiedBadge: null,
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, tier_expires_at, verified_badge, role')
      .eq('id', user.id)
      .single();

    const result = checkTier(profile?.tier, profile?.tier_expires_at, 'free');
    // Admins get unconditional Max — they built the platform, they get
    // everything. Also if the stored tier is already 'max' and role is
    // admin, ignore any expiry (internal accounts shouldn't be downgraded).
    const isAdmin = profile?.role === 'admin';
    const tier = isAdmin ? 'max' : result.currentTier;

    return NextResponse.json(
      {
        tier,
        isPaid: tier !== 'free',
        isPro: tier === 'pro' || tier === 'max',
        isMax: tier === 'max',
        isAdmin,
        verifiedBadge: profile?.verified_badge || null,
        tierExpiresAt: profile?.tier_expires_at || null,
        expired: isAdmin ? false : result.expired,
      },
      { headers: { 'Cache-Control': 'private, max-age=10' } },
    );
  } catch {
    return NextResponse.json({
      tier: 'free' as Tier,
      isPaid: false,
      isPro: false,
      isMax: false,
      verifiedBadge: null,
    });
  }
}
