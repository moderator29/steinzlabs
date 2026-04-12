import 'server-only';
import { NextRequest } from 'next/server';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getDexPrice } from '@/lib/services/dexscreener';
import { getTokenPrice as getJupiterPrice } from '@/lib/services/jupiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE Price Feed
 * GET /api/stream/price-feed?symbols=bitcoin,ethereum&contracts=0x...&solana=mint1,mint2
 *
 * Streams price updates every 10 seconds.
 * symbols   — CoinGecko coin IDs (comma-separated)
 * contracts — EVM contract addresses (comma-separated), requires &chain=ethereum
 * solana    — Solana mint addresses (comma-separated)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) ?? [];
  const contracts = searchParams.get('contracts')?.split(',').filter(Boolean) ?? [];
  const solanaMints = searchParams.get('solana')?.split(',').filter(Boolean) ?? [];
  const chain = searchParams.get('chain') ?? 'ethereum';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;

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

        const prices: Record<string, number> = {};

        await Promise.allSettled([
          // CoinGecko prices
          ...symbols.map(async id => {
            prices[id] = await getTokenPrice(id).catch(() => 0);
          }),
          // EVM contract prices via Dexscreener
          ...contracts.map(async addr => {
            prices[addr] = await getDexPrice(addr).catch(() => 0);
          }),
          // Solana prices via Jupiter
          ...solanaMints.map(async mint => {
            prices[mint] = await getJupiterPrice(mint).catch(() => 0);
          }),
        ]);

        send('prices', { prices, ts: Date.now() });
      };

      // Send initial prices immediately
      await tick();

      // Then update every 10 seconds
      const interval = setInterval(async () => {
        if (!active) {
          clearInterval(interval);
          return;
        }
        await tick();
      }, 10_000);

      // Heartbeat every 25s to keep connection alive
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

      // Cleanup on cancel
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
