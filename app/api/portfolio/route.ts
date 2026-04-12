import 'server-only';
import { NextResponse } from 'next/server';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getBestPair } from '@/lib/services/dexscreener';

// ─── Constants ────────────────────────────────────────────────────────────────

const NATIVE_COINGECKO_IDS: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum',
  optimism: 'ethereum', polygon: 'matic-network', avalanche: 'avalanche-2',
  bnb: 'binancecoin', bsc: 'binancecoin',
};

const NATIVE_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH',
  polygon: 'MATIC', avalanche: 'AVAX', bnb: 'BNB', bsc: 'BNB',
};

const NATIVE_FALLBACK_PRICES: Record<string, number> = {
  ethereum: 3500, matic: 0.7, avalanche: 35, bnb: 600,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioToken {
  symbol: string;
  name: string;
  balance: string;
  price: number;
  valueUsd: number;
  change24h: number;
  contractAddress: string;
  logo: string | null;
  isNative: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNativePrice(chain: string): Promise<number> {
  const cgId = NATIVE_COINGECKO_IDS[chain] ?? 'ethereum';
  const fallback = NATIVE_FALLBACK_PRICES[NATIVE_SYMBOLS[chain]?.toLowerCase() ?? 'eth'] ?? 3500;
  return getTokenPrice(cgId).catch(() => fallback);
}

async function getErc20Price(contractAddress: string): Promise<{ price: number; logo: string | null }> {
  try {
    const pair = await getBestPair(contractAddress);
    if (!pair) return { price: 0, logo: null };
    return {
      price: parseFloat(pair.priceUsd || '0'),
      logo: pair.info?.imageUrl ?? null,
    };
  } catch {
    return { price: 0, logo: null };
  }
}

async function getTokenDetails(chain: string): Promise<(contractAddress: string) => Promise<{
  symbol: string; name: string; balance: number; decimals: number;
}>> {
  return async (contractAddress: string) => {
    try {
      const meta = await getTokenMetadata(contractAddress, chain);
      return {
        symbol: meta.symbol || 'UNKNOWN',
        name: meta.name || 'Unknown Token',
        balance: 0,
        decimals: meta.decimals ?? 18,
      };
    } catch {
      return { symbol: 'UNKNOWN', name: 'Unknown Token', balance: 0, decimals: 18 };
    }
  };
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();

  if (!address) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  try {
    const nativeSym = NATIVE_SYMBOLS[chain] ?? 'ETH';
    const [nativeBalStr, nativePriceUsd, rawBalances, fromTxs] = await Promise.all([
      getEthBalance(address, chain).catch(() => '0'),
      getNativePrice(chain),
      getTokenBalances(address, chain).catch(() => []),
      getAssetTransfers(address, chain, 'from', 10).catch(() => []),
    ]);

    const nativeBalance = parseFloat(nativeBalStr);
    const nativeValueUsd = nativeBalance * nativePriceUsd;

    const nonZero = rawBalances
      .filter(b => b.tokenBalance && b.tokenBalance !== '0')
      .slice(0, 25);

    const getDetails = await getTokenDetails(chain);
    const tokenResults = await Promise.allSettled(
      nonZero.map(async b => {
        const meta = await getDetails(b.contractAddress);
        const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, meta.decimals);
        if (balance <= 0) return null;
        const { price, logo } = await getErc20Price(b.contractAddress);
        return {
          symbol: meta.symbol, name: meta.name,
          balance: balance.toFixed(balance > 1000 ? 0 : 6),
          price, valueUsd: balance * price, change24h: 0,
          contractAddress: b.contractAddress, logo, isNative: false,
        } as PortfolioToken;
      })
    );

    const tokens: PortfolioToken[] = tokenResults
      .filter((r): r is PromiseFulfilledResult<PortfolioToken> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    const portfolio: PortfolioToken[] = [
      { symbol: nativeSym, name: nativeSym === 'ETH' ? 'Ethereum' : nativeSym === 'MATIC' ? 'Polygon' : nativeSym,
        balance: nativeBalance.toFixed(6), price: nativePriceUsd, valueUsd: nativeValueUsd,
        change24h: 0, contractAddress: 'native', logo: null, isNative: true },
      ...tokens,
    ].sort((a, b) => b.valueUsd - a.valueUsd);

    const totalValue = portfolio.reduce((s, t) => s + t.valueUsd, 0);

    return NextResponse.json({
      portfolio, totalValue, totalChange: 0,
      tokenCount: portfolio.length, chain,
      txCount: fromTxs.length,
      recentTransactions: fromTxs.slice(0, 10),
      timestamp: new Date().toISOString(),
      priceSource: 'coingecko+dexscreener',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch portfolio';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
