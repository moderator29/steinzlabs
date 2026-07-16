import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';
import { guardRoute } from '@/lib/api/guardRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Copy a trader" (coins). One tap to mirror a top platform trader's COIN buys
 * through the EXISTING non-custodial copy rails. A coin-copy rule is a normal
 * user_copy_rules row scoped to a leader profile via leader_user_id (rather than
 * an on-chain whale_address). It carries copy_direction='buy' and
 * mode='oneclick' so the same relayer path (pending_trades, signed by the
 * follower's own wallet in the browser) drives the fill. No custody, no
 * auto-sign, no stored keys.
 *
 * The leader-scoped rule uses the sentinel whale_address 'coin:<leaderUserId>'
 * and chain 'coins' so the on-chain whale matcher never touches it; the
 * coin-copy dispatch mirrors the leader's coin_trades buys into that same
 * oneclick relayer flow.
 */

// Conservative one-tap defaults. The follower can retune caps in copy-trading
// settings; oneclick keeps every fill behind an in-browser signature.
const DEFAULT_MAX_PER_TRADE_USD = 25;
const DEFAULT_DAILY_CAP_USD = 250;

function sentinelWhale(leaderUserId: string): string {
  return `coin:${leaderUserId}`;
}

interface LeaderProfile {
  id: string;
  username: string | null;
  display_name: string | null;
}

/** GET /api/coins/copy?leaderUserId=... — is the caller copying this leader. */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const leaderUserId = new URL(req.url).searchParams.get('leaderUserId') ?? '';
  if (!leaderUserId) return NextResponse.json({ error: 'leaderUserId is required' }, { status: 400 });

  const isSelf = leaderUserId === user.id;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_copy_rules')
    .select('id, enabled, paused, max_per_trade_usd, daily_cap_usd')
    .eq('user_id', user.id)
    .eq('leader_user_id', leaderUserId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const copying = !!data && data.enabled === true && data.paused !== true;
  return NextResponse.json({ copying, isSelf, rule: data ?? null });
}

/** POST { leaderUserId } — start copying that leader's coin buys. */
export async function POST(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'med' });
  if (!guard.ok) return guard.response;

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { leaderUserId?: string };
  const leaderUserId = (body.leaderUserId ?? '').trim();
  if (!leaderUserId) return NextResponse.json({ error: 'leaderUserId is required' }, { status: 400 });
  if (leaderUserId === user.id) {
    return NextResponse.json({ error: 'You cannot copy yourself' }, { status: 400 });
  }

  // Copy trading is a Pro feature, matching the whale copy rails.
  const gate = await checkTierServer('pro');
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdmin();

  // Leader must be a real profile.
  const { data: leader } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', leaderUserId)
    .maybeSingle<LeaderProfile>();
  if (!leader) return NextResponse.json({ error: 'Trader not found' }, { status: 404 });

  const { error } = await admin.from('user_copy_rules').upsert(
    {
      user_id: user.id,
      leader_user_id: leaderUserId,
      whale_address: sentinelWhale(leaderUserId),
      chain: 'coins',
      mode: 'oneclick',
      copy_direction: 'buy',
      max_per_trade_usd: DEFAULT_MAX_PER_TRADE_USD,
      daily_cap_usd: DEFAULT_DAILY_CAP_USD,
      require_confirmation: true,
      enabled: true,
      paused: false,
      // Seed the cursor to now so the monitor only mirrors buys made AFTER the
      // follower opted in, never a leader's pre-existing trades.
      coin_last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,leader_user_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ copying: true });
}

/** DELETE ?leaderUserId=... (or { leaderUserId }) — stop copying. */
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let leaderUserId = new URL(req.url).searchParams.get('leaderUserId') ?? '';
  if (!leaderUserId) {
    const body = (await req.json().catch(() => ({}))) as { leaderUserId?: string };
    leaderUserId = (body.leaderUserId ?? '').trim();
  }
  if (!leaderUserId) return NextResponse.json({ error: 'leaderUserId is required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_copy_rules')
    .delete()
    .eq('user_id', user.id)
    .eq('leader_user_id', leaderUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ copying: false });
}
