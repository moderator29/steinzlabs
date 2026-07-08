import 'server-only';
import { NextResponse } from 'next/server';
import { fetchWalletPositions, fetchWalletPortfolio, fetchWalletTransactions } from '@/lib/services/zerion';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from '@/lib/services/alchemy';
import { getSolanaSOLBalance } from '@/lib/services/alchemy-solana';
import { getWalletTokenList } from '@/lib/services/birdeye';
import { getTokenPrice, getTokenPriceDetailed, getContractPrice } from '@/lib/services/coingecko';
import { getTokensMulti, type DexPair } from '@/lib/services/dexscreener';
import { normalizeAddress, type Chain } from '@/lib/utils/addressNormalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const NATIVE_COINGECKO_IDS: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum',
  optimism: 'ethereum', polygon: 'matic-network', avalanche: 'avalanche-2',
  bnb: 'binancecoin', bsc: 'binancecoin', solana: 'solana',
};

const NATIVE_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH',
  polygon: 'MATIC', avalanche: 'AVAX', bnb: 'BNB', bsc: 'BNB', solana: 'SOL',
};

const NATIVE_NAMES: Record<string, string> = {
  ETH: 'Ethereum', MATIC: 'Polygon', AVAX: 'Avalanche', BNB: 'BNB', SOL: 'Solana',
};

const NATIVE_FALLBACK_PRICES: Record<string, number> = {
  // Last-resort fallbacks, used only when ALL price APIs fail. Keyed by native
  // SYMBOL (lowercased) to match the getNativePrice lookup — the old map mixed
  // chain names ('ethereum','avalanche') with symbols, so AVAX/others missed
  // and fell back to ETH's price. Prefer the live fetch; these are a floor.
  eth: 2500, matic: 0.5, avax: 25, bnb: 500, sol: 150, btc: 60000, ftm: 0.5,
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
  // Honest pricing signal: false when NO real price source (DexScreener /
  // CoinGecko / Birdeye) could value this token. The UI renders "—" for these
  // instead of a fake $0, and they are excluded from totals.
  priced: boolean;
}

// ─── Native price (with 24h change) ─────────────────────────────────────────────

async function getNativePriceDetailed(chain: string): Promise<{ price: number; change24h: number }> {
  const cgId = NATIVE_COINGECKO_IDS[chain] ?? 'ethereum';
  const sym = NATIVE_SYMBOLS[chain]?.toLowerCase() ?? 'eth';
  const fallback = NATIVE_FALLBACK_PRICES[sym] ?? NATIVE_FALLBACK_PRICES['eth'] ?? 0;
  try {
    const detailed = await getTokenPriceDetailed([cgId]);
    const row = detailed[cgId];
    if (row && row.price > 0) return { price: row.price, change24h: row.change24h };
  } catch { /* fall through */ }
  const price = await getTokenPrice(cgId).catch(() => fallback);
  return { price: price || fallback, change24h: 0 };
}

// ─── Solana path ────────────────────────────────────────────────────────────────

async function fetchViaSolana(address: string): Promise<{
  portfolio: PortfolioToken[];
  totalValue: number;
  totalChangePct: number;
}> {
  // Birdeye wallet-token list = real priced SPL holdings (logos + 24h change),
  // with a free Alchemy+Jupiter fallback baked in. Native SOL is priced
  // separately since the token-account list carries SPL mints only.
  const [walletList, solBalance, solPrice] = await Promise.all([
    getWalletTokenList(address, 'solana').catch(() => ({ items: [], totalUsd: 0 })),
    getSolanaSOLBalance(address).catch(() => 0),
    getNativePriceDetailed('solana'),
  ]);

  const tokens: PortfolioToken[] = walletList.items
    .filter((t) => (t.uiAmount ?? 0) > 0)
    .map((t) => {
      const priced = (t.priceUsd ?? 0) > 0;
      return {
        symbol: t.symbol || `${t.address.slice(0, 4)}…${t.address.slice(-3)}`,
        name: t.name || 'SPL Token',
        balance: String(t.uiAmount ?? 0),
        price: t.priceUsd ?? 0,
        valueUsd: priced ? (t.valueUsd ?? t.uiAmount * (t.priceUsd ?? 0)) : 0,
        change24h: t.priceChange24h ?? 0,
        contractAddress: t.address,
        logo: t.logoURI ?? null,
        isNative: false,
        priced,
      };
    });

  const nativeToken: PortfolioToken = {
    symbol: 'SOL',
    name: 'Solana',
    balance: String(solBalance),
    price: solPrice.price,
    valueUsd: solBalance * solPrice.price,
    change24h: solPrice.change24h,
    contractAddress: 'native',
    logo: null,
    isNative: true,
    priced: solPrice.price > 0,
  };

  const portfolio = [nativeToken, ...tokens].sort((a, b) => b.valueUsd - a.valueUsd);
  const totalValue = portfolio.reduce((s, t) => s + t.valueUsd, 0);
  return { portfolio, totalValue, totalChangePct: weightedChangePct(portfolio, totalValue) };
}

