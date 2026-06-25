import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getHyperliquidFundingRates } from '@/lib/services/hyperliquid';

/**
 * Hourly snapshot of perp funding rates from Hyperliquid (public, no
 * auth needed) joined against CoinGecko spot prices to compute the
 * spot-vs-mark divergence that the Context Feed funding_rate_divergence
 * card consumes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COINGECKO_SLUG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', APT: 'aptos',
  DOGE: 'dogecoin', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
  JUP: 'jupiter-exchange-solana', LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave',
};

async function getSpotPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols.map((s) => COINGECKO_SLUG[s]).filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as Record<string, { usd: number }>;
    const out: Record<string, number> = {};
    for (const sym of symbols) {
      const slug = COINGECKO_SLUG[sym];
      if (slug && json[slug]?.usd) out[sym] = json[slug].usd;
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  let rows;
  try {
    rows = await getHyperliquidFundingRates();
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'funding-rates-snapshot' } });
    await logCronExecution('funding-rates-snapshot', 'failed', Date.now() - startedAt, e instanceof Error ? e.message : 'fetch_failed');
    return cronResponse('funding-rates-snapshot', startedAt, { skipped: 'fetch_failed' });
  }
  if (rows.length === 0) {
    await logCronExecution('funding-rates-snapshot', 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse('funding-rates-snapshot', startedAt, { rows: 0 });
  }

  // Pull spot prices for the symbols we know about so divergence_pct
  // is actually meaningful (vs mark only).
  const spot = await getSpotPrices(rows.map((r) => r.symbol));

  const admin = getSupabaseAdmin();
  const inserts = rows.map((r) => {
    const spotPx = spot[r.symbol];
    const divergence = spotPx && spotPx > 0 ? ((r.mark_price_usd - spotPx) / spotPx) * 100 : null;
    return {
      exchange: 'hyperliquid',
      symbol: r.symbol,
      funding_rate_hr: r.funding_rate_hr,
      mark_price_usd: r.mark_price_usd,
      spot_price_usd: spotPx ?? null,
      divergence_pct: divergence,
      fetched_at: new Date().toISOString(),
    };
  });

  const { error } = await admin
    .from('funding_rate_snapshots')
    .upsert(inserts, { onConflict: 'exchange,symbol' });
  if (error) {
    await logCronExecution('funding-rates-snapshot', 'failed', Date.now() - startedAt, error.message, 0);
    return cronResponse('funding-rates-snapshot', startedAt, { error: error.message });
  }
  await logCronExecution('funding-rates-snapshot', 'success', Date.now() - startedAt, undefined, inserts.length);
  return cronResponse('funding-rates-snapshot', startedAt, { rows: inserts.length });
}
