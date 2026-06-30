import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Feed diagnostics (#61). Reports the real state of the ingested firehose —
 * total rows, per-chain + per-launchpad breakdown, freshest row, and how many
 * carry logos/socials — so the live deploy can be verified at a glance instead
 * of guessing whether data is real. No mock data: pure counts from the table.
 */
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { count: total } = await sb.from('sniper_feed_tokens').select('id', { count: 'exact', head: true });
    const { data: rows } = await sb
      .from('sniper_feed_tokens')
      .select('chain, launchpad, logo_url, has_social, first_seen_at, pool_created_at')
      .order('first_seen_at', { ascending: false })
      .limit(5000);

    const byChain: Record<string, number> = {};
    const byLaunchpad: Record<string, number> = {};
    let withLogo = 0, withSocial = 0;
    let freshest: string | null = null;
    for (const r of (rows ?? []) as Array<{ chain: string; launchpad: string | null; logo_url: string | null; has_social: boolean | null; first_seen_at: string }>) {
      byChain[r.chain] = (byChain[r.chain] ?? 0) + 1;
      const lp = r.launchpad ?? 'dex';
      byLaunchpad[lp] = (byLaunchpad[lp] ?? 0) + 1;
      if (r.logo_url) withLogo++;
      if (r.has_social) withSocial++;
      if (!freshest || r.first_seen_at > freshest) freshest = r.first_seen_at;
    }

    const sampled = rows?.length ?? 0;
    return NextResponse.json({
      ok: true,
      total: total ?? 0,
      sampled,
      freshestSeenAt: freshest,
      ageOfFreshestSec: freshest ? Math.round((Date.now() - Date.parse(freshest)) / 1000) : null,
      logoCoverage: sampled ? Math.round((withLogo / sampled) * 100) : 0,
      socialCoverage: sampled ? Math.round((withSocial / sampled) * 100) : 0,
      byChain,
      byLaunchpad,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
