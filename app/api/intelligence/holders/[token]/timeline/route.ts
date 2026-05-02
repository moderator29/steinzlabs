import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §11 — Time-series concentration data for the BubbleMap timeline
 * chart. Reads public.holder_snapshots, which is written-on-read by
 * the parent /api/intelligence/holders/[token] route (one row per
 * token+chain+day).
 *
 * Public, cached 5 minutes — concentration changes slowly enough
 * that aggressive caching is fine, and this endpoint is hit on
 * every Intelligence page render.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(request.url);
  const chain = url.searchParams.get('chain') ?? 'unknown';
  const days = Math.min(365, Math.max(7, parseInt(url.searchParams.get('days') ?? '90', 10) || 90));

  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from('holder_snapshots')
      .select('snapped_at, holder_count, top10_pct')
      .eq('token_address', token)
      .eq('chain', chain)
      .gte('snapped_at', since)
      .order('snapped_at', { ascending: true });

    if (error) {
      return NextResponse.json({ snapshots: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { snapshots: data ?? [], days, chain, token },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
    );
  } catch (e) {
    return NextResponse.json(
      { snapshots: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
