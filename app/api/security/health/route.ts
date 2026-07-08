import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * SC1: composite security health score for the dashboard hero.
 *
 * Health is driven ENTIRELY by real wallet-security posture — the things that
 * actually make a wallet safe or unsafe:
 *
 *   approvals   * 0.45   (dangerous token approvals — the #1 drain vector)
 *   threats     * 0.30   (recent actionable security alerts, 30d:
 *                          critical/high/medium/warn — advisory 'low' excluded)
 *   honeypots   * 0.25   (honeypot / cannot-sell tokens held)
 *
 * Previously reputation (a platform-engagement / gamification metric) carried
 * 50% of the weight. That made a perfectly clean wallet with zero reputation
 * points score exactly 50% "for no reason" — reputation was 0 and the three
 * real security components summed to 50. A wallet's security has nothing to do
 * with how many platform points its owner earned, so reputation is dropped from
 * the composite entirely (still computed and returned in `breakdown` for
 * display, but it no longer moves the score). A clean, audited wallet
 * reads ~95–100; each real issue visibly lowers it (see `counts` in the
 * response, surfaced in the UI so the number always has a stated reason).
 *
 * Persisted to user_security_profile so the value is consistent across the
 * dashboard's surfaces and we can show trend over time.
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

  // Threats — actionable security_alerts in the last 30d.
  //
  // The security_alerts.severity CHECK constraint permits five values:
  // 'critical' | 'high' | 'medium' | 'low' | 'warn'. Counting only
  // ['warn','critical'] silently DROPPED every 'high' and 'medium' alert —
  // i.e. the second- and third-most-severe threats never dinged the health
  // score, so a wallet with active high-severity alerts still read as clean.
  // We now count every genuinely-actionable severity; only advisory 'low' is
  // excluded so the score reflects real, exploitable risk.
  const THREAT_SEVERITIES = ['critical', 'high', 'medium', 'warn'];
  let threatCount = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('security_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('severity', THREAT_SEVERITIES)
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

  // Scan COVERAGE — has the user actually run the on-demand scanners? A wallet
  // that was never scanned has 0 rows, which is indistinguishable from
  // "scanned and clean" unless we check. Without coverage we must NOT affirm a
  // clean ~95-100 score (false safety assurance).
  let approvalScanned = false;
  let honeypotScanned = false;
  try {
    const { count } = await admin.from('approval_audit_results').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    approvalScanned = (count ?? 0) > 0;
  } catch { /* table absent */ }
  try {
    const { count } = await admin.from('user_token_security_flags').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    honeypotScanned = (count ?? 0) > 0;
  } catch { /* table absent */ }
  const scanned = approvalScanned || honeypotScanned;

  // Map raw counts into a 0–100 sub-score where 0 issues = 100.
  // Each issue subtracts a chunk; clamp so a single high-severity token
  // doesn't zero the whole component.
  const approvalScore = clamp(100 - approvalDanger * 20, 0, 100);
  const threatScore   = clamp(100 - threatCount   * 15, 0, 100);
  const honeypotScore = clamp(100 - honeypotCount * 25, 0, 100);

  // Security-driven composite from REAL security posture only — approval risk,
  // threat alerts, honeypot holdings. (Platform-standing/engagement was removed:
  // a gamification metric must not move a security number.) Null when the wallet
  // has never been scanned, so the UI shows "—" instead of a fake clean score.
  const composite = scanned
    ? Math.round(approvalScore * 0.45 + threatScore * 0.30 + honeypotScore * 0.25)
    : null;

  const breakdown: ComponentBreakdown = {
    reputation: reputationScore,
    approvals: approvalScore,
    threats: threatScore,
    honeypots: honeypotScore,
  };

  const computedAt = new Date().toISOString();

  // Never cached / never trended a fake clean score for an unscanned wallet.
  if (composite == null) {
    return NextResponse.json({
      score: null,
      scanned: false,
      breakdown,
      counts: { approvalDanger, threatCount, honeypotCount },
      computedAt,
    });
  }

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
    scanned: true,
    breakdown,
    counts: { approvalDanger, threatCount, honeypotCount },
    computedAt,
  });
}
