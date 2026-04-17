import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('watchlist')
      .select('token_id, token_symbol, user_id')
      .limit(20000);

    if (error) {
      console.error('[admin/watchlist-insights GET] Query error:', error);
      return NextResponse.json({ tokens: [], totalWatches: 0, uniqueUsers: 0 });
    }

    const buckets = new Map<string, { token_id: string; token_symbol: string; watcher_count: number; users: Set<string> }>();
    const allUsers = new Set<string>();

    for (const row of data || []) {
      const r = row as { token_id?: string; token_symbol?: string; user_id?: string };
      const tokenId = r.token_id || r.token_symbol || '';
      if (!tokenId) continue;

      const existing = buckets.get(tokenId);
      if (existing) {
        existing.watcher_count += 1;
        if (r.user_id) existing.users.add(r.user_id);
      } else {
        const users = new Set<string>();
        if (r.user_id) users.add(r.user_id);
        buckets.set(tokenId, {
          token_id: tokenId,
          token_symbol: r.token_symbol || tokenId,
          watcher_count: 1,
          users,
        });
      }
      if (r.user_id) allUsers.add(r.user_id);
    }

    const tokens = Array.from(buckets.values())
      .map(b => ({ token_id: b.token_id, token_symbol: b.token_symbol, watcher_count: b.users.size || b.watcher_count }))
      .sort((a, b) => b.watcher_count - a.watcher_count)
      .slice(0, 50);

    return NextResponse.json({
      tokens,
      totalWatches: (data || []).length,
      uniqueUsers: allUsers.size,
    });
  } catch (err) {
    console.error('[admin/watchlist-insights GET] Failed:', err);
    return NextResponse.json({ tokens: [], totalWatches: 0, uniqueUsers: 0 });
  }
}
