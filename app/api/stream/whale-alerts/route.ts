import { NextRequest } from 'next/server';
import { getAddressTransfers } from '@/lib/services/arkham';
import { getWhaleWatchlist } from '@/lib/services/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE Whale Alert Feed
 * GET /api/stream/whale-alerts?userId=<id>&minUsd=100000
 *
 * Streams whale transactions for wallets in the user's watchlist.
 * Polls every 30 seconds, emits only new transactions seen since last poll.
 * minUsd — minimum USD value to emit (default $100,000)
 */

interface WhaleAlert {
  hash: string;
  chain: string;
  timestamp: string;
  from: string;
  fromEntity?: string;
  to: string;
  toEntity?: string;
  valueUsd: number;
  symbol?: string;
  type: 'buy' | 'sell' | 'transfer';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');
  const minUsd = parseFloat(searchParams.get('minUsd') ?? '100000');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;
      const seenHashes = new Set<string>();

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

        // Get user watchlist
        const watchlist = userId ? await getWhaleWatchlist(userId).catch(() => []) : [];

        // Include well-known whale addresses even without watchlist
        const defaultWhales = [
          { address: 'binance-hot-wallet', chain: 'ethereum', label: 'Binance' },
        ];

        const targets = watchlist.length > 0
          ? watchlist.map(w => ({ address: w.address, chain: w.chain, label: w.label }))
          : defaultWhales;

        const alerts: WhaleAlert[] = [];

        await Promise.allSettled(targets.map(async target => {
          const transfers = await getAddressTransfers(target.address, 10, target.chain).catch(() => []);

          for (const tx of transfers) {
            if (seenHashes.has(tx.hash)) continue;

            const valueUsd = parseFloat(tx.valueUSD ?? '0');
            if (valueUsd < minUsd) continue;

            seenHashes.add(tx.hash);

            const direction = tx.from.address.toLowerCase() === target.address.toLowerCase()
              ? 'sell' : 'buy';

            alerts.push({
              hash: tx.hash,
              chain: tx.chain,
              timestamp: tx.timestamp,
              from: tx.from.address,
              fromEntity: tx.from.entity?.name,
              to: tx.to.address,
              toEntity: tx.to.entity?.name,
              valueUsd,
              symbol: tx.token?.symbol,
              type: direction,
            });
          }
        }));

        if (alerts.length > 0) {
          send('whale_alert', { alerts, ts: Date.now() });
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
      }, 30_000);

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
