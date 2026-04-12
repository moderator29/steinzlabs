import { NextRequest } from 'next/server';
import { getUserWallets } from '@/lib/services/supabase';
import { getTokenBalances, getEthBalance } from '@/lib/services/alchemy';
import { getSolanaWalletTokens, getSolanaSOLBalance } from '@/lib/services/helius';
import { getTokenPrices } from '@/lib/services/jupiter';
import { getContractPrice } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE Portfolio Update Feed
 * GET /api/stream/portfolio-updates?userId=<id>
 *
 * Streams portfolio balance + value updates for all wallets linked to a user.
 * Aggregates across EVM chains and Solana.
 * Updates every 60 seconds (aligned with WALLET_BALANCE TTL).
 */

interface PortfolioToken {
  mint: string;           // contract or mint address
  symbol?: string;
  name?: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  chain: string;
}

interface PortfolioSnapshot {
  walletAddress: string;
  chain: string;
  tokens: PortfolioToken[];
  nativeBalance: number;
  nativeValueUsd: number;
  totalValueUsd: number;
  updatedAt: number;
}

const NATIVE_MINTS: Record<string, string> = {
  solana: 'So11111111111111111111111111111111111111112',
  ethereum: 'ethereum',
  base: 'ethereum',
  arbitrum: 'ethereum',
  optimism: 'ethereum',
  polygon: 'matic-network',
};

async function buildSolanaPortfolio(address: string): Promise<PortfolioSnapshot> {
  const [tokens, solBalance] = await Promise.all([
    getSolanaWalletTokens(address).catch(() => []),
    getSolanaSOLBalance(address).catch(() => 0),
  ]);

  const mints = tokens.map(t => t.mint);
  const prices = mints.length > 0 ? await getTokenPrices(mints).catch(() => ({})) : {};
  const solPrice = await getTokenPrices([NATIVE_MINTS.solana]).then(p => p[NATIVE_MINTS.solana] ?? 0).catch(() => 0);

  const tokenItems: PortfolioToken[] = tokens.map(t => ({
    mint: t.mint,
    symbol: t.symbol,
    name: t.name,
    balance: t.uiAmount,
    decimals: t.decimals,
    priceUsd: prices[t.mint] ?? 0,
    valueUsd: t.uiAmount * (prices[t.mint] ?? 0),
    chain: 'solana',
  }));

  const nativeValueUsd = solBalance * solPrice;
  const totalValueUsd = nativeValueUsd + tokenItems.reduce((sum, t) => sum + t.valueUsd, 0);

  return {
    walletAddress: address,
    chain: 'solana',
    tokens: tokenItems,
    nativeBalance: solBalance,
    nativeValueUsd,
    totalValueUsd,
    updatedAt: Date.now(),
  };
}

async function buildEvmPortfolio(address: string, chain: string): Promise<PortfolioSnapshot> {
  const [tokenBalances, ethBalance] = await Promise.all([
    getTokenBalances(address, chain).catch(() => []),
    getEthBalance(address, chain).catch(() => '0'),
  ]);

  const nativeBalance = parseFloat(ethBalance);
  const nativeCoinId = NATIVE_MINTS[chain] ?? 'ethereum';

  // Get prices for all EVM tokens via CoinGecko contract price
  const tokenItems: PortfolioToken[] = await Promise.all(
    tokenBalances
      .filter(b => b.tokenBalance && b.tokenBalance !== '0')
      .map(async b => {
        const decimals = b.decimals ?? 18;
        const rawBalance = BigInt(b.tokenBalance ?? '0');
        const balance = Number(rawBalance) / Math.pow(10, decimals);
        const priceUsd = await getContractPrice(b.contractAddress, chain).catch(() => 0);
        return {
          mint: b.contractAddress,
          symbol: b.symbol,
          name: b.name,
          balance,
          decimals,
          priceUsd,
          valueUsd: balance * priceUsd,
          chain,
        };
      })
  );

  const nativePriceUsd = await getContractPrice('0x', nativeCoinId).catch(() => 0);
  const nativeValueUsd = nativeBalance * nativePriceUsd;
  const totalValueUsd = nativeValueUsd + tokenItems.reduce((sum, t) => sum + t.valueUsd, 0);

  return {
    walletAddress: address,
    chain,
    tokens: tokenItems,
    nativeBalance,
    nativeValueUsd,
    totalValueUsd,
    updatedAt: Date.now(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('userId is required', { status: 400 });
  }

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

        try {
          const wallets = await getUserWallets(userId);
          if (wallets.length === 0) {
            send('portfolio', { snapshots: [], totalValueUsd: 0, ts: Date.now() });
            return;
          }

          const snapshots: PortfolioSnapshot[] = [];

          await Promise.allSettled(wallets.map(async w => {
            try {
              const snapshot = w.chain === 'solana'
                ? await buildSolanaPortfolio(w.address)
                : await buildEvmPortfolio(w.address, w.chain);
              snapshots.push(snapshot);
            } catch {
              // Non-blocking: skip failed wallet
            }
          }));

          const totalValueUsd = snapshots.reduce((sum, s) => sum + s.totalValueUsd, 0);
          send('portfolio', { snapshots, totalValueUsd, ts: Date.now() });
        } catch {
          // Non-blocking
        }
      };

      // Initial snapshot
      await tick();

      // Update every 60 seconds
      const interval = setInterval(async () => {
        if (!active) {
          clearInterval(interval);
          return;
        }
        await tick();
      }, 60_000);

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
