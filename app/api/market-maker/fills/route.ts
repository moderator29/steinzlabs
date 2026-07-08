import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * #68 Market-Maker — real fill history for one strategy.
 *
 * GET ?strategy_id=… → the caller's actual executed fills (mm_fills), newest
 * first. Every row is a real on-chain swap logged by the engine (side, tokens,
 * USD, realized pnl, tx hash) — nothing synthesized. Uses the RLS-scoped anon
 * client and double-binds user_id, so a caller can only ever read their own
 * fills. Honest empty array when a strategy has not filled yet.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value; }, set() {}, remove() {} } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const strategyId = req.nextUrl.searchParams.get('strategy_id') ?? '';
  if (!UUID_RE.test(strategyId)) {
    return NextResponse.json({ error: 'valid strategy_id required' }, { status: 400 });
  }

  const { data: fills, error } = await sb
    .from('mm_fills')
    .select('id, side, price, amount_usd, amount_tokens, fee_usd, pnl_usd, tx_hash, created_at')
    .eq('user_id', user.id)
    .eq('strategy_id', strategyId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: 'Could not load fills.' }, { status: 500 });

  return NextResponse.json({ fills: fills ?? [] });
}
