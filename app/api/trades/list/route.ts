import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Unified trade ledger read for the wallet Activity tab.
 *
 * GET /api/trades/list?wallet=<addr>&chain=<chain>&limit=N
 *   Returns app-initiated trades (swap card, market, View Proof, VTX, send)
 *   recorded in user_trade_history, shaped like the on-chain DecodedTx rows so
 *   ActivityTab can merge the two streams (deduped by tx_hash) into one feed.
 */

interface LedgerRow {
  tx_hash: string | null;
  chain: string;
  trade_type: string;
  source: string | null;
  token_in: string | null;
  token_out: string | null;
  amount_in: number | null;
  amount_out: number | null;
  value_usd: number | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  const chain = req.nextUrl.searchParams.get('chain');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50, 200);
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  try {
    const sb = getSupabaseAdmin();
    let q = sb
      .from('user_trade_history')
      .select('tx_hash, chain, trade_type, source, token_in, token_out, amount_in, amount_out, value_usd, created_at')
      .ilike('wallet_address', wallet)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (chain) q = q.eq('chain', chain);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const trades = ((data ?? []) as LedgerRow[]).map((r) => ({
      tx_hash: r.tx_hash ?? '',
      chain: r.chain,
      tx_type: r.trade_type,
      source: r.source,
      token_in: r.token_in,
      token_out: r.token_out,
      amount_in: r.amount_in,
      amount_out: r.amount_out,
      usd_value: r.value_usd,
      timestamp: r.created_at,
    }));
    return NextResponse.json({ trades });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 });
  }
}
