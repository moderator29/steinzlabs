import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBlockNumber } from '@/lib/services/alchemy';

/**
 * FREE MEV fallback (Ethereum) via ZeroMEV — data.zeromev.org, no key.
 *
 * MEV Radar's primary source is Dune (dune_mev_loss_aggregate). Sandwich
 * attribution can't be derived from dex.trades, so if the Dune sandwich
 * spellbook isn't in the plan that table stays empty. This cron fills the free
 * fallback: it walks recent Ethereum blocks through ZeroMEV, records each
 * victim's sandwich/frontrun loss into mev_events, then rebuilds the 30d
 * per-victim aggregate into dune_mev_loss_aggregate (chain='ethereum'). Other
 * chains stay honestly empty — no free cross-chain per-wallet MEV source exists.
 *
 * Defensive by design: ZeroMEV's exact field names are read tolerantly, so a
 * schema drift yields zero rows (safe) rather than wrong data. Validate that
 * mev_events is populating after the first deploy.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'mev-backfill-zeromev';
const ZEROMEV = 'https://data.zeromev.org/v1/mevBlock';
// Blocks scanned per tick and how far behind the head we allow the cursor to be
// before we jump forward (so a cold start doesn't try to backfill weeks).
const BLOCKS_PER_TICK = 100; // ZeroMEV mevBlock caps count per request
const MAX_LAG_BLOCKS = 7200; // ~24h of Ethereum blocks

interface ZeroMevRow {
  block_number?: number;
  tx_index?: number;
  mev_type?: string;
  user_loss_usd?: number | null;
  address_from?: string | null;
  [k: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : 0; }

async function fetchMevBlocks(fromBlock: number, count: number): Promise<ZeroMevRow[]> {
  try {
    const res = await fetch(`${ZEROMEV}?block_number=${fromBlock}&count=${count}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body) ? (body as ZeroMevRow[]) : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let inserted = 0;
  let aggregated = 0;

  try {
    const admin = getSupabaseAdmin();

    const head = await getBlockNumber('ethereum').catch(() => 0);
    if (!head) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, 'no-head-block', 0);
      return NextResponse.json({ ok: true, skipped: 'no-head-block' });
    }

    // Resume from the cursor; clamp so a cold start only backfills ~24h.
    const { data: cursorRow } = await admin.from('mev_scan_cursor').select('last_scanned_block').eq('chain', 'ethereum').maybeSingle<{ last_scanned_block: number }>();
    const cursor = Number(cursorRow?.last_scanned_block ?? 0);
    const fromBlock = Math.max(cursor + 1, head - MAX_LAG_BLOCKS);
    const count = Math.min(BLOCKS_PER_TICK, Math.max(0, head - fromBlock + 1));

    if (count > 0) {
      const rows = await fetchMevBlocks(fromBlock, count);
      const events = rows
        .map((r) => {
          const type = String(r.mev_type ?? '').toLowerCase();
          const loss = num(r.user_loss_usd);
          const victim = (r.address_from ?? '').toString().toLowerCase();
          const block = Number(r.block_number ?? 0);
          const idx = Number(r.tx_index ?? 0);
          const mev = type.includes('sandwich') ? 'sandwich' : type.includes('frontrun') || type.includes('front') ? 'frontrun' : null;
          if (!mev || loss <= 0 || !victim || !block) return null;
          return {
            tx_hash: `${block}-${idx}`, // synthetic key (ZeroMEV mevBlock is block+index keyed)
            block_number: block,
            chain: 'ethereum',
            victim_address: victim,
            mev_type: mev,
            loss_usd: Math.round(loss),
            block_time: new Date().toISOString(), // block time not in payload; use ingest time (30d window is coarse)
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (events.length > 0) {
        const { data, error } = await admin.from('mev_events').upsert(events, { onConflict: 'tx_hash', ignoreDuplicates: true }).select('tx_hash');
        if (!error) inserted = (data ?? []).length;
      }

      const newCursor = fromBlock + count - 1;
      await admin.from('mev_scan_cursor').upsert({ chain: 'ethereum', last_scanned_block: newCursor, updated_at: new Date().toISOString() }, { onConflict: 'chain' });
    }

    // Prune >30d and rebuild the aggregate MEV Radar reads.
    await admin.from('mev_events').delete().lt('block_time', new Date(Date.now() - 31 * 24 * 3600_000).toISOString());
    const { data: aggN } = await admin.rpc('refresh_mev_aggregate_from_events');
    aggregated = Number(aggN ?? 0);

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, head, fromBlock, scanned: count, inserted, aggregated, durationMs: Date.now() - startedAt });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