// ─── EVM path (Alchemy balances + real DexScreener/CoinGecko pricing) ────────────

async function fetchViaAlchemy(address: string, chain: string): Promise<{
  portfolio: PortfolioToken[];
  totalValue: number;
  totalChangePct: number;
  txCount: number;
  recentTransactions: unknown[];
}> {
  const nativeSym = NATIVE_SYMBOLS[chain] ?? 'ETH';
  const [nativeBalStr, nativePrice, rawBalances, fromTxs] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getNativePriceDetailed(chain),
    getTokenBalances(address, chain).catch(() => []),
    getAssetTransfers(address, chain, 'from', 10).catch(() => []),
  ]);

  const nativeBalance = parseFloat(nativeBalStr);
  const nonZero = rawBalances
    .filter(b => b.tokenBalance && b.tokenBalance !== '0')
    .slice(0, 25);

  // Resolve on-chain metadata (decimals/symbol/name) so balances are correct.
  interface HeldToken { contractAddress: string; symbol: string; name: string; balance: number }
  const metaResults = await Promise.allSettled(
    nonZero.map(async (b): Promise<HeldToken | null> => {
      const meta = await getTokenMetadata(b.contractAddress, chain);
      const decimals = meta.decimals ?? 18;
      const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
      if (balance <= 0) return null;
      return {
        contractAddress: b.contractAddress,
        symbol: meta.symbol || 'UNKNOWN',
        name: meta.name || 'Unknown Token',
        balance,
      };
    })
  );

  const held: HeldToken[] = metaResults
    .filter((r): r is PromiseFulfilledResult<HeldToken | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is HeldToken => v !== null);

  // Batch price the whole set on the correct chain via DexScreener (shared
  // platform resolver — same numbers the market/token pages show). This closes
  // the old bug where every ERC-20 in the Alchemy fallback rendered as $0.
  const addrs = held.map(h => h.contractAddress);
  const dexMap = addrs.length
    ? await getTokensMulti(addrs, chain as Chain).catch(() => new Map<string, DexPair>())
    : new Map<string, DexPair>();

  const tokens: PortfolioToken[] = await Promise.all(held.map(async (h) => {
    const norm = normalizeAddress(h.contractAddress, chain);
    const pair = dexMap.get(norm);
    let price = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;
    const change24h = pair?.priceChange?.h24 ?? 0;
    const logo = pair?.info?.imageUrl ?? null;
    // CoinGecko contract-price fallback for tokens DexScreener has no pair for
    // (majors on a chain DexScreener under-covers). Real price only — never guessed.
    if (price <= 0) {
      const cg = await getContractPrice(h.contractAddress, chain).catch(() => 0);
      if (cg > 0) price = cg;
    }
    const priced = price > 0;
    return {
      symbol: pair?.baseToken?.symbol || h.symbol,
      name: pair?.baseToken?.name || h.name,
      balance: h.balance.toFixed(h.balance > 1000 ? 0 : 6),
      price,
      valueUsd: priced ? h.balance * price : 0,
      change24h,
      contractAddress: h.contractAddress,
      logo,
      isNative: false,
      priced,
    };
  }));

  const portfolio: PortfolioToken[] = [
    {
      symbol: nativeSym,
      name: NATIVE_NAMES[nativeSym] ?? nativeSym,
      balance: nativeBalance.toFixed(6),
      price: nativePrice.price,
      valueUsd: nativeBalance * nativePrice.price,
      change24h: nativePrice.change24h,
      contractAddress: 'native',
      logo: null,
      isNative: true,
      priced: nativePrice.price > 0,
    },
    ...tokens,
  ].sort((a, b) => b.valueUsd - a.valueUsd);

  const totalValue = portfolio.reduce((s, t) => s + t.valueUsd, 0);
  return {
    portfolio,
    totalValue,
    totalChangePct: weightedChangePct(portfolio, totalValue),
    txCount: fromTxs.length,
    recentTransactions: fromTxs.slice(0, 10),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

// Value-weighted 24h change across priced holdings. Unpriced tokens contribute
// nothing (they have no known value), so the aggregate reflects only real data.
function weightedChangePct(portfolio: PortfolioToken[], totalValue: number): number {
  if (totalValue <= 0) return 0;
  const weighted = portfolio.reduce((s, t) => s + t.valueUsd * (t.change24h || 0), 0);
  return weighted / totalValue;
}

// Map a PortfolioToken onto the PortfolioPosition shape the multi-wallet
// aggregator (lib/hooks/usePortfolio) consumes, so both consumers of this
// route (the hook and the dashboard hero) get real, priced positions.
function toPosition(t: PortfolioToken, chain: string, walletAddress: string) {
  return {
    tokenAddress: t.contractAddress,
    symbol: t.symbol,
    name: t.name,
    logo: t.logo ?? undefined,
    chain,
    walletAddress,
    balance: Number(t.balance) || 0,
    decimals: 18,
    priceUsd: t.price,
    valueUsd: t.valueUsd,
    change24hPct: t.change24h || 0,
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

  // ── Solana: Alchemy/Birdeye is authoritative (Zerion is EVM-only) ──────────
  if (chain === 'solana') {
    try {
      const result = await fetchViaSolana(address);
      const positions = result.portfolio.filter(t => t.priced).map(t => toPosition(t, chain, address));
      return NextResponse.json({
        portfolio: result.portfolio,
        positions,
        tokens: result.portfolio,
        totalValue: result.totalValue,
        totalBalanceUsd: result.totalValue,
        totalChange: (result.totalChangePct / 100) * result.totalValue,
        totalChangePct: result.totalChangePct,
        totalChange24hPct: result.totalChangePct,
        tokenCount: result.portfolio.length,
        chain,
        wallets: [{ address }],
        timestamp: new Date().toISOString(),
        priceSource: 'birdeye',
        dataSource: 'alchemy-solana',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Solana portfolio';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ── EVM: try Zerion first (best coverage + realized flows) ─────────────────
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
          priced: p.price > 0,
        }));

        const totalValue = portfolioSummary.totalValue || portfolio.reduce((s, t) => s + t.valueUsd, 0);
        return NextResponse.json({
          portfolio,
          positions: portfolio.filter(t => t.priced).map(t => toPosition(t, chain, address)),
          tokens: portfolio,
          totalValue,
          totalBalanceUsd: totalValue,
          totalChange: portfolioSummary.change24h,
          totalChangePct: portfolioSummary.change24hPct,
          totalChange24hPct: portfolioSummary.change24hPct,
          change7d: portfolioSummary.change7d,
          change7dPct: portfolioSummary.change7dPct,
          tokenCount: portfolio.length,
          chain,
          wallets: [{ address }],
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

  // ── Alchemy fallback (now with real DexScreener/CoinGecko pricing) ─────────
  try {
    const result = await fetchViaAlchemy(address, chain);
    const positions = result.portfolio.filter(t => t.priced).map(t => toPosition(t, chain, address));
    return NextResponse.json({
      portfolio: result.portfolio,
      positions,
      tokens: result.portfolio,
      totalValue: result.totalValue,
      totalBalanceUsd: result.totalValue,
      totalChange: (result.totalChangePct / 100) * result.totalValue,
      totalChangePct: result.totalChangePct,
      totalChange24hPct: result.totalChangePct,
      tokenCount: result.portfolio.length,
      chain,
      wallets: [{ address }],
      txCount: result.txCount,
      recentTransactions: result.recentTransactions,
      timestamp: new Date().toISOString(),
      priceSource: 'dexscreener',
      dataSource: 'alchemy',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch portfolio';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
