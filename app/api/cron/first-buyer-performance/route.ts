import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5.6 Trading Terminal — first_buyer_performance pipeline.
 *
 * For each token where we've recorded transactions in the last 60 days
 * but >30 days have passed since its first buy, identify the first ~10
 * buyer addresses and compute their realized PnL on that token over the
 * 30 days following their entry. Store the aggregate so the Trading
 * Terminal strip can answer "did the first buyers make money?" — a
 * strong signal for early-mover cohort quality.
 *
 * No Dune query required — runs on our own transactions table.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface TxRow {
  wallet_address: string | null;
  to_token_address: string | null;
  from_token_address: string | null;
  to_amount: number | null;
  from_amount: number | null;
  usd_value: number | null;
  timestamp: string;
  chain: string | null;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const now = Date.now();
  const SIXTY_DAYS = 60 * 24 * 3600 * 1000;
  const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

  // Step 1 — discover candidate tokens: tokens with at least one buy
  // between now-60d and now-30d (i.e. enough time to have 30d returns).
  const minTs = new Date(now - SIXTY_DAYS).toISOString();
  const maxTs = new Date(now - THIRTY_DAYS).toISOString();
  const { data: candidates } = await admin
    .from('transactions')
    .select('to_token_address, chain, timestamp')
    .gte('timestamp', minTs)
    .lte('timestamp', maxTs)
    .eq('status', 'success')
    .not('to_token_address', 'is', null)
    .limit(2000);

  // Group by (chain, token), take earliest timestamp per group.
  const tokens = new Map<string, { token: string; chain: string; earliest: number }>();
  for (const c of (candidates ?? []) as Array<{ to_token_address: string; chain: string; timestamp: string }>) {
    const key = `${c.chain}::${c.to_token_address.toLowerCase()}`;
    const ts = new Date(c.timestamp).getTime();
    const existing = tokens.get(key);
    if (!existing || ts < existing.earliest) {
      tokens.set(key, { token: c.to_token_address, chain: c.chain, earliest: ts });
    }
  }
  if (tokens.size === 0) return cronResponse('first-buyer-performance', startedAt, { tokens: 0 });

  // Step 2 — for each token, find the first ~10 buyer wallets, then
  // compute their PnL using FIFO on transactions within +30d of their
  // first buy.
  let processed = 0;
  const rows: Array<Record<string, unknown>> = [];

  for (const t of tokens.values()) {
    if (processed >= 50) break;                           // cap per tick

    const start = new Date(t.earliest).toISOString();
    const end = new Date(t.earliest + THIRTY_DAYS).toISOString();
    const { data: tx } = await admin
      .from('transactions')
      .select('wallet_address, to_token_address, from_token_address, to_amount, from_amount, usd_value, timestamp, chain')
      .eq('chain', t.chain)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .or(`to_token_address.eq.${t.token},from_token_address.eq.${t.token}`)
      .order('timestamp', { ascending: true })
      .limit(2000)
      .returns<TxRow[]>();

    const txs = tx ?? [];
    if (txs.length === 0) continue;

    // Per-wallet FIFO bookkeeping limited to the first 10 unique buyers.
    const firstBuyers: string[] = [];
    const lots = new Map<string, Array<{ amount: number; cost: number }>>();
    const realized = new Map<string, number>();
    const invested = new Map<string, number>();

    for (const r of txs) {
      if (!r.wallet_address) continue;
      const w = r.wallet_address.toLowerCase();
      const usd = Number(r.usd_value ?? 0);
      if (usd <= 0) continue;
      const isBuy = (r.to_token_address ?? '').toLowerCase() === t.token.toLowerCase() && r.to_amount;
      const isSell = (r.from_token_address ?? '').toLowerCase() === t.token.toLowerCase() && r.from_amount;
      if (!isBuy && !isSell) continue;

      if (isBuy) {
        if (!firstBuyers.includes(w)) {
          if (firstBuyers.length >= 10) continue;
          firstBuyers.push(w);
        }
        const q = lots.get(w) ?? [];
        q.push({ amount: Number(r.to_amount), cost: usd });
        lots.set(w, q);
        invested.set(w, (invested.get(w) ?? 0) + usd);
      }
      if (isSell && firstBuyers.includes(w)) {
        let remaining = Number(r.from_amount);
        const q = lots.get(w) ?? [];
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
        realized.set(w, (realized.get(w) ?? 0) + (usd - costBasis));
      }
    }

    if (firstBuyers.length === 0) continue;

    const pcts: number[] = [];
    const detail: Array<{ wallet: string; invested_usd: number; realized_usd: number; pnl_pct: number }> = [];
    for (const w of firstBuyers) {
      const inv = invested.get(w) ?? 0;
      const real = realized.get(w) ?? 0;
      if (inv <= 0) continue;
      const pct = (real / inv) * 100;
      pcts.push(pct);
      detail.push({
        wallet: w,
        invested_usd: Math.round(inv * 100) / 100,
        realized_usd: Math.round(real * 100) / 100,
        pnl_pct: Math.round(pct * 10) / 10,
      });
    }
    if (pcts.length === 0) continue;
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const sorted = [...pcts].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2];

    rows.push({
      token_address: t.token,
      chain: t.chain,
      avg_pnl_pct_30d: Math.round(avg * 10) / 10,
      median_pnl_pct_30d: Math.round(median * 10) / 10,
      sample_size: pcts.length,
      first_buyers: detail,
      fetched_at: new Date().toISOString(),
    });
    processed++;
  }

  if (rows.length === 0) return cronResponse('first-buyer-performance', startedAt, { rows: 0 });

  const { error } = await admin
    .from('dune_first_buyer_performance')
    .upsert(rows, { onConflict: 'token_address,chain' });
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'first-buyer-performance' } });
    return cronResponse('first-buyer-performance', startedAt, { error: error.message });
  }
  return cronResponse('first-buyer-performance', startedAt, { rows: rows.length });
}
