import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-G.1 — Tax-loss harvesting suggestions (US users).
 *
 * Reads the caller's open lots from transactions, computes unrealized
 * loss per (chain, token) at current price, and ranks candidates by
 * harvest opportunity. Surfaces:
 *   - lots showing > 5% unrealized loss (worth harvesting before EOY)
 *   - wash-sale risk flag when the user has bought the same token in
 *     the prior 30 days (US §1091)
 *
 * This is informational only — not tax advice. Returns the data; the
 * user (or their accountant) decides.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STABLE = new Set(['USD', 'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX']);

interface TxRow {
  chain: string | null;
  to_token_symbol: string | null;
  to_token_address: string | null;
  from_token_symbol: string | null;
  to_amount: number | null;
  from_amount: number | null;
  usd_value: number | null;
  timestamp: string;
}

interface PriceRow {
  token_address: string;
  chain: string;
  price_usd: number | null;
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
    .select('chain, to_token_symbol, to_token_address, from_token_symbol, to_amount, from_amount, usd_value, timestamp')
    .eq('user_id', user.id)
    .eq('status', 'success')
    .order('timestamp', { ascending: true })
    .returns<TxRow[]>();
  const txs = txData ?? [];

  // FIFO lots, but keep them open (don't pop empty lots — we want to
  // report open positions).
  const lots = new Map<string, Array<{ amount: number; cost: number; ts: number; tokenAddr?: string }>>();
  for (const t of txs) {
    const chainKey = (t.chain ?? 'unknown').toLowerCase();
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;
    const buySym = t.to_token_symbol ? `${chainKey}::${t.to_token_symbol.toUpperCase()}` : null;
    const sellSym = t.from_token_symbol ? `${chainKey}::${t.from_token_symbol.toUpperCase()}` : null;
    if (buySym && !STABLE.has(t.to_token_symbol?.toUpperCase() ?? '') && t.to_amount) {
      const q = lots.get(buySym) ?? [];
      q.push({ amount: Number(t.to_amount), cost: usd, ts: new Date(t.timestamp).getTime(), tokenAddr: t.to_token_address ?? undefined });
      lots.set(buySym, q);
    }
    if (sellSym && !STABLE.has(t.from_token_symbol?.toUpperCase() ?? '') && t.from_amount) {
      let remaining = Number(t.from_amount);
      const q = lots.get(sellSym) ?? [];
      while (remaining > 1e-12 && q.length > 0) {
        const head = q[0];
        const take = Math.min(head.amount, remaining);
        const ratio = take / head.amount;
        head.cost -= head.cost * ratio;
        head.amount -= take;
        remaining -= take;
        if (head.amount <= 1e-12) q.shift();
      }
      lots.set(sellSym, q);
    }
  }

  // Get current prices for each open lot's token.
  const openByToken = new Map<string, { totalAmount: number; totalCost: number; tokenAddr?: string; chain: string; symbol: string; lastBuyTs: number }>();
  for (const [key, q] of lots) {
    if (q.length === 0) continue;
    const [chain, symbol] = key.split('::');
    const totalAmount = q.reduce((s, l) => s + l.amount, 0);
    const totalCost = q.reduce((s, l) => s + l.cost, 0);
    if (totalAmount <= 0) continue;
    openByToken.set(key, {
      totalAmount,
      totalCost,
      tokenAddr: q[0].tokenAddr,
      chain,
      symbol,
      lastBuyTs: Math.max(...q.map((l) => l.ts)),
    });
  }
  if (openByToken.size === 0) return NextResponse.json({ candidates: [], note: 'No open positions' });

  const tokenAddrs = Array.from(openByToken.values()).map((v) => v.tokenAddr).filter(Boolean) as string[];
  const { data: prices } = await admin
    .from('token_pricing_cache')
    .select('token_address, chain, price_usd')
    .in('token_address', tokenAddrs)
    .returns<PriceRow[]>();
  const priceByKey = new Map<string, number>();
  for (const p of prices ?? []) {
    if (p.price_usd) priceByKey.set(`${p.chain}::${p.token_address}`, p.price_usd);
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;

  const candidates = Array.from(openByToken.entries()).map(([key, v]) => {
    const priceKey = v.tokenAddr ? `${v.chain}::${v.tokenAddr}` : '';
    const curPrice = priceByKey.get(priceKey);
    if (!curPrice) return null;
    const currentValue = curPrice * v.totalAmount;
    const unrealizedPnl = currentValue - v.totalCost;
    const unrealizedPct = v.totalCost > 0 ? (unrealizedPnl / v.totalCost) * 100 : 0;
    if (unrealizedPct >= -5) return null;   // only flag losses >5%
    return {
      chain: v.chain,
      symbol: v.symbol,
      token_address: v.tokenAddr ?? null,
      amount: v.totalAmount,
      cost_usd: Number(v.totalCost.toFixed(2)),
      current_value_usd: Number(currentValue.toFixed(2)),
      unrealized_pnl_usd: Number(unrealizedPnl.toFixed(2)),
      unrealized_pct: Number(unrealizedPct.toFixed(2)),
      wash_sale_risk: v.lastBuyTs > thirtyDaysAgo,
      note: v.lastBuyTs > thirtyDaysAgo
        ? 'Recent buy within 30d — US §1091 wash-sale rules would disallow loss claim if you re-buy within 30d.'
        : null,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  candidates.sort((a, b) => a.unrealized_pnl_usd - b.unrealized_pnl_usd);

  return NextResponse.json({
    candidates,
    total_harvestable_loss_usd: Number(candidates.reduce((s, c) => s + Math.min(0, c.unrealized_pnl_usd), 0).toFixed(2)),
    disclaimer: 'Informational only. Not tax advice. Consult a qualified tax professional.',
  });
}
