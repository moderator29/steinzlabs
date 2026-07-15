import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin } from '@/lib/coins/coinService';
import { verifyCron } from '../_shared';

/**
 * Coin registry freshness scanner. Pulls the stalest rows from coin_registry
 * (oldest refreshed_at first, nulls first) and re-resolves each one against the
 * live DEX data. resolveCoin re-fetches the pair snapshot and upserts it back
 * into coin_registry (stamping refreshed_at), so a successful resolve refreshes
 * the row that discovery, "Most held", and the featured rails read from.
 *
 * Runs in bounded chunks so we never hammer the upstream APIs. A coin that
 * fails to resolve (delisted, rate-limited) is skipped, not fatal, and still
 * gets its refreshed_at bumped so the next scan rotates past it instead of
 * re-picking the same dead rows every tick. Real data only: nothing is
 * fabricated, a failed resolve leaves the last-known snapshot untouched.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCAN_LIMIT = 40;
const CHUNK_SIZE = 5;

interface RegistryRow {
  chain: string;
  token_address: string;
  token_key: string;
  refreshed_at: string | null;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const { data: rows } = await db
    .from('coin_registry')
    .select('chain, token_address, token_key, refreshed_at')
    .order('refreshed_at', { ascending: true, nullsFirst: true })
    .limit(SCAN_LIMIT);

  const list = (rows ?? []) as RegistryRow[];
  const scanned = list.length;
  if (scanned === 0) return NextResponse.json({ ok: true, scanned: 0, refreshed: 0, skipped: 0 });

  let refreshed = 0;
  let skipped = 0;

  // Bounded concurrency: resolve up to CHUNK_SIZE coins at once, awaiting each
  // chunk before starting the next so we stay gentle on the DEX endpoints.
  for (let i = 0; i < list.length; i += CHUNK_SIZE) {
    const chunk = list.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (row) => {
        try {
          const coin = await resolveCoin(row.chain, row.token_address);
          // resolveCoin upserts a fresh snapshot (incl. refreshed_at) on success.
          if (coin) return true;
          // No resolvable coin (delisted / below liquidity bar): bump refreshed_at
          // so the scanner rotates past this row on the next tick.
          await db
            .from('coin_registry')
            .update({ refreshed_at: new Date().toISOString() })
            .eq('chain', row.chain)
            .eq('token_key', row.token_key);
          return false;
        } catch {
          // Rate-limited or upstream error: skip, but still bump refreshed_at
          // so a persistently failing row does not wedge the rotation.
          await db
            .from('coin_registry')
            .update({ refreshed_at: new Date().toISOString() })
            .eq('chain', row.chain)
            .eq('token_key', row.token_key);
          return false;
        }
      }),
    );
    for (const ok of results) {
      if (ok) refreshed++;
      else skipped++;
    }
  }

  return NextResponse.json({ ok: true, scanned, refreshed, skipped });
}
