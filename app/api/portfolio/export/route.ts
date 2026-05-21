import 'server-only';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-G.2 — CSV export per chain.
 *
 * GET /api/portfolio/export?chain=ethereum&kind=transactions
 *   kind = transactions | holdings | pnl_summary  (default: transactions)
 *   chain optional — when omitted, exports all chains.
 *
 * Returns text/csv with a Content-Disposition attachment so the
 * browser triggers a download.
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
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const chain = req.nextUrl.searchParams.get('chain');
  const kind = (req.nextUrl.searchParams.get('kind') ?? 'transactions').toLowerCase();
  const admin = getSupabaseAdmin();

  let csv = '';
  let filename = '';

  if (kind === 'transactions') {
    let q = admin
      .from('transactions')
      .select('tx_hash, timestamp, chain, type, wallet_address, from_token_symbol, from_amount, to_token_symbol, to_amount, usd_value, gas_fee_usd, status')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(20000);
    if (chain) q = q.eq('chain', chain);
    const { data } = await q;
    csv = rowsToCsv(
      ['timestamp', 'chain', 'type', 'tx_hash', 'wallet_address', 'from_token_symbol', 'from_amount', 'to_token_symbol', 'to_amount', 'usd_value', 'gas_fee_usd', 'status'],
      (data ?? []) as Array<Record<string, unknown>>,
    );
    filename = `nakalabs-transactions-${chain ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (kind === 'holdings') {
    let q = admin
      .from('user_holdings')
      .select('chain, symbol, token_address, balance, balance_usd, last_updated')
      .eq('user_id', user.id)
      .order('balance_usd', { ascending: false })
      .limit(5000);
    if (chain) q = q.eq('chain', chain);
    const { data } = await q;
    csv = rowsToCsv(
      ['chain', 'symbol', 'token_address', 'balance', 'balance_usd', 'last_updated'],
      (data ?? []) as Array<Record<string, unknown>>,
    );
    filename = `nakalabs-holdings-${chain ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (kind === 'pnl_summary') {
    // Pull the existing portfolio/performance summary inline so the CSV
    // matches what the user sees in the UI.
    let q = admin
      .from('transactions')
      .select('chain, from_token_symbol, to_token_symbol, from_amount, to_amount, usd_value, timestamp')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .order('timestamp', { ascending: true });
    if (chain) q = q.eq('chain', chain);
    const { data } = await q;
    const txs = (data ?? []) as Array<Record<string, unknown>>;
    // Repeat the FIFO calculator here keyed by (chain::symbol).
    const STABLE = new Set(['USD', 'USDC', 'USDT', 'DAI']);
    const lots = new Map<string, Array<{ amount: number; cost: number }>>();
    const realizedBySym = new Map<string, number>();
    for (const t of txs) {
      const chainKey = (String(t.chain ?? 'unknown')).toLowerCase();
      const usd = Number(t.usd_value ?? 0);
      if (usd <= 0) continue;
      const buy = t.to_token_symbol ? `${chainKey}::${String(t.to_token_symbol).toUpperCase()}` : null;
      const sell = t.from_token_symbol ? `${chainKey}::${String(t.from_token_symbol).toUpperCase()}` : null;
      if (buy && !STABLE.has(String(t.to_token_symbol).toUpperCase()) && t.to_amount) {
        const arr = lots.get(buy) ?? [];
        arr.push({ amount: Number(t.to_amount), cost: usd });
        lots.set(buy, arr);
      }
      if (sell && !STABLE.has(String(t.from_token_symbol).toUpperCase()) && t.from_amount) {
        let remaining = Number(t.from_amount);
        const arr = lots.get(sell) ?? [];
        let cb = 0;
        while (remaining > 1e-12 && arr.length > 0) {
          const head = arr[0];
          const take = Math.min(head.amount, remaining);
          const ratio = take / head.amount;
          cb += head.cost * ratio;
          head.amount -= take;
          head.cost -= head.cost * ratio;
          remaining -= take;
          if (head.amount <= 1e-12) arr.shift();
        }
        lots.set(sell, arr);
        realizedBySym.set(sell, (realizedBySym.get(sell) ?? 0) + (usd - cb));
      }
    }
    const rows = Array.from(realizedBySym.entries()).map(([k, v]) => {
      const [c, s] = k.split('::');
      return { chain: c, symbol: s, realized_pnl_usd: v.toFixed(2) };
    });
    csv = rowsToCsv(['chain', 'symbol', 'realized_pnl_usd'], rows as Array<Record<string, unknown>>);
    filename = `nakalabs-pnl-summary-${chain ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    return new Response(`Unknown kind: ${kind}`, { status: 400 });
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
