import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateReferralCode } from '@/lib/referral/referralCode';

export const dynamic = 'force-dynamic';

// Share of the platform trading fee that flows back to the referrer.
const REFERRAL_SHARE = 0.2;
// Platform trading fee in basis points (0.5% default). Kept in sync with the
// swap path via the same env var.
const STEINZ_FEE_BPS = Number(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS) || 50;

interface RefereeRow {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  joinedAt: string;
  feesGeneratedUsd: number;
}

/**
 * GET /api/referrals — the caller's referral dashboard.
 *
 * Ensures the caller's deterministic code is stored (so a share link resolves
 * back to them), then returns their code, share URL, referred users, and the
 * estimated rebate from those users' trading fees. Real data only: zero state
 * is honest, never invented.
 */
export async function GET(req: NextRequest) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const code = generateReferralCode(me.id);

  // Make the deterministic code reversible: store code -> referrer once.
  await sb
    .from('referral_codes')
    .upsert({ user_id: me.id, code }, { onConflict: 'user_id' });

  const origin = new URL(req.url).origin;
  const shareUrl = `${origin}/?ref=${code}`;

  // Who this user has referred.
  const { data: refRows } = await sb
    .from('referrals')
    .select('referee_id, created_at')
    .eq('referrer_id', me.id)
    .order('created_at', { ascending: false });

  const referrals = (refRows as Array<{ referee_id: string; created_at: string }> | null) ?? [];

  if (referrals.length === 0) {
    return NextResponse.json({
      code,
      shareUrl,
      referredCount: 0,
      estimatedEarningsUsd: 0,
      referees: [] as RefereeRow[],
    });
  }

  const refereeIds = referrals.map((r) => r.referee_id);
  const joinedById = new Map(referrals.map((r) => [r.referee_id, r.created_at]));

  // Profiles for the referees.
  const { data: profileRows } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', refereeIds);

  const profileById = new Map(
    ((profileRows as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }> | null) ?? [])
      .map((p) => [p.id, p]),
  );

  // Real fee generation: sum each referee's trade volume from coin_trades.
  const { data: tradeRows } = await sb
    .from('coin_trades')
    .select('user_id, usd_amount')
    .in('user_id', refereeIds);

  const volumeById = new Map<string, number>();
  for (const t of ((tradeRows as Array<{ user_id: string; usd_amount: number | null }> | null) ?? [])) {
    const amt = Number(t.usd_amount) || 0;
    volumeById.set(t.user_id, (volumeById.get(t.user_id) ?? 0) + amt);
  }

  const feeRate = STEINZ_FEE_BPS / 10000;

  const referees: RefereeRow[] = refereeIds.map((id) => {
    const p = profileById.get(id);
    const volume = volumeById.get(id) ?? 0;
    return {
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      joinedAt: joinedById.get(id) ?? '',
      feesGeneratedUsd: volume * feeRate,
    };
  });

  const totalVolume = [...volumeById.values()].reduce((a, b) => a + b, 0);
  const estimatedEarningsUsd = REFERRAL_SHARE * feeRate * totalVolume;

  return NextResponse.json({
    code,
    shareUrl,
    referredCount: referrals.length,
    estimatedEarningsUsd,
    referees,
  });
}
