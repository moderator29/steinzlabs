import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/search-logs — admin view of recent platform searches.
 *
 * The admin nav + page linked here but the route never existed (404 → the page
 * silently showed its empty state). Back it with the real `search_logs` table
 * (id, user_id, search_type, query, results_count, created_at). Returns the
 * exact shape the page consumes; honest empty payload on any error — never
 * fabricated rows.
 */
const EMPTY = {
  totalSearches: 0,
  uniqueQueries: 0,
  noResultRatePct: 0,
  top: [] as Array<{ query: string; count: number; chain: string; noResults: boolean }>,
  recent: [] as Array<{ query: string; userId: string; timestamp: number; found: boolean }>,
  hourly: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, searches: 0 })),
};

interface SearchRow {
  user_id: string | null;
  search_type: string | null;
  query: string | null;
  results_count: number | null;
  created_at: string;
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await sb
      .from('search_logs')
      .select('user_id, search_type, query, results_count, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error || !data) return NextResponse.json(EMPTY);

    const rows = data as SearchRow[];
    const totalSearches = rows.length;
    const uniqueQueries = new Set<string>();
    let noResultCount = 0;

    const byQuery = new Map<string, { query: string; count: number; chain: string; noResults: boolean }>();
    for (const r of rows) {
      const q = (r.query ?? '').trim();
      const noRes = (r.results_count ?? 0) === 0;
      if (noRes) noResultCount++;
      if (q) {
        uniqueQueries.add(q.toLowerCase());
        const cur = byQuery.get(q.toLowerCase()) ?? { query: q, count: 0, chain: r.search_type ?? '', noResults: noRes };
        cur.count++;
        byQuery.set(q.toLowerCase(), cur);
      }
    }

    const top = Array.from(byQuery.values()).sort((a, b) => b.count - a.count).slice(0, 20);

    const recent = rows.slice(0, 50).map((r) => ({
      query: r.query ?? '',
      userId: r.user_id ?? '',
      timestamp: new Date(r.created_at).getTime(),
      found: (r.results_count ?? 0) > 0,
    }));

    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, searches: 0 }));
    const dayAgo = Date.now() - 24 * 3_600_000;
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      if (t >= dayAgo) hourly[new Date(r.created_at).getUTCHours()].searches++;
    }

    return NextResponse.json({
      totalSearches,
      uniqueQueries: uniqueQueries.size,
      noResultRatePct: totalSearches > 0 ? Math.round((noResultCount / totalSearches) * 100) : 0,
      top,
      recent,
      hourly,
    });
  } catch {
    return NextResponse.json(EMPTY);
  }
}
