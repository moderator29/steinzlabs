import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Portfolio transaction history CSV export — Koinly-compatible header
 * row so users can paste straight into Koinly / CoinTracker / TokenTax.
 * Pro+ gated because the underlying transactions table is the same
 * scope as the existing /api/portfolio/performance route.
 */

interface TxRow {
  tx_hash: string;
  chain: string | null;
  type: string | null;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number | null;
  to_amount: number | null;
  usd_value: number | null;
  gas_fee_usd: number | null;
  status: string | null;
  timestamp: string;
}

const KOINLY_HEADER = [
  'Date',
  'Sent Amount',
  'Sent Currency',
  'Received Amount',
  'Received Currency',
  'Fee Amount',
  'Fee Currency',
  'Net Worth Amount',
  'Net Worth Currency',
  'Label',
  'Description',
  'TxHash',
].join(',');

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(r: TxRow): string {
  const date = new Date(r.timestamp).toISOString().replace('T', ' ').slice(0, 19);
  const label = r.type === 'buy' ? 'trade' : r.type === 'sell' ? 'trade' : (r.type ?? 'trade');
  return [
    csvEscape(date),
    csvEscape(r.from_amount ?? ''),
    csvEscape(r.from_token_symbol ?? ''),
    csvEscape(r.to_amount ?? ''),
    csvEscape(r.to_token_symbol ?? ''),
    csvEscape(r.gas_fee_usd ?? ''),
    csvEscape(r.gas_fee_usd != null ? 'USD' : ''),
    csvEscape(r.usd_value ?? ''),
    csvEscape(r.usd_value != null ? 'USD' : ''),
    csvEscape(label),
    csvEscape(`naka-labs ${r.chain ?? ''}`.trim()),
    csvEscape(r.tx_hash),
  ].join(',');
}

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

export const GET = withTierGate('pro', async (request: NextRequest) => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'tx_hash, chain, type, from_token_symbol, to_token_symbol, from_amount, to_amount, usd_value, gas_fee_usd, status, timestamp',
    )
    .eq('user_id', user.id)
    .order('timestamp', { ascending: true })
    .limit(50_000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as TxRow[];
  const body = [KOINLY_HEADER, ...rows.map(rowToCsv)].join('\n') + '\n';
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="naka-labs-portfolio-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
