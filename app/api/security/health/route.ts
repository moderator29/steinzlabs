import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * SC1: composite security health score for the dashboard hero.
 *
 *   walletReputation.score    * 0.50
 *   approvalRisks.dangerCount * 0.20   (inverted: more risk → lower score)
 *   threatCount               * 0.15
 *   honeypotsHeld             * 0.15
 *
 * Persisted to user_security_profile so the value is consistent across
 * the dashboard's various surfaces and we can show trend (compare
 * computed_at → now and flag improvement / regression).
 */

export const runtime = 'nodejs';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

interface ComponentBreakdown {
  reputation: number;
  approvals: number;
  threats: number;
  honeypots: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(_req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Reputation (0–100). user_reputation.points is unbounded; we map it
  // log-style so the bottom of the scale isn't dominated by mega-rep users.
  const { data: rep } = await admin
    .from('user_reputation')
    .select('points')
    .eq('user_id', user.id)
    .maybeSingle<{ points: number | null }>();
  const repPoints = Number(rep?.points ?? 0);
  const reputationScore = clamp(Math.round(Math.log10(repPoints + 1) * 25), 0, 100);

  // Approvals — count rows the approvals scanner flagged as danger.
  // approval_audit_results may not exist on every project; defensive .catch().
  let approvalDanger = 0;
  try {
    const { count } = await admin
      .from('approval_audit_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('risk_band', 'danger');
    approvalDanger = count ?? 0;
  } catch { /* table absent on prod yet */ }

  // Threats — security_alerts at WARN/CRITICAL severity in the last 30d.
  let threatCount = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('security_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('severity', ['warn', 'critical'])
      .gt('created_at', thirtyDaysAgo);
    threatCount = count ?? 0;
  } catch { /* table absent */ }

  // Honeypots held — tokens in the user's portfolio flagged by GoPlus.
  let honeypotCount = 0;
  try {
    const { count } = await admin
      .from('user_token_security_flags')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_honeypot', true);
    honeypotCount = count ?? 0;
  } catch { /* table absent */ }

  // Map raw counts into a 0–100 sub-score where 0 issues = 100.
  // Each issue subtracts a chunk; clamp so a single high-severity token
  // doesn't zero the whole component.
  const approvalScore = clamp(100 - approvalDanger * 20, 0, 100);
  const threatScore   = clamp(100 - threatCount   * 15, 0, 100);
  const honeypotScore = clamp(100 - honeypotCount * 25, 0, 100);

  const composite = Math.round(
    reputationScore * 0.50 +
    approvalScore   * 0.20 +
    threatScore     * 0.15 +
    honeypotScore   * 0.15,
  );

  const breakdown: ComponentBreakdown = {
    reputation: reputationScore,
    approvals: approvalScore,
    threats: threatScore,
    honeypots: honeypotScore,
  };

  const computedAt = new Date().toISOString();

  // Upsert the cache row. RLS only lets the owner SELECT; service role
  // writes here.
  await admin.from('user_security_profile').upsert({
    user_id: user.id,
    health_score: composite,
    reputation_score: reputationScore,
    approval_risk: approvalDanger,
    threat_count: threatCount,
    honeypot_count: honeypotCount,
    computed_at: computedAt,
    metadata: { breakdown },
  }, { onConflict: 'user_id' });

  // Append an immutable snapshot so the Security Center can render a real
  // health-score trend over time. The cache row above is single-row-per-user
  // (upsert), so it holds no history on its own. We only log when the score
  // actually moved (or on the first ever snapshot) to avoid flat-lining the
  // trend with identical no-op reads. Table is additive; degrade quietly if
  // the migration hasn't been applied yet.
  try {
    const { data: last } = await admin
      .from('user_security_profile_history')
      .select('health_score')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ health_score: number }>();

    if (!last || last.health_score !== composite) {
      await admin.from('user_security_profile_history').insert({
        user_id: user.id,
        health_score: composite,
        reputation_score: reputationScore,
        approval_risk: approvalDanger,
        threat_count: threatCount,
        honeypot_count: honeypotCount,
        breakdown,
        computed_at: computedAt,
      });
    }
  } catch { /* history table absent until migration applied */ }

  return NextResponse.json({
    score: composite,
    breakdown,
    counts: { approvalDanger, threatCount, honeypotCount },
    computedAt,
  });
}
