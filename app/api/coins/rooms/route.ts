import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ROOMS = 20;
// Upper bound on rows scanned for the 7d activity roll-up. A discovery strip
// only needs the 20 busiest rooms, so a generous scan is plenty and stays cheap.
const SCAN_LIMIT = 4000;

interface RoomAgg {
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  messageCount: number;
  lastAt: string;
}

/**
 * GET the active coin rooms: coins with at least one message in the last 7 days,
 * most-recent-activity first, capped at 20. Each entry carries the message count
 * for the window and the coin's registry symbol + logo. Empty array when none.
 * Powers the "Live coin rooms" discovery strip. Real data only.
 */
export async function GET(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data } = await sb
    .from('coin_room_messages')
    .select('chain, token_key, token_address, symbol, created_at')
    .is('deleted_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(SCAN_LIMIT);

  const rows = (data as Array<{ chain: string; token_key: string; token_address: string; symbol: string | null; created_at: string }>) ?? [];
  if (rows.length === 0) return NextResponse.json({ rooms: [] });

  // Roll up per room (chain, token_key). Rows arrive newest-first, so the first
  // row seen for a room is its latest activity.
  const agg = new Map<string, RoomAgg>();
  for (const r of rows) {
    const key = `${r.chain}:${r.token_key}`;
    const existing = agg.get(key);
    if (existing) {
      existing.messageCount += 1;
    } else {
      agg.set(key, {
        chain: r.chain,
        token_key: r.token_key,
        token_address: r.token_address,
        symbol: r.symbol,
        messageCount: 1,
        lastAt: r.created_at,
      });
    }
  }

  const active = [...agg.values()]
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, MAX_ROOMS);

  // Batch-join coin_registry for symbol + logo. Match on both chain and
  // token_key since token_key can collide across chains.
  const keys = [...new Set(active.map((a) => a.token_key))];
  const registry = new Map<string, { symbol: string | null; logo_url: string | null }>();
  if (keys.length) {
    const { data: regRows } = await sb
      .from('coin_registry')
      .select('chain, token_key, symbol, logo_url')
      .in('token_key', keys);
    for (const reg of (regRows as Array<{ chain: string; token_key: string; symbol: string | null; logo_url: string | null }>) ?? []) {
      registry.set(`${reg.chain}:${reg.token_key}`, { symbol: reg.symbol, logo_url: reg.logo_url });
    }
  }

  const rooms = active.map((a) => {
    const reg = registry.get(`${a.chain}:${a.token_key}`);
    return {
      chain: a.chain,
      token_address: a.token_address,
      token_key: a.token_key,
      symbol: reg?.symbol ?? a.symbol ?? null,
      logo_url: reg?.logo_url ?? null,
      messageCount: a.messageCount,
      lastAt: a.lastAt,
    };
  });

  return NextResponse.json({ rooms });
}
