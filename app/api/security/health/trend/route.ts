import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health-score trend for the Security Center.
 *
 * Reads real snapshots from user_security_profile_history (written by
 * /api/security/health each time the score changes). Returns the ordered
 * series plus a computed delta between the earliest and latest snapshot in
 * the window. When only one snapshot exists there is no honest trend to show,
 * so `delta` is null and the caller renders the current score alone.
 */

interface Snapshot {
  health_score: number;
  computed_at: string;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  // Look back 90 days; cap points so the sparkline stays light.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await admin
      .from('user_security_profile_history')
      .select('health_score, computed_at')
      .eq('user_id', user.id)
      .gte('computed_at', since)
      .order('computed_at', { ascending: true })
      .limit(200)
      .returns<Snapshot[]>();

    if (error) {
      return NextResponse.json({ points: [], delta: null, available: false });
    }

    const points = data ?? [];
    // Only a genuine trend when at least two real snapshots exist.
    const delta =
      points.length >= 2
        ? points[points.length - 1].health_score - points[0].health_score
        : null;

    return NextResponse.json({
      points,
      current: points.length ? points[points.length - 1].health_score : null,
      delta,
      available: true,
    });
  } catch {
    return NextResponse.json({ points: [], delta: null, available: false });
  }
}
