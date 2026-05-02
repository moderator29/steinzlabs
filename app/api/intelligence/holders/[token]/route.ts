import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { loadHolderIntelligence } from '@/lib/intelligence/holderAnalysis';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const chain = request.nextUrl.searchParams.get('chain') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    const intelligence = await loadHolderIntelligence(token, chain, limit);

    // §11 — write-on-read holder snapshot. Captures today's
    // (holder_count, top10_pct) into public.holder_snapshots so the
    // BubbleMapTimelineChart has a real time series to draw. Rate-
    // limited to 1 row per (token, chain, calendar day) by a partial
    // unique index — see migration 2026_holder_snapshots_uniq_day.
    //
    // Best-effort: if the upsert fails (column missing, network
    // hiccup, etc.) we still return the intelligence to the client.
    void persistSnapshot(token, chain ?? 'unknown', intelligence.totalHolders, intelligence.topHolders);

    return NextResponse.json(intelligence);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load holder intelligence' },
      { status: 500 }
    );
  }
}

async function persistSnapshot(
  tokenAddress: string,
  chain: string,
  holderCount: number,
  topHolders: Array<{ percentage: number }>,
): Promise<void> {
  try {
    const top10Pct = topHolders.slice(0, 10).reduce((s, h) => s + (h.percentage ?? 0), 0);
    const supabase = getSupabaseAdmin();
    // Upsert one row per (token, chain, day). The partial unique
    // index on date_trunc('day', snapped_at) makes onConflict safe
    // via the snap_date generated column.
    await supabase.from('holder_snapshots').upsert(
      {
        token_address: tokenAddress,
        chain,
        holder_count: holderCount,
        top10_pct: top10Pct,
        snapped_at: new Date().toISOString(),
      },
      { onConflict: 'token_address,chain,snap_date' },
    );
  } catch {
    // Best-effort; never break the client request because of
    // observability writes.
  }
}
