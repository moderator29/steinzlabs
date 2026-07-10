import { NextRequest } from 'next/server';
import { verifyCron, cronResponse, cronHasWork, logCronExecution, withCronErrorReporting } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyGiftOnChain } from '@/app/api/wire/gift/_verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * gift-confirm — flips Wire gifts from 'pending' to 'confirmed' once the
 * recorded on-chain transfer is verified to have succeeded, and marks long-dead
 * pending gifts 'failed'.
 *
 * WHY: /api/wire/gift/record inserts a gift as 'pending' and attempts an inline
 * confirm, but a transfer that is still propagating when the record request
 * returns would stay 'pending' forever — and the profile Gifts tab only shows
 * 'confirmed' gifts. This cron is the backstop that sweeps recent pending gifts
 * and confirms the real ones.
 *
 * Honest + idempotent:
 *   - Never marks 'confirmed' without observing a real successful tx on-chain
 *     (EVM receipt.status===0x1 to the recipient; Solana signature confirmed/
 *     finalized with err===null). See app/api/wire/gift/_verify.ts.
 *   - Only ever transitions rows still in 'pending' (guarded UPDATE), so
 *     concurrent runs / the inline path can't double-write or regress a row.
 *   - A gift whose tx is still unobservable is LEFT pending until it either
 *     confirms or ages past DROP_AFTER_MS with no on-chain trace, at which point
 *     it's a dropped/replaced tx and is marked 'failed'.
 *
 * Read-only on-chain, non-custodial: no keys, no funds movement.
 *
 * ── WIRE-UP (lead): register 'gift-confirm' in the dispatch group map at
 *    app/api/cron/dispatch/[group]/route.ts — add it to the 'frequent' group
 *    (~every 2 min) so newly-recorded gifts confirm quickly. No vercel.json
 *    change is needed (the dispatcher already fans out that group). No DB
 *    migration is required: wire_gifts.status already permits
 *    'pending' | 'confirmed' | 'failed'.
 */

const CRON_NAME = 'gift-confirm';
// How many pending gifts to inspect per run. Native transfers confirm in
// seconds–minutes, so the pending backlog is normally tiny; the cap just bounds
// a cold-start sweep.
const MAX_PER_RUN = 50;
// Only sweep gifts recorded within this window — older still-pending rows have
// already been resolved to confirmed/failed by a prior run.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
// A pending gift with no observable on-chain trace after this long is a dropped
// or replaced transaction — mark it 'failed' rather than leaving it forever.
const DROP_AFTER_MS = 60 * 60 * 1000;
const CONCURRENCY = 5;

interface PendingGift {
  id: string;
  chain: string | null;
  tx_hash: string | null;
  recipient_address: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();

  // Cheap short-circuit when there are no pending gifts at all.
  if (!(await cronHasWork('wire_gifts', { column: 'status', value: 'pending' }))) {
    return cronResponse(CRON_NAME, startedAt, { confirmed: 0, failed: 0, pending: 0, scanned: 0 });
  }

  const result = await withCronErrorReporting(CRON_NAME, startedAt, async () => {
    const sb = getSupabaseAdmin();
    const sinceIso = new Date(startedAt - LOOKBACK_MS).toISOString();

    const { data, error } = await sb
      .from('wire_gifts')
      .select('id, chain, tx_hash, recipient_address, created_at')
      .eq('status', 'pending')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(MAX_PER_RUN);
    if (error) throw new Error(error.message);

    const gifts = (data ?? []) as PendingGift[];
    let confirmed = 0;
    let failed = 0;
    let stillPending = 0;

    for (let i = 0; i < gifts.length; i += CONCURRENCY) {
      const batch = gifts.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.all(
        batch.map(async (g) => {
          if (!g.chain || !g.tx_hash) return { g, next: 'pending' as const };
          const outcome = await verifyGiftOnChain({
            chain: g.chain,
            txHash: g.tx_hash,
            recipientAddress: g.recipient_address ?? '',
          });
          let next: 'confirmed' | 'failed' | 'pending' = outcome;
          // Grace: don't fail a not-yet-observable tx too early. Only escalate a
          // still-'pending' outcome to 'failed' once it's older than the drop
          // window (a genuinely dropped/replaced tx).
          if (outcome === 'pending') {
            const ageMs = startedAt - new Date(g.created_at).getTime();
            next = ageMs > DROP_AFTER_MS ? 'failed' : 'pending';
          }
          return { g, next };
        }),
      );

      for (const { g, next } of outcomes) {
        if (next === 'pending') {
          stillPending += 1;
          continue;
        }
        // Guarded update: only transition rows still 'pending' so we never
        // regress a row the inline path or a concurrent run already resolved.
        const { data: upd, error: updErr } = await sb
          .from('wire_gifts')
          .update({ status: next })
          .eq('id', g.id)
          .eq('status', 'pending')
          .select('id');
        if (updErr || !upd || upd.length === 0) {
          stillPending += 1;
          continue;
        }
        if (next === 'confirmed') confirmed += 1;
        else failed += 1;
      }
    }

    await logCronExecution(CRON_NAME, 'success', Date.now() - startedAt, undefined, gifts.length);
    return cronResponse(CRON_NAME, startedAt, {
      scanned: gifts.length,
      confirmed,
      failed,
      pending: stillPending,
    });
  });

  return result as Response;
}
