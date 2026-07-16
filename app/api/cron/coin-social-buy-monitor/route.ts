import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createUserNotification } from '@/lib/social/subscriberNotify';
import { getTopTraders } from '@/lib/coins/social';
import { compactUsd } from '@/lib/coins/format';
import { verifyCron } from '../_shared';

/**
 * Social buy-alert poller. For every armed coin_social_alerts row it finds the
 * BUY trades on that coin since the row's last_seen_at made by the relevant
 * cohort (scope 'following' = the owner's accepted follows; scope 'proven' =
 * the Proven trader set), and if any exist it notifies the owner naming who
 * bought and how much, with a deep link to the coin page, then advances
 * last_seen_at. Cohorts are resolved once per distinct owner (following) or
 * once globally (proven). Real data only: an alert never fires without a real
 * on-platform buy, and an empty cohort is an honest no-op.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Window used to compute the Proven trader set (realized + unrealized PnL
// leaderboard). getTopTraders returns positive-PnL users ranked; we treat that
// ranked set as "Proven".
const PROVEN_DAYS = 30;
const PROVEN_LIMIT = 100;

interface AlertRow {
  id: string;
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  scope: 'following' | 'proven';
  last_seen_at: string;
}

interface BuyRow {
  user_id: string;
  usd_amount: number | string;
  created_at: string;
}

interface ProfileLite {
  id: string;
  username: string | null;
  display_name: string | null;
}

function nameOf(p: ProfileLite | undefined, fallbackId: string): string {
  if (p?.display_name && p.display_name.trim()) return p.display_name.trim();
  if (p?.username && p.username.trim()) return `@${p.username.trim()}`;
  return `${fallbackId.slice(0, 8)}`;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const { data: alertsData } = await db
    .from('coin_social_alerts')
    .select('id, user_id, chain, token_key, token_address, symbol, scope, last_seen_at')
    .eq('active', true)
    .limit(1000);

  const alerts = (alertsData ?? []) as AlertRow[];
  if (alerts.length === 0) return NextResponse.json({ ok: true, checked: 0, fired: 0 });

  // Proven set resolved once, only when a 'proven' alert exists.
  let provenIds: Set<string> | null = null;
  const needProven = alerts.some((a) => a.scope === 'proven');
  if (needProven) {
    const top = await getTopTraders(PROVEN_DAYS, PROVEN_LIMIT).catch(() => []);
    provenIds = new Set(top.map((t) => t.user.id));
  }

  // Following cohort resolved once per distinct owner that has a 'following' alert.
  const followCache = new Map<string, Set<string>>();
  async function followsOf(ownerId: string): Promise<Set<string>> {
    const cached = followCache.get(ownerId);
    if (cached) return cached;
    const { data } = await db
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', ownerId)
      .eq('status', 'accepted');
    const set = new Set(((data as Array<{ following_id: string }>) ?? []).map((f) => f.following_id));
    followCache.set(ownerId, set);
    return set;
  }

  let fired = 0;
  for (const a of alerts) {
    // Clone the cohort per alert: the shared proven set (and the per-owner
    // follow cache) must not be mutated by the owner-exclusion below, or a
    // later alert would see a cohort with members silently removed.
    const cohort = new Set(a.scope === 'proven' ? (provenIds ?? new Set<string>()) : await followsOf(a.user_id));
    // Never notify the owner about their own buys.
    cohort.delete(a.user_id);
    if (cohort.size === 0) continue;

    const { data: buysData } = await db
      .from('coin_trades')
      .select('user_id, usd_amount, created_at')
      .eq('chain', a.chain)
      .eq('token_key', a.token_key)
      .eq('side', 'buy')
      .gt('created_at', a.last_seen_at)
      .in('user_id', Array.from(cohort))
      .order('created_at', { ascending: true })
      .limit(500);

    const buys = (buysData ?? []) as BuyRow[];
    if (buys.length === 0) continue;

    // Advance the watermark to the newest buy we saw, so overlapping runs never
    // double-notify the same trade.
    const newestAt = buys.reduce((max, b) => (b.created_at > max ? b.created_at : max), a.last_seen_at);

    const buyerIds = [...new Set(buys.map((b) => b.user_id))];
    const { data: profData } = await db
      .from('profiles')
      .select('id, username, display_name')
      .in('id', buyerIds);
    const profiles = new Map<string, ProfileLite>();
    for (const p of (profData as ProfileLite[]) ?? []) profiles.set(p.id, p);

    const totalUsd = buys.reduce((sum, b) => sum + (Number(b.usd_amount) || 0), 0);
    const sym = a.symbol ? `$${a.symbol}` : 'this coin';
    const cohortLabel = a.scope === 'proven' ? 'Proven trader' : 'Someone you follow';

    let title: string;
    let body: string;
    if (buyerIds.length === 1) {
      const name = nameOf(profiles.get(buyerIds[0]), buyerIds[0]);
      title = `${name} bought ${sym}`;
      body = a.scope === 'proven'
        ? `${name} (Proven trader) bought ${compactUsd(totalUsd)} of ${sym}.`
        : `${name} bought ${compactUsd(totalUsd)} of ${sym}.`;
    } else {
      const lead = nameOf(profiles.get(buyerIds[0]), buyerIds[0]);
      title = `${buyerIds.length} ${a.scope === 'proven' ? 'Proven traders' : 'people you follow'} bought ${sym}`;
      body = `${lead} and ${buyerIds.length - 1} more bought ${compactUsd(totalUsd)} of ${sym} in total.`;
    }

    // One failed notification must not abort the remaining alerts.
    try {
      await createUserNotification({
        userId: a.user_id,
        type: 'coin_social_alert',
        title,
        body,
        url: `/dashboard/coins/${a.chain}/${encodeURIComponent(a.token_address)}`,
        metadata: {
          chain: a.chain,
          token_key: a.token_key,
          token_address: a.token_address,
          symbol: a.symbol,
          scope: a.scope,
          buyers: buyerIds.length,
          total_usd: totalUsd,
          cohort: cohortLabel,
        },
      });
      fired++;
    } catch { /* skip this alert's notification; watermark still advances */ }

    await db
      .from('coin_social_alerts')
      .update({ last_seen_at: newestAt })
      .eq('id', a.id);
  }

  return NextResponse.json({ ok: true, checked: alerts.length, fired });
}
