import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Total queries
    const { count: totalQueries } = await supabase
      .from('vtx_conversations')
      .select('*', { count: 'exact', head: true });

    // Queries today
    const { count: queriesToday } = await supabase
      .from('vtx_conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // Queries this week
    const { count: queriesWeek } = await supabase
      .from('vtx_conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfWeek);

    // Top user IDs by query count (last 30 days)
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error: rowsErr } = await supabase
      .from('vtx_conversations')
      .select('user_id')
      .gte('created_at', startOfMonth)
      .limit(10000);

    if (rowsErr) {
      console.error('[admin/vtx-analytics GET] Top users error:', rowsErr);
    }

    const counts: Record<string, number> = {};
    for (const r of rows || []) {
      const uid = (r as { user_id?: string }).user_id;
      if (!uid) continue;
      counts[uid] = (counts[uid] || 0) + 1;
    }
    const topUsers = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user_id, count]) => ({ user_id, count }));

    return NextResponse.json({
      totalQueries: totalQueries || 0,
      queriesToday: queriesToday || 0,
      queriesWeek: queriesWeek || 0,
      topUsers,
    });
  } catch (err) {
    console.error('[admin/vtx-analytics GET] Failed:', err);
    return NextResponse.json({
      totalQueries: 0,
      queriesToday: 0,
      queriesWeek: 0,
      topUsers: [],
    });
  }
}
