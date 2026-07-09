import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Crypto Fear and Greed index — real data from alternative.me (free, keyless).
 * Powers the News market-mood banner. Never fabricates: on any failure it
 * returns { available: false } and the UI hides the banner.
 */
let cache: { at: number; body: unknown } | null = null;
const TTL_MS = 5 * 60_000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`fng ${res.status}`);
    const json = await res.json() as { data?: Array<{ value?: string; value_classification?: string; timestamp?: string }> };
    const row = json?.data?.[0];
    const value = row?.value != null ? parseInt(String(row.value), 10) : NaN;
    if (!Number.isFinite(value)) throw new Error('fng no value');
    const body = {
      available: true,
      value,
      label: row?.value_classification ?? '',
      updatedAt: row?.timestamp ? new Date(Number(row.timestamp) * 1000).toISOString() : null,
    };
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (err) {
    logger.warn({ err }, '[fear-greed] fetch failed');
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ available: false });
  }
}
