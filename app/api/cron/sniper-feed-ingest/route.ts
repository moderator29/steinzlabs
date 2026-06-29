/**
 * #61: real-time new-token firehose ingestion cron.
 *
 * Runs every minute. Polls GeckoTerminal new+trending pools across all chains
 * (Solana + EVM), enriches via DexScreener, detects the launchpad, and upserts
 * normalized rows into sniper_feed_tokens. The sniper feed UI reads from that
 * table, so users get hundreds of real, fresh coins with real logos + sources
 * without ever hitting a provider rate limit from the browser.
 */
import { NextRequest } from 'next/server';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { ingestFeed } from '@/lib/sniper/feedIngest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const url = request.nextUrl;
  const chainParam = url.searchParams.get('chain');
  const pages = parseInt(url.searchParams.get('pages') || '2', 10) || 2;

  try {
    const res = await ingestFeed({
      chains: chainParam ? [chainParam] : undefined,
      pagesPerChain: pages,
    });
    await logCronExecution(
      'sniper-feed-ingest',
      res.errors.length && res.upserted === 0 ? 'failed' : 'success',
      Date.now() - startedAt,
      res.errors.length ? res.errors.join('; ') : undefined,
      res.upserted,
    );
    return cronResponse('sniper-feed-ingest', startedAt, res as unknown as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logCronExecution('sniper-feed-ingest', 'failed', Date.now() - startedAt, message);
    return cronResponse('sniper-feed-ingest', startedAt, { error: message }, 500);
  }
}
