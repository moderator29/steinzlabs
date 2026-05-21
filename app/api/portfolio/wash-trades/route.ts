import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-G.3 — Wash-trade detection.
 *
 * Per US §1091, a wash sale occurs when a security is sold at a loss
 * and a substantially identical security is bought within 30 days
 * before or after the sale. The loss is disallowed for tax purposes.
 *
 * This endpoint scans the caller's transactions and flags every
 * sell-at-a-loss with a matching buy (same chain + same token symbol)
 * within the ±30-day window. Returns a list of flagged pairs so the
 * UI can show "wash-sale: $X loss disallowed".
 *
 * GET → { wash_trades: [...], total_disallowed_loss_usd }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STABLE = new Set(['USD', 'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX']);

interface TxRow {
  tx_hash: string;
  chain: string | null;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number | null;
  to_amount: number | null;
  usd_value: number | null;
  timestamp: string;
}

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

export async function GET(_req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: txData } = await admin
    .from('transactions')
    .select('tx_hash, chain, from_token_symbol, to_token_symbol, from_amount, to_amount, usd_value, timestamp')
    .eq('user_id', user.id)
    .eq('status', 'success')
    .order('timestamp', { ascending: true })
    .returns<TxRow[]>();
  const txs = txData ?? [];

  // First pass: FIFO realized PnL per sell tx so we know which sells
  // were losses + how much. Also collect buy-times per (chain, symbol).
  const lots = new Map<string, Array<{ amount: number; cost: number; ts: number; tx: string }>>();
  const buysByToken = new Map<string, number[]>();   // timestamps (ms)

  interface SellEvent { tx_hash: string; chain: string; symbol: string; ts: number; pnl: number; }
  const sellEvents: SellEvent[] = [];

  for (const t of txs) {
    const chainKey = (t.chain ?? 'unknown').toLowerCase();
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;
    const ts = new Date(t.timestamp).getTime();
    const buySym = t.to_token_symbol ? `${chainKey}::${t.to_token_symbol.toUpperCase()}` : null;
    const sellSym = t.from_token_symbol ? `${chainKey}::${t.from_token_symbol.toUpperCase()}` : null;
    if (buySym && !STABLE.has(t.to_token_symbol?.toUpperCase() ?? '') && t.to_amount) {
      const q = lots.get(buySym) ?? [];
      q.push({ amount: Number(t.to_amount), cost: usd, ts, tx: t.tx_hash });
      lots.set(buySym, q);
      const bb = buysByToken.get(buySym) ?? [];
      bb.push(ts);
      buysByToken.set(buySym, bb);
    }
    if (sellSym && !STABLE.has(t.from_token_symbol?.toUpperCase() ?? '') && t.from_amount) {
      let remaining = Number(t.from_amount);
      const q = lots.get(sellSym) ?? [];
      let costBasis = 0;
      while (remaining > 1e-12 && q.length > 0) {
        const head = q[0];
        const take = Math.min(head.amount, remaining);
        const ratio = take / head.amount;
        costBasis += head.cost * ratio;
        head.amount -= take;
        head.cost -= head.cost * ratio;
        remaining -= take;
        if (head.amount <= 1e-12) q.shift();
      }
      lots.set(sellSym, q);
      const pnl = usd - costBasis;
      if (pnl < 0) {
        const [c, s] = sellSym.split('::');
        sellEvents.push({ tx_hash: t.tx_hash, chain: c, symbol: s, ts, pnl });
      }
    }
  }

  // Second pass: for each sell-at-loss, look for any buy of the same
  // (chain, symbol) within ±30 days.
  const THIRTY_DAYS = 30 * 24 * 3600 * 1000;
  const washTrades = [];
  for (const s of sellEvents) {
    const key = `${s.chain}::${s.symbol}`;
    const buys = buysByToken.get(key) ?? [];
    const matching = buys.filter((b) => Math.abs(b - s.ts) <= THIRTY_DAYS);
    if (matching.length === 0) continue;
    washTrades.push({
      sell_tx_hash: s.tx_hash,
      chain: s.chain,
      symbol: s.symbol,
      sold_at: new Date(s.ts).toISOString(),
      disallowed_loss_usd: Number(Math.abs(s.pnl).toFixed(2)),
      matching_buy_count: matching.length,
      window: '±30 days',
    });
  }

  return NextResponse.json({
    wash_trades: washTrades,
    total_disallowed_loss_usd: Number(washTrades.reduce((a, w) => a + w.disallowed_loss_usd, 0).toFixed(2)),
    disclaimer: 'US §1091 informational only — not tax advice.',
  });
}
