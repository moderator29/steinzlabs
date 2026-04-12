import 'server-only';
import { NextRequest } from 'next/server';
import { getNewPairs } from '@/lib/services/dexscreener';
import { isHighRisk } from '@/lib/services/goplus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE Sniper Event Feed
 * GET /api/stream/sniper-events?chain=solana&minLiquidity=5000&maxAge=3600
 *
 * Streams newly detected token launches filtered by safety criteria.
 * chain       — target chain (default: all)
 * minLiquidity — minimum liquidity in USD (default: $5,000)
 * maxAge      — max pair age in seconds (default: 3600 = 1 hour)
 * safeOnly    — if 'true', runs GoPlus check and filters risky tokens (EVM only)
 *
 * Emits 'new_token' events for newly seen pairs every 15 seconds.
 */

export interface SniperEvent {
  pairAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: string;
  dexId: string;
  priceUsd: string;
  liquidity: number;
  fdv?: number;
  pairCreatedAt: number;
  ageSeconds: number;
  volume5m?: number;
  txns5m?: { buys: number; sells: number };
  riskChecked: boolean;
  riskScore?: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chain = searchParams.get('chain') ?? undefined;
  const minLiquidity = parseFloat(searchParams.get('minLiquidity') ?? '5000');
  const maxAgeSeconds = parseInt(searchParams.get('maxAge') ?? '3600');
  const safeOnly = searchParams.get('safeOnly') === 'true';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;
      const seenPairs = new Set<string>();

      const send = (event: string, data: unknown) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          active = false;
        }
      };

      const tick = async () => {
        if (!active) return;

        try {
          const pairs = await getNewPairs(minLiquidity, chain);
          const now = Date.now();
          const events: SniperEvent[] = [];

          for (const pair of pairs) {
            if (seenPairs.has(pair.pairAddress)) continue;

            const ageMs = now - (pair.pairCreatedAt ?? 0);
            const ageSeconds = Math.floor(ageMs / 1000);
            if (ageSeconds > maxAgeSeconds) continue;

            seenPairs.add(pair.pairAddress);

            const event: SniperEvent = {
              pairAddress: pair.pairAddress,
              tokenAddress: pair.baseToken.address,
              tokenSymbol: pair.baseToken.symbol,
              tokenName: pair.baseToken.name,
              chainId: pair.chainId,
              dexId: pair.dexId,
              priceUsd: pair.priceUsd,
              liquidity: pair.liquidity?.usd ?? 0,
              fdv: pair.fdv,
              pairCreatedAt: pair.pairCreatedAt ?? 0,
              ageSeconds,
              volume5m: pair.volume?.m5,
              txns5m: pair.txns?.m5,
              riskChecked: false,
            };

            // Optional GoPlus security check (EVM chains only)
            if (safeOnly && pair.chainId !== 'solana') {
              try {
                const highRisk = await isHighRisk(pair.baseToken.address, pair.chainId, 70);
                if (highRisk) continue; // Skip risky tokens when safeOnly
                event.riskChecked = true;
              } catch {
                // Non-blocking: emit without risk score
              }
            }

            events.push(event);
          }

          if (events.length > 0) {
            send('new_token', { events, ts: Date.now() });
          }
        } catch {
          // Non-blocking — poll failure shouldn't kill the stream
        }
      };

      // Initial poll
      await tick();

      const interval = setInterval(async () => {
        if (!active) {
          clearInterval(interval);
          return;
        }
        await tick();
      }, 15_000);

      // Heartbeat every 25s
      const heartbeat = setInterval(() => {
        if (!active) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          active = false;
        }
      }, 25_000);

      return () => {
        active = false;
        clearInterval(interval);
        clearInterval(heartbeat);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
