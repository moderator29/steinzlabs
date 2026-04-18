import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

interface FeatureRow {
  name: string;
  usage_count: number;
  unique_users: number;
}

async function aggregateFromTable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  label: string,
  userField: string,
  since: string,
): Promise<FeatureRow> {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);

    const { data: usersData } = await supabase
      .from(table)
      .select(userField)
      .gte('created_at', since)
      .limit(20000);

    const uniqueUsers = new Set<string>();
    for (const r of usersData || []) {
      const uid = (r as unknown as Record<string, unknown>)[userField];
      if (typeof uid === 'string' && uid) uniqueUsers.add(uid);
    }

    return { name: label, usage_count: count || 0, unique_users: uniqueUsers.size };
  } catch (err) {
    console.error(`[admin/feature-usage] Failed aggregating ${table}:`, err);
    return { name: label, usage_count: 0, unique_users: 0 };
  }
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Try the unified feature_events table first
    try {
      const { data: events, error } = await supabase
        .from('feature_events')
        .select('feature, user_id')
        .gte('created_at', since)
        .limit(50000);

      if (!error && events && events.length > 0) {
        const map = new Map<string, { count: number; users: Set<string> }>();
        for (const row of events) {
          const r = row as { feature?: string; user_id?: string };
          if (!r.feature) continue;
          const entry = map.get(r.feature) || { count: 0, users: new Set<string>() };
          entry.count += 1;
          if (r.user_id) entry.users.add(r.user_id);
          map.set(r.feature, entry);
        }
        const features = Array.from(map.entries())
          .map(([name, v]) => ({ name, usage_count: v.count, unique_users: v.users.size }))
          .sort((a, b) => b.usage_count - a.usage_count);
        return NextResponse.json({ features });
      }
    } catch {
      // Table may not exist; fall through to per-table aggregation
    }

    // Fall back to aggregating across known feature tables
    const features = await Promise.all([
      aggregateFromTable(supabase, 'vtx_conversations', 'VTX AI', 'user_id', since),
      aggregateFromTable(supabase, 'sniper_executions', 'Sniper', 'user_id', since),
      aggregateFromTable(supabase, 'swap_logs', 'Swap', 'user_id', since),
      aggregateFromTable(supabase, 'security_scans', 'Security Scan', 'user_id', since),
      aggregateFromTable(supabase, 'alerts', 'Alerts', 'user_id', since),
    ]);

    features.sort((a, b) => b.usage_count - a.usage_count);
    return NextResponse.json({ features });
  } catch (err) {
    console.error('[admin/feature-usage GET] Failed:', err);
    return NextResponse.json({ features: [] });
  }
}
