import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpot, TRACKED, TRACKED_SYMBOLS } from '@/lib/predict/priceFeed';
import { HORIZONS, HORIZON_BAND } from '@/lib/predict/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NAME = 'predict-generate';

/**
 * Ensure every tracked token always has an OPEN market at each horizon
 * {60, 300, 900}s. Idempotent: it only creates the (token, horizon)
 * combinations that are currently missing, and exits fast when the board is
 * already full. Targets are set near-the-money from the REAL live price.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  let created = 0;

  try {
    const admin = getSupabaseAdmin();

    // What open markets already exist, keyed by "SYMBOL:horizon".
    const { data: openRows, error: openErr } = await admin
      .from('predict_markets')
      .select('symbol, horizon_seconds')
      .eq('status', 'open');
    if (openErr) throw openErr;

    const have = new Set<string>();
    for (const r of (openRows ?? []) as Array<{ symbol: string; horizon_seconds: number }>) {
      have.add(`${r.symbol.toUpperCase()}:${r.horizon_seconds}`);
    }

    // Which combos are missing?
    const missing: Array<{ symbol: string; horizon: number }> = [];
    for (const symbol of TRACKED_SYMBOLS) {
      for (const horizon of HORIZONS) {
        if (!have.has(`${symbol}:${horizon}`)) missing.push({ symbol, horizon });
      }
    }

    // Board already full — exit fast, no external price calls.
    if (missing.length === 0) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, created: 0, full: true });
    }

    // One live price fetch for exactly the symbols we need to open.
    const neededSymbols = Array.from(new Set(missing.map((m) => m.symbol)));
    const spots = await getSpot(neededSymbols);
    const priceBySymbol = new Map<string, number>();
    for (const s of spots) {
      if (s.price && s.price > 0) priceBySymbol.set(s.symbol, s.price);
    }

    const nowMs = Date.now();
    // Alternate above/below deterministically so the board mixes directions.
    let flip = Math.floor(nowMs / 60000) % 2 === 0;
    const inserts: Record<string, unknown>[] = [];

    for (const { symbol, horizon } of missing) {
      const price = priceBySymbol.get(symbol);
      if (!price) continue; // no honest price -> skip; next tick retries

      const band = HORIZON_BAND[horizon] ?? 0.004;
      const direction: 'above' | 'below' = flip ? 'above' : 'below';
      flip = !flip;
      const target =
        direction === 'above' ? price * (1 + band) : price * (1 - band);

      const opensAt = new Date(nowMs);
      const closesAt = new Date(nowMs + horizon * 1000);

      inserts.push({
        symbol,
        coingecko_id: TRACKED[symbol],
        direction,
        target_price: Number(target.toFixed(price >= 1 ? 2 : 8)),
        open_price: price,
        horizon_seconds: horizon,
        opens_at: opensAt.toISOString(),
        closes_at: closesAt.toISOString(),
        status: 'open',
        yes_stake: 0,
        no_stake: 0,
        entries_count: 0,
      });
    }

    if (inserts.length) {
      const { error: insErr } = await admin.from('predict_markets').insert(inserts);
      if (insErr) throw insErr;
      created = inserts.length;
    }

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, created);
    return NextResponse.json({ ok: true, created, missing: missing.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, created);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
