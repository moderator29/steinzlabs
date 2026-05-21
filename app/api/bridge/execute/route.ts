import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/bridge/execute
 *
 * Records a bridge intent into pending_trades (source_reason: 'bridge') after
 * the client has broadcast the LiFi-signed transaction. This is the same
 * non-custodial pattern the relayer uses for swaps: the server NEVER signs;
 * the client broadcasts; we just record what they did so the status cron
 * can poll LiFi and reconcile.
 *
 * Body: { quoteToolName, srcTxHash, fromChain, toChain, fromToken, toToken,
 *         fromAmount, expectedToAmount, fromAddress, toAddress }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

interface Body {
  quoteToolName?: string;
  srcTxHash?: string;
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  expectedToAmount?: string;
  fromAddress?: string;
  toAddress?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const required = ['srcTxHash', 'fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount', 'fromAddress'] as const;
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('pending_trades')
    .insert({
      user_id: user.id,
      source_reason: 'bridge',
      source_order_id: null,
      source_order_table: null,
      chain: body.fromChain,
      wallet_source: body.fromChain === 'solana' ? 'external_solana' : 'external_evm',
      from_token_address: body.fromToken,
      from_token_symbol: null,
      to_token_address: body.toToken,
      to_token_symbol: null,
      amount_in: body.fromAmount,
      slippage_bps: 50,
      expected_amount_out: body.expectedToAmount ?? null,
      route_provider: `lifi:${body.quoteToolName ?? 'unknown'}`,
      route_data: {
        toChain: body.toChain,
        toAddress: body.toAddress ?? body.fromAddress,
        srcTxHash: body.srcTxHash,
      },
      status: 'confirmed',
      confirmed_tx_hash: body.srcTxHash,
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pendingTradeId: data.id });
}
