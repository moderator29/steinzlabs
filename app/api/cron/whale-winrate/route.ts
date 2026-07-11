import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Whale win-rate recompute cron.
 * GET /api/cron/whale-winrate
 *
 * Runs the recompute_whale_winrates() SQL function, which:
 *   1. Nulls impossible 7d volumes (raw-unit data artifacts) so cards never show
 *      a garbage $2.5e20-style number that overflows the layout.
 *   2. Computes a REAL realized win rate for every whale with >=3 closed round-
 *      trip positions in whale_activity (per-token average-cost basis). Whales
 *      with no closable positions keep an honest n/a — no fabricated rate.
 *
 * As whale_activity ingests more history, coverage grows automatically. Auth is
 * the shared CRON_SECRET (Vercel Cron sends it as a Bearer token / ?secret=).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const qs = req.nextUrl.searchParams.get('secret') || '';
    const ok = auth === `Bearer ${secret}` || qs === secret;
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('recompute_whale_winrates');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data ?? null });
}
