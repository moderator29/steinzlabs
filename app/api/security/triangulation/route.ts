import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { triangulateHoneypot } from '@/lib/security/honeypotTriangulator';
import {
  fetchGoPlusVerdict,
  fetchHoneypotIsVerdict,
  fetchDeFiVerdict,
  fetchRugCheckVerdict,
} from '@/lib/security/sourceFetchers';

/**
 * GET /api/security/triangulation?chain=...&token=...
 *
 * Multi-source honeypot triangulation. Reads cached verdicts (<6h)
 * for each of (GoPlus, Honeypot.is, de.fi, RugCheck), then fans out
 * to refresh anything stale, then runs the deterministic
 * triangulateHoneypot() voter to produce a single confidence-tagged
 * verdict + source breakdown.
 *
 * Response shape matches TriangulationBadgeStackProps so the SecurityPanel
 * can drop the JSON straight in.
 */

const Q = z.object({
  chain: z.string().min(1).max(32),
  token: z.string().min(8).max(128),
});

const CACHE_TTL_SEC = 6 * 60 * 60; // 6 hours

type Source = 'goplus' | 'honeypot_is' | 'de_fi' | 'rugcheck';

const FETCHERS: Record<Source, (chain: string, token: string) => Promise<{ verdict: 'honeypot' | 'safe' | 'unknown'; raw: unknown }>> = {
  goplus:      fetchGoPlusVerdict,
  honeypot_is: fetchHoneypotIsVerdict,
  de_fi:       fetchDeFiVerdict,
  rugcheck:    fetchRugCheckVerdict,
};

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    chain: req.nextUrl.searchParams.get('chain'),
    token: req.nextUrl.searchParams.get('token'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chain, token } = parsed.data;

  const sb = getSupabaseAdmin();
  const { data: cached } = await sb
    .from('security_source_verdicts')
    .select('source, verdict, fetched_at')
    .eq('chain', chain)
    .eq('token_address', token);

  const cutoff = new Date(Date.now() - CACHE_TTL_SEC * 1000);
  const fresh = new Map<Source, 'honeypot' | 'safe' | 'unknown'>();
  for (const row of cached ?? []) {
    const fetchedAt = new Date(row.fetched_at);
    if (fetchedAt >= cutoff) fresh.set(row.source as Source, row.verdict as 'honeypot' | 'safe' | 'unknown');
  }

  // Fan out to stale / missing sources in parallel
  const allSources: Source[] = ['goplus', 'honeypot_is', 'de_fi', 'rugcheck'];
  const toFetch = allSources.filter((s) => !fresh.has(s));
  if (toFetch.length > 0) {
    const results = await Promise.all(toFetch.map(async (src) => {
      const out = await FETCHERS[src](chain, token);
      return { src, ...out };
    }));
    for (const r of results) {
      fresh.set(r.src, r.verdict);
      // Cache write
      await sb.from('security_source_verdicts').upsert(
        { chain, token_address: token, source: r.src, verdict: r.verdict, raw: (r.raw ?? null) as Record<string, unknown> | null, fetched_at: new Date().toISOString() },
        { onConflict: 'chain,token_address,source' },
      );
    }
  }

  const verdict = triangulateHoneypot({
    goPlus:      fresh.get('goplus')      ?? 'unknown',
    honeypotIs:  fresh.get('honeypot_is') ?? 'unknown',
    rugCheck:    fresh.get('rugcheck')    ?? 'unknown',
    deFi:        fresh.get('de_fi')       ?? 'unknown',
  });

  return NextResponse.json({
    chain,
    token,
    refreshed: toFetch,
    verdict,
  });
}
