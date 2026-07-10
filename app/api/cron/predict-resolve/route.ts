import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSpot, symbolForCoingeckoId } from '@/lib/predict/priceFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NAME = 'predict-resolve';

interface OpenMarket {
  id: string;
  symbol: string;
  coingecko_id: string;
}

/**
 * Resolve every open market whose window has closed. For each we fetch the REAL
 * live price and call the service-role RPC `resolve_predict_market(id, price)`.
 * If a price is genuinely unavailable we resolve with null so the RPC voids the
 * market (stakes refunded) — we never fabricate a settlement price.
 * Short-circuits when nothing is due.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  let resolved = 0;
  let voided = 0;

  try {
    const admin = getSupabaseAdmin();

    const { data: due, error: dueErr } = await admin
      .from('predict_markets')
      .select('id, symbol, coingecko_id')
      .eq('status', 'open')
      .lte('closes_at', new Date().toISOString())
      .limit(100);
    if (dueErr) throw dueErr;

    const markets = (due ?? []) as OpenMarket[];
    if (markets.length === 0) {
      // Nothing to settle — exit without any external price call.
      return NextResponse.json({ ok: true, resolved: 0, voided: 0 });
    }

    // One live price fetch covering every symbol that needs settling.
    const symbols = Array.from(
      new Set(
        markets.map((m) => symbolForCoingeckoId(m.coingecko_id) ?? m.symbol.toUpperCase()),
      ),
    );
    const spots = await getSpot(symbols);
    const priceBySymbol = new Map<string, number>();
    for (const s of spots) {
      if (s.price && s.price > 0) priceBySymbol.set(s.symbol, s.price);
    }

    for (const m of markets) {
      const sym = symbolForCoingeckoId(m.coingecko_id) ?? m.symbol.toUpperCase();
      const price = priceBySymbol.get(sym) ?? null;
      try {
        const { data, error } = await admin.rpc('resolve_predict_market', {
          p_market_id: m.id,
          p_resolved_price: price, // null => RPC voids and refunds
        });
        if (error) throw error;
        if (price === null) voided++;
        else resolved++;
        void data;
      } catch (rpcErr) {
        Sentry.captureException(rpcErr, { tags: { cron: NAME, market: m.id } });
      }
    }

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, resolved + voided);
    return NextResponse.json({ ok: true, resolved, voided, due: markets.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, resolved + voided);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
