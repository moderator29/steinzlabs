import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/social/block-analytics
 *
 * Aggregates the social_blocks and social_mutes tables to surface
 * "most-blocked" and "most-muted" users — strong signals of bad
 * actors. Returns top 20 of each, joined with profile basics.
 */

export async function GET(req: NextRequest) {
  const adminId = await verifyAdminRequest(req);
  if (!adminId) return unauthorizedResponse();
  const sb = getSupabaseAdmin();

  const [blocksRes, mutesRes] = await Promise.all([
    sb.from('social_blocks').select('blocked_id'),
    sb.from('social_mutes').select('muted_id'),
  ]);
  const blockCounts = aggCount((blocksRes.data ?? []).map((r) => r.blocked_id));
  const muteCounts = aggCount((mutesRes.data ?? []).map((r) => r.muted_id));

  const topBlock = topN(blockCounts, 20);
  const topMute = topN(muteCounts, 20);

  const ids = Array.from(new Set([...topBlock.map(([id]) => id), ...topMute.map(([id]) => id)]));
  const { data: profiles } = ids.length
    ? await sb.from('profiles').select('id, username, display_name, avatar_url, tier').in('id', ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    most_blocked: topBlock.map(([id, count]) => ({ count, profile: byId.get(id) ?? null })),
    most_muted: topMute.map(([id, count]) => ({ count, profile: byId.get(id) ?? null })),
  });
}

function aggCount(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}
function topN(m: Map<string, number>, n: number): Array<[string, number]> {
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}
