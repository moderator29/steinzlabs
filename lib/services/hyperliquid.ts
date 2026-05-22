import 'server-only';

/**
 * Hyperliquid public info API — no auth, free, used for funding-rate
 * snapshots feeding the Context Feed funding_rate_divergence card.
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */

const BASE = 'https://api.hyperliquid.xyz/info';

export interface HyperliquidFundingRow {
  symbol: string;
  funding_rate_hr: number;             // funding rate per hour (8h = ×8)
  mark_price_usd: number;
  open_interest_usd?: number;
}

async function postInfo<T = unknown>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch latest funding rates for the perp universe. Hyperliquid returns
 * funding as an 8-hour rate; we normalize to hourly so the table is
 * comparable across exchanges (Binance also publishes 8h).
 */
export async function getHyperliquidFundingRates(): Promise<HyperliquidFundingRow[]> {
  // metaAndAssetCtxs returns [meta, assetCtxs] in parallel.
  const result = await postInfo<[Record<string, unknown>, Array<Record<string, unknown>>]>({ type: 'metaAndAssetCtxs' });
  if (!result || !Array.isArray(result) || result.length < 2) return [];
  const meta = result[0] as { universe?: Array<{ name?: string }> };
  const ctxs = result[1];
  const out: HyperliquidFundingRow[] = [];
  for (let i = 0; i < (meta.universe?.length ?? 0); i++) {
    const u = meta.universe![i];
    const c = ctxs[i];
    if (!u?.name || !c) continue;
    const funding8h = Number(c.funding ?? 0);
    const mark = Number(c.markPx ?? c.midPx ?? 0);
    if (!mark) continue;
    out.push({
      symbol: u.name,
      funding_rate_hr: funding8h / 8,           // normalize 8h → 1h
      mark_price_usd: mark,
      open_interest_usd: c.openInterest ? Number(c.openInterest) * mark : undefined,
    });
  }
  return out;
}
