import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-F.2 — tier-gated alert limits.
 *   Free → 5 active alerts (price + composite combined)
 *   Pro  → 50
 *   Max  → unlimited (-1)
 *
 * Reads from the existing profiles.settings.subscription_tier (set by
 * the Stripe webhook elsewhere). Returns { allowed, current, limit }.
 */

const TIER_LIMITS: Record<string, number> = {
  free: 5,
  pro: 50,
  max: -1,
};

export interface AlertLimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  tier: string;
}

export async function checkAlertLimit(userId: string): Promise<AlertLimitCheck> {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .maybeSingle<{ settings: Record<string, unknown> | null }>();
  const tier = ((profile?.settings as { subscription_tier?: string } | null)?.subscription_tier ?? 'free').toLowerCase();
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  // Count active price_alerts + composite_alerts.
  const [{ count: priceCount }, { count: compositeCount }] = await Promise.all([
    admin.from('price_alerts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('triggered', false),
    admin.from('composite_alerts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('active', true),
  ]);
  const current = (priceCount ?? 0) + (compositeCount ?? 0);

  return {
    allowed: limit === -1 || current < limit,
    current,
    limit,
    tier,
  };
}
