import 'server-only';
import { NextResponse } from 'next/server';
import { fetchWalletPositions, fetchWalletPortfolio, fetchWalletTransactions } from '@/lib/services/zerion';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';

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
  // These are last-resort fallbacks only used when ALL price APIs fail.
  // They should be periodically updated. Prefer live price fetch.
  ethereum: 2500, matic: 0.5, avalanche: 25, bnb: 500,
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

// ─── Alchemy fallback ──────────────────────────────────────────────────────────

async function getNativePrice(chain: string): Promise<number> {
  const cgId = NATIVE_COINGECKO_IDS[chain] ?? 'ethereum';
  const sym = NATIVE_SYMBOLS[chain]?.toLowerCase() ?? 'eth';
  const fallback = NATIVE_FALLBACK_PRICES[sym] ?? NATIVE_FALLBACK_PRICES['ethereum'] ?? 0;
  return getTokenPrice(cgId).catch(() => fallback);
}

async function fetchViaAlchemy(address: string, chain: string): Promise<{
  portfolio: PortfolioToken[];
  totalValue: number;
  txCount: number;
  recentTransactions: unknown[];
}> {
  const nativeSym = NATIVE_SYMBOLS[chain] ?? 'ETH';
  const [nativeBalStr, nativePriceUsd, rawBalances, fromTxs] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getNativePrice(chain),
    getTokenBalances(address, chain).catch(() => []),
    getAssetTransfers(address, chain, 'from', 10).catch(() => []),
  ]);

  const nativeBalance = parseFloat(nativeBalStr);
  const nonZero = rawBalances
    .filter(b => b.tokenBalance && b.tokenBalance !== '0')
    .slice(0, 25);

  const tokenResults = await Promise.allSettled(
    nonZero.map(async b => {
      try {
        const meta = await getTokenMetadata(b.contractAddress, chain);
        const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, meta.decimals ?? 18);
        if (balance <= 0) return null;
        return {
          symbol: meta.symbol || 'UNKNOWN',
          name: meta.name || 'Unknown Token',
          balance: balance.toFixed(balance > 1000 ? 0 : 6),
          price: 0,
          valueUsd: 0,
          change24h: 0,
          contractAddress: b.contractAddress,
          logo: null,
          isNative: false,
        } as PortfolioToken;
      } catch { return null; }
    })
  );

  const tokens: PortfolioToken[] = tokenResults
    .filter((r): r is PromiseFulfilledResult<PortfolioToken> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  const portfolio: PortfolioToken[] = [
    {
      symbol: nativeSym,
      name: nativeSym === 'ETH' ? 'Ethereum' : nativeSym === 'MATIC' ? 'Polygon' : nativeSym,
      balance: nativeBalance.toFixed(6),
      price: nativePriceUsd,
      valueUsd: nativeBalance * nativePriceUsd,
      change24h: 0,
      contractAddress: 'native',
      logo: null,
      isNative: true,
    },
    ...tokens,
  ].sort((a, b) => b.valueUsd - a.valueUsd);

  return {
    portfolio,
    totalValue: portfolio.reduce((s, t) => s + t.valueUsd, 0),
    txCount: fromTxs.length,
    recentTransactions: fromTxs.slice(0, 10),
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

  // ── Try Zerion first ──────────────────────────────────────────────────────
  if (process.env.ZERION_API_KEY) {
    try {
      const [positions, portfolioSummary, transactions] = await Promise.all([
        fetchWalletPositions(address),
        fetchWalletPortfolio(address),
        fetchWalletTransactions(address, 10),
      ]);

      if (positions.length > 0) {
        const portfolio: PortfolioToken[] = positions.map(p => ({
          symbol: p.symbol,
          name: p.name,
          balance: p.balance,
          price: p.price,
          valueUsd: p.valueUsd,
          change24h: p.change24h,
          contractAddress: p.contractAddress,
          logo: p.logo,
          isNative: p.isNative,
        }));

        return NextResponse.json({
          portfolio,
          totalValue: portfolioSummary.totalValue || portfolio.reduce((s, t) => s + t.valueUsd, 0),
          totalChange: portfolioSummary.change24h,
          totalChangePct: portfolioSummary.change24hPct,
          change7d: portfolioSummary.change7d,
          change7dPct: portfolioSummary.change7dPct,
          tokenCount: portfolio.length,
          chain,
          txCount: transactions.length,
          recentTransactions: transactions,
          timestamp: new Date().toISOString(),
          priceSource: 'zerion',
          dataSource: 'zerion',
        });
      }
    } catch (zerionErr) {
      console.warn('[portfolio] Zerion failed, falling back to Alchemy:', zerionErr);
    }
  }

  // ── Alchemy fallback ──────────────────────────────────────────────────────
  try {
    const result = await fetchViaAlchemy(address, chain);
    return NextResponse.json({
      ...result,
      totalChange: 0,
      tokenCount: result.portfolio.length,
      chain,
      timestamp: new Date().toISOString(),
      priceSource: 'coingecko',
      dataSource: 'alchemy',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch portfolio';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
