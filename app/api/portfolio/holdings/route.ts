import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSolanaSOLBalance } from '@/lib/services/alchemy-solana';
import { getWalletTokenList } from '@/lib/services/birdeye';
import { getEthBalance, getTokenBalances, getTokenMetadata } from '@/lib/services/alchemy';
import { getTokensMulti, type DexPair } from '@/lib/services/dexscreener';
import { getTokenPrice, getTokenPriceDetailed, getContractPrice } from '@/lib/services/coingecko';
import { normalizeAddress, type Chain } from '@/lib/utils/addressNormalize';

// Priced holding — balance is always real (on-chain); price/value are REAL USD
// from the shared resolvers (Birdeye/DexScreener/CoinGecko — the same numbers
// the market pages headline) or null when no source can value the token. The UI
// must render "—" for a null value, never a fabricated $0.
interface Holding {
  address: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h: number | null;
  logoUrl: string | null;
  priced: boolean;
}

const NATIVE_CG_ID: Record<string, string> = {
  ethereum: 'ethereum', base: 'ethereum', arbitrum: 'ethereum', optimism: 'ethereum',
  polygon: 'matic-network', avalanche: 'avalanche-2', bsc: 'binancecoin', solana: 'solana',
};

async function nativePrice(chain: string): Promise<{ price: number; change24h: number }> {
  const id = NATIVE_CG_ID[chain] ?? 'ethereum';
  try {
    const d = await getTokenPriceDetailed([id]);
    const row = d[id];
    if (row && row.price > 0) return { price: row.price, change24h: row.change24h };
  } catch { /* fall through */ }
  const p = await getTokenPrice(id).catch(() => 0);
  return { price: p, change24h: 0 };
}

async function getSolanaHoldings(wallet: string): Promise<Holding[]> {
  // Birdeye wallet-token list = real priced SPL holdings with logos + 24h change
  // (free Alchemy+Jupiter fallback baked in). SOL native is priced separately.
  const [walletList, solBalance, solPrice] = await Promise.all([
    getWalletTokenList(wallet, 'solana').catch(() => ({ items: [], totalUsd: 0 })),
    getSolanaSOLBalance(wallet).catch(() => 0),
    nativePrice('solana'),
  ]);

  const result: Holding[] = [
    {
      address: 'native',
      symbol: 'SOL',
      name: 'Solana',
      balance: solBalance,
      decimals: 9,
      priceUsd: solPrice.price > 0 ? solPrice.price : null,
      valueUsd: solPrice.price > 0 ? solBalance * solPrice.price : null,
      change24h: solPrice.change24h,
      logoUrl: null,
      priced: solPrice.price > 0,
    },
  ];

  for (const t of walletList.items) {
    const amount = t.uiAmount ?? 0;
    if (amount <= 0) continue;
    const priced = (t.priceUsd ?? 0) > 0;
    result.push({
      address: t.address,
      symbol: t.symbol || `${t.address.slice(0, 4)}…${t.address.slice(-3)}`,
      name: t.name || 'SPL Token',
      balance: amount,
      decimals: t.decimals ?? 0,
      priceUsd: priced ? t.priceUsd : null,
      valueUsd: priced ? (t.valueUsd ?? amount * (t.priceUsd ?? 0)) : null,
      change24h: t.priceChange24h ?? null,
      logoUrl: t.logoURI ?? null,
      priced,
    });
  }

  return result.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}

async function getEVMHoldings(wallet: string, chain: string): Promise<Holding[]> {
  try {
    const nativeSym = chain === 'polygon' ? 'MATIC' : chain === 'avalanche' ? 'AVAX' : chain === 'bsc' ? 'BNB' : 'ETH';
    const [nativeBalStr, rawBalances, np] = await Promise.all([
      getEthBalance(wallet, chain).catch(() => '0'),
      getTokenBalances(wallet, chain).catch(() => []),
      nativePrice(chain),
    ]);

    const nativeBalance = parseFloat(nativeBalStr);
    const result: Holding[] = [
      {
        address: 'native',
        symbol: nativeSym,
        name: nativeSym,
        balance: nativeBalance,
        decimals: 18,
        priceUsd: np.price > 0 ? np.price : null,
        valueUsd: np.price > 0 ? nativeBalance * np.price : null,
        change24h: np.change24h,
        logoUrl: null,
        priced: np.price > 0,
      },
    ];

    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0').slice(0, 25);
    interface Held { address: string; symbol: string; name: string; balance: number; decimals: number }
    const metaResults = await Promise.allSettled(
      nonZero.map(async (b): Promise<Held | null> => {
        const meta = await getTokenMetadata(b.contractAddress, chain);
        const decimals = meta.decimals ?? 18;
        const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
        if (balance <= 0) return null;
        return { address: b.contractAddress, symbol: meta.symbol || 'UNKNOWN', name: meta.name || 'Unknown', balance, decimals };
      })
    );
    const held: Held[] = metaResults
      .filter((r): r is PromiseFulfilledResult<Held | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is Held => v !== null);

    // Batch price on the correct chain via DexScreener (shared resolver).
    const addrs = held.map(h => h.address);
    const dexMap = addrs.length
      ? await getTokensMulti(addrs, chain as Chain).catch(() => new Map<string, DexPair>())
      : new Map<string, DexPair>();

    const priced = await Promise.all(held.map(async (h): Promise<Holding> => {
      const norm = normalizeAddress(h.address, chain);
      const pair = dexMap.get(norm);
      let price = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;
      const change24h = pair?.priceChange?.h24 ?? null;
      const logoUrl = pair?.info?.imageUrl ?? null;
      if (price <= 0) {
        const cg = await getContractPrice(h.address, chain).catch(() => 0);
        if (cg > 0) price = cg;
      }
      const isPriced = price > 0;
      return {
        address: h.address,
        symbol: pair?.baseToken?.symbol || h.symbol,
        name: pair?.baseToken?.name || h.name,
        balance: h.balance,
        decimals: h.decimals,
        priceUsd: isPriced ? price : null,
        valueUsd: isPriced ? h.balance * price : null,
        change24h,
        logoUrl,
        priced: isPriced,
      };
    }));

    return [...result, ...priced].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const chain = (request.nextUrl.searchParams.get('chain') || 'solana').toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet parameter required' }, { status: 400 });
  }

  try {
    const holdings = chain === 'solana'
      ? await getSolanaHoldings(wallet)
      : await getEVMHoldings(wallet, chain);

    const totalValueUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
    const pricedCount = holdings.filter(h => h.priced).length;

    return NextResponse.json({
      holdings,
      totalValueUsd,
      tokenCount: holdings.length,
      pricedCount,
      // Honest signal: some holdings could not be valued (long-tail / no pool).
      unpricedCount: holdings.length - pricedCount,
      chain,
    }, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get holdings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
