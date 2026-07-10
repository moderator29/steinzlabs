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

/** Quick Play horizon: the always-open one-tap UP/DOWN market lives at 60s. */
const QUICK_PLAY_HORIZON = 60;

/**
 * Ensure every tracked token always has:
 *  - an OPEN `threshold` market at each horizon {60, 300, 900}s (near-the-money
 *    strike from the REAL live price), AND
 *  - one always-open `direction` market — the one-tap "Quick Play" UP/DOWN game:
 *    a 60s, at-the-money market (target = live price, direction = 'above') that
 *    is regenerated each tick as the previous one resolves, so there is always
 *    exactly one live UP/DOWN market per token.
 *
 * Idempotent: it only creates the (kind, token, horizon) combinations that are
 * currently missing, keyed by kind so a direction-60 market is never mistaken
 * for the threshold-60 market (both share horizon 60). Exits fast when the
 * board is already full. YES = UP, NO = DOWN.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  let created = 0;

  try {
    const admin = getSupabaseAdmin();

    // What open markets already exist, keyed by "kind:SYMBOL:horizon" so the
    // threshold and direction boards are tracked independently.
    const { data: openRows, error: openErr } = await admin
      .from('predict_markets')
      .select('symbol, horizon_seconds, kind')
      .eq('status', 'open');
    if (openErr) throw openErr;

    const have = new Set<string>();
    for (const r of (openRows ?? []) as Array<{ symbol: string; horizon_seconds: number; kind: string | null }>) {
      const kind = (r.kind ?? 'threshold').toLowerCase();
      have.add(`${kind}:${r.symbol.toUpperCase()}:${r.horizon_seconds}`);
    }

    // Which threshold combos are missing?
    const missingThreshold: Array<{ symbol: string; horizon: number }> = [];
    for (const symbol of TRACKED_SYMBOLS) {
      for (const horizon of HORIZONS) {
        if (!have.has(`threshold:${symbol}:${horizon}`)) missingThreshold.push({ symbol, horizon });
      }
    }

    // Which Quick Play direction markets are missing? One 60s per token.
    const missingDirection: Array<{ symbol: string }> = [];
    for (const symbol of TRACKED_SYMBOLS) {
      if (!have.has(`direction:${symbol}:${QUICK_PLAY_HORIZON}`)) missingDirection.push({ symbol });
    }

    // Board already full — exit fast, no external price calls.
    if (missingThreshold.length === 0 && missingDirection.length === 0) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, created: 0, full: true });
    }

    // One live price fetch for exactly the symbols we need to open (threshold or
    // direction).
    const neededSymbols = Array.from(
      new Set([...missingThreshold.map((m) => m.symbol), ...missingDirection.map((m) => m.symbol)]),
    );
    const spots = await getSpot(neededSymbols);
    const priceBySymbol = new Map<string, number>();
    for (const s of spots) {
      if (s.price && s.price > 0) priceBySymbol.set(s.symbol, s.price);
    }

    const nowMs = Date.now();
    // Alternate above/below deterministically so the threshold board mixes
    // directions.
    let flip = Math.floor(nowMs / 60000) % 2 === 0;
    const inserts: Record<string, unknown>[] = [];

    // Threshold markets: near-the-money strike scaled by horizon.
    for (const { symbol, horizon } of missingThreshold) {
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
        kind: 'threshold',
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

    // Quick Play direction markets: at-the-money (target = live price,
    // direction = 'above'), 60s. YES = UP, NO = DOWN. Resolver settles
    // resolved > open_price as a YES/UP win.
    for (const { symbol } of missingDirection) {
      const price = priceBySymbol.get(symbol);
      if (!price) continue; // no honest price -> skip; next tick retries

      const opensAt = new Date(nowMs);
      const closesAt = new Date(nowMs + QUICK_PLAY_HORIZON * 1000);

      inserts.push({
        symbol,
        coingecko_id: TRACKED[symbol],
        kind: 'direction',
        direction: 'above',
        target_price: price, // at-the-money: strike = open price
        open_price: price,
        horizon_seconds: QUICK_PLAY_HORIZON,
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
    return NextResponse.json({
      ok: true,
      created,
      missing: missingThreshold.length + missingDirection.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, created);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
