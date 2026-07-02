import 'server-only';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAddressTransfers } from '@/lib/services/arkham';
import { getWhaleWatchlist } from '@/lib/services/supabase';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE Whale Alert Feed
 * GET /api/stream/whale-alerts?minUsd=100000
 *
 * Streams whale transactions for wallets in the CALLER's own watchlist. The
 * user is resolved from the authenticated session (supabase.auth.getUser) —
 * never from a query param — so one user can't stream another's watchlist
 * (was an IDOR). When the caller follows no whales the stream stays honestly
 * empty; it never falls back to a fabricated placeholder wallet.
 * minUsd · minimum USD value to emit (default $100,000)
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
  const minUsd = parseFloat(req.nextUrl.searchParams.get('minUsd') ?? '100000');

  // Bind the stream to the authenticated caller. No userId query param — the
  // watchlist we stream is always the session user's own.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* read-only in a streaming handler */ },
      },
    },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = user.id;

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

        // The caller's own watched whales. If they follow none, we stream
        // nothing — never a fabricated placeholder wallet.
        const watchlist = await getWhaleWatchlist(userId).catch(() => []);
        const targets = watchlist.map(w => ({ address: w.address, chain: w.chain, label: w.label }));

        const alerts: WhaleAlert[] = [];

        await Promise.allSettled(targets.map(async target => {
          const transfers = await getAddressTransfers(target.address, 10, target.chain).catch(() => []);

          for (const tx of transfers) {
            if (seenHashes.has(tx.hash)) continue;

            const valueUsd = parseFloat(tx.valueUSD ?? '0');
            if (valueUsd < minUsd) continue;

            seenHashes.add(tx.hash);

            // Solana is case-sensitive — compare via normalizeAddress, never
            // a raw .toLowerCase() (which would corrupt base58 comparisons).
            const direction =
              normalizeAddress(tx.from.address, target.chain) === normalizeAddress(target.address, target.chain)
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
          send('whale-alert', { alerts, ts: Date.now() });
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
