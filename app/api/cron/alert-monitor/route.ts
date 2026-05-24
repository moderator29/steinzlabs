/**
 * Alert monitor — evaluates user price alerts against the live price cache.
 *
 * Source: price_alerts (one row per user-set target).
 *   - direction = 'above' | 'below'
 *   - price     = numeric target
 *   - token_id  = canonical coingecko id (the price-cache-refresh cron keys by this)
 *
 * The cron walks every alert with triggered=false, looks up the live price in
 * Redis (price:cg:<id> or price:sym:<symbol>), evaluates the direction
 * predicate, and on fire it (a) sets triggered=true/triggered_at, (b) inserts
 * one row into notifications so the in-app bell + provider light up.
 *
 * Real-API rule: when the price cache is cold for a token, the row is
 * skipped. Never fire on a fabricated price. The cache stays warm via the
 * price-cache-refresh cron (top 100 tokens, 5-min TTL, refreshed every 30 min).
 *
 * Cadence: every 5 minutes in vercel.json so the user sees an alert within
 * minutes of the target being hit. The cache itself is the latency floor.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheGet } from '@/lib/cache/redis';
import { evaluateExpression } from '@/lib/alerts/evaluateComposite';
import { fanOutNotification } from '@/lib/notifications/channels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'alert-monitor';

interface PriceAlertRow {
  id: string;
  user_id: string;
  token_id: string | null;
  token_symbol: string | null;
  direction: 'above' | 'below' | string;
  price: number;
}

interface CachedPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
  fetchedAt: number;
}

async function priceFor(tokenId: string | null, symbol: string | null): Promise<number | null> {
  if (tokenId) {
    const v = await cacheGet<CachedPrice>(`price:cg:${tokenId}`);
    if (v && typeof v.price === 'number') return v.price;
  }
  if (symbol) {
    const v = await cacheGet<CachedPrice>(`price:sym:${symbol.toLowerCase()}`);
    if (v && typeof v.price === 'number') return v.price;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  const { data: rows, error: fetchErr } = await admin
    .from('price_alerts')
    .select('id,user_id,token_id,token_symbol,direction,price')
    .eq('triggered', false)
    .limit(1000);

  if (fetchErr) {
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, fetchErr.message, 0);
    return cronResponse(NAME, startedAt, { error: fetchErr.message });
  }

  const alerts = (rows ?? []) as PriceAlertRow[];
  if (alerts.length === 0) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse(NAME, startedAt, { scanned: 0, fired: 0, skipped_no_price: 0 });
  }

  let fired = 0;
  let skippedNoPrice = 0;
  const nowIso = new Date().toISOString();

  for (const a of alerts) {
    const live = await priceFor(a.token_id, a.token_symbol);
    if (live == null) {
      skippedNoPrice++;
      continue;
    }
    const hits =
      a.direction === 'above'
        ? live >= Number(a.price)
        : a.direction === 'below'
          ? live <= Number(a.price)
          : false;
    if (!hits) continue;

    // Atomic-ish flip — re-check triggered=false on the WHERE so a parallel
    // tick can't double-fire. supabase-js doesn't surface affected-row count
    // here, but the conditional update means at most one row transitions.
    const { error: updErr } = await admin
      .from('price_alerts')
      .update({ triggered: true, triggered_at: nowIso })
      .eq('id', a.id)
      .eq('triggered', false);
    if (updErr) continue;

    const symbol = (a.token_symbol ?? a.token_id ?? 'token').toUpperCase();
    const dirArrow = a.direction === 'above' ? '↑' : '↓';
    await admin.from('notifications').insert({
      user_id: a.user_id,
      title: `${symbol} ${dirArrow} ${a.price}`,
      body: `${symbol} is now $${live.toLocaleString(undefined, { maximumFractionDigits: 6 })} — target $${a.price} ${a.direction === 'above' ? 'breached' : 'reached'}.`,
      type: 'price',
      read: false,
      url: a.token_id ? `/dashboard/intelligence/${a.token_id}` : '/dashboard/alerts',
    });
    fired++;
  }

  // ALERT2: composite alert evaluation. Pulls active rows whose cooldown
  // has elapsed, evaluates the JSON expression tree against live price
  // cache, fires via fanOutNotification, and stamps last_triggered_at on
  // success. Cold-data evaluations (null) skip without stamping so the
  // alert re-attempts on the next tick.
  let compositeFired = 0;
  let compositeColdSkipped = 0;
  const { data: composites } = await admin
    .from('composite_alerts')
    .select('id, user_id, name, expression, cooldown_seconds, last_triggered_at')
    .eq('active', true)
    .limit(500);
  for (const c of (composites ?? []) as Array<{
    id: string; user_id: string; name: string;
    expression: unknown; cooldown_seconds: number; last_triggered_at: string | null;
  }>) {
    if (c.last_triggered_at) {
      const ageMs = Date.now() - new Date(c.last_triggered_at).getTime();
      if (ageMs < c.cooldown_seconds * 1000) continue;
    }
    let result: boolean | null;
    try {
      result = await evaluateExpression(c.expression);
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, composite_id: c.id } });
      continue;
    }
    if (result === null) { compositeColdSkipped++; continue; }
    if (result !== true) continue;

    const { error: stampErr } = await admin
      .from('composite_alerts')
      .update({ last_triggered_at: nowIso })
      .eq('id', c.id)
      // Guard against a concurrent tick firing the same alert twice.
      .or(`last_triggered_at.is.null,last_triggered_at.lt.${new Date(Date.now() - c.cooldown_seconds * 1000).toISOString()}`);
    if (stampErr) continue;

    try {
      await fanOutNotification({
        user_id: c.user_id,
        title: c.name,
        message: 'Composite alert condition met.',
        type: 'composite_alert',
        metadata: { composite_alert_id: c.id },
      });
      compositeFired++;
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, composite_id: c.id } });
    }
  }

  try {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, fired + compositeFired);
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
  }
  return cronResponse(NAME, startedAt, {
    scanned: alerts.length,
    fired,
    skipped_no_price: skippedNoPrice,
    composite_scanned: composites?.length ?? 0,
    composite_fired: compositeFired,
    composite_cold_skipped: compositeColdSkipped,
  });
}
