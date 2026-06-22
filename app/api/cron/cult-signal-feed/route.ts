import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Signal Pulse feeder — turns the cult's OWN Conviction Board into a signal
 * stream. When >= CONSENSUS_MIN distinct members post the same asset in the
 * same direction within a 48h window, we emit a "conviction consensus" signal.
 *
 * Derives only from cult tables (no external API, no unverified schema), so the
 * Pulse populates with genuinely cult-native signal. The team can also push
 * curated signals directly via POST /api/admin/cult/signals.
 *
 * dedup_key (one per asset+direction+UTC-day) makes inserts idempotent, so
 * running this often never duplicates a signal. Runs hourly.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONSENSUS_MIN = 3;
const WINDOW_MS = 48 * 3600_000;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('cult-signal-feed', startedAt, async () => {
    const admin = getSupabaseAdmin();
    const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
    const dayBucket = new Date().toISOString().slice(0, 10);

    const { data: recent } = await admin
      .from('cult_convictions')
      .select('asset, direction, user_id')
      .gte('created_at', sinceIso)
      .limit(1000);

    // Group by normalized asset + direction → set of distinct members.
    const groups = new Map<string, { asset: string; direction: string; members: Set<string> }>();
    for (const c of recent ?? []) {
      const norm = String(c.asset).replace(/^\$/, '').trim().toLowerCase();
      if (!norm) continue;
      const key = `${norm}|${c.direction}`;
      const g = groups.get(key) ?? { asset: String(c.asset).trim(), direction: String(c.direction), members: new Set<string>() };
      g.members.add(String(c.user_id));
      groups.set(key, g);
    }

    let emitted = 0;
    for (const g of groups.values()) {
      const count = g.members.size;
      if (count < CONSENSUS_MIN) continue;
      const norm = g.asset.replace(/^\$/, '').trim().toLowerCase();
      const dedupKey = `consensus:${norm}:${g.direction}:${dayBucket}`;

      const { data, error } = await admin
        .from('cult_signals')
        .upsert(
          {
            kind: 'conviction_consensus',
            title: `Conviction consensus — ${count} cultists ${g.direction} ${g.asset}`,
            severity: 'watch',
            dedup_key: dedupKey,
            detail: {
              message: `${count} members independently called ${g.asset} ${g.direction} in the last 48h.`,
              asset: g.asset,
              direction: g.direction,
              members: count,
            },
          },
          { onConflict: 'dedup_key', ignoreDuplicates: true },
        )
        .select('id');
      if (!error && data && data.length > 0) emitted += 1;
    }

    await logCronExecution('cult-signal-feed', 'success', Date.now() - startedAt, undefined, emitted);
    return cronResponse('cult-signal-feed', startedAt, { groups: groups.size, emitted });
  });
}
