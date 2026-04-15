import 'server-only';
import { cache, TTL } from '../api/cache-manager';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from './alchemy';
import { getContractPrice } from './coingecko';
import { getTokensMulti } from './dexscreener';
import { fetchWalletPositions, fetchWalletTransactions } from './zerion';

// ─── Chain Config (single source of truth for all EVM consumers) ─────────────

export const EVM_CHAIN_CONFIG: Record<string, {
  nativeSymbol: string;
  chainName: string;
  explorerUrl: string;
  priceId: string;
}> = {
  ethereum: { nativeSymbol: 'ETH', chainName: 'Ethereum', explorerUrl: 'https://etherscan.io', priceId: 'ethereum' },
  base:     { nativeSymbol: 'ETH', chainName: 'Base',     explorerUrl: 'https://basescan.org', priceId: 'ethereum' },
  polygon:  { nativeSymbol: 'MATIC', chainName: 'Polygon', explorerUrl: 'https://polygonscan.com', priceId: 'matic-network' },
  avalanche:{ nativeSymbol: 'AVAX', chainName: 'Avalanche', explorerUrl: 'https://snowtrace.io', priceId: 'avalanche-2' },
  arbitrum: { nativeSymbol: 'ETH', chainName: 'Arbitrum', explorerUrl: 'https://arbiscan.io', priceId: 'ethereum' },
  bsc:      { nativeSymbol: 'BNB', chainName: 'BNB Chain', explorerUrl: 'https://bscscan.com', priceId: 'binancecoin' },
};

export const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  ETH:  'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL:  'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BTC:  'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/tether.png',
  MATIC:'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  BNB:  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvmEnrichedToken {
  contractAddress: string | null;
  symbol: string;
  name: string;
  balance: string;
  rawAmount: number;
  decimals: number;
  priceUSD: number | null;
  valueUSD: number | null;
  logoUrl: string | null;
}

export interface EvmTransaction {
  hash: string;
  blockTime: string | null;
  status: string;
  type: string;
  asset: string;
  value: string | null;
  from: string;
  to: string;
  valueUsd: number | null;
}

export interface EvmWalletIntelligence {
  address: string;
  chain: string;
  chainName: string;
  nativeSymbol: string;
  nativeBalance: number;
  nativeValueUSD: number | null;
  totalBalanceUSD: number | null;
  tokens: EvmEnrichedToken[];
  transactions: EvmTransaction[];
  txCount: number;
  explorerUrl: string;
  firstSeen: string | null;
  lastActive: string | null;
  dataSource: 'alchemy' | 'zerion';
}

// ─── Price Fetching (DexScreener > CoinGecko > null) ─────────────────────────

async function fetchEvmTokenPrices(
  tokens: Array<{ contractAddress: string; symbol: string }>,
  chain: string
): Promise<Map<string, { priceUSD: number; logoUrl: string | null }>> {
  const result = new Map<string, { priceUSD: number; logoUrl: string | null }>();
  if (tokens.length === 0) return result;

  const addresses = tokens.map(t => t.contractAddress);

  // Step 1: DexScreener batch (primary — free, no key needed)
  try {
    const dexPairs = await getTokensMulti(addresses);
    for (const [addr, pair] of dexPairs) {
      const price = parseFloat(pair.priceUsd || '0');
      if (price > 0) {
        result.set(addr.toLowerCase(), {
          priceUSD: price,
          logoUrl: pair.info?.imageUrl ?? null,
        });
      }
    }
  } catch (err) {
    console.warn('[evm-intelligence] DexScreener batch price fetch failed:', err);
  }

  // Step 2: CoinGecko for tokens missing DexScreener prices (tertiary)
  const missing = tokens.filter(t => !result.has(t.contractAddress.toLowerCase()));
  if (missing.length > 0) {
    const cgResults = await Promise.allSettled(
      missing.map(async t => {
        const price = await getContractPrice(t.contractAddress, chain);
        return { address: t.contractAddress.toLowerCase(), price };
      })
    );
    for (const r of cgResults) {
      if (r.status === 'fulfilled' && r.value.price > 0) {
        const existing = result.get(r.value.address);
        result.set(r.value.address, {
          priceUSD: r.value.price,
          logoUrl: existing?.logoUrl ?? null,
        });
      }
    }
  }

  return result;
}

// ─── Native Token Price (DexScreener WETH > CoinGecko > null) ────────────────

const WRAPPED_NATIVE: Record<string, string> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  base:     '0x4200000000000000000000000000000000000006', // WETH on Base
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
  polygon:  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  bsc:      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
};

async function getNativePrice(chain: string, priceId: string): Promise<number | null> {
  // Try DexScreener via wrapped native token
  const wrappedAddr = WRAPPED_NATIVE[chain];
  if (wrappedAddr) {
    try {
      const pairs = await getTokensMulti([wrappedAddr]);
      const pair = pairs.get(wrappedAddr.toLowerCase());
      if (pair) {
        const price = parseFloat(pair.priceUsd || '0');
        if (price > 0) return price;
      }
    } catch { /* fall through */ }
  }

  // Try CoinGecko
  try {
    const { getTokenPrice } = await import('./coingecko');
    const price = await getTokenPrice(priceId);
    if (price > 0) return price;
  } catch { /* fall through */ }

  return null;
}

// ─── Build from Alchemy (PRIMARY) ────────────────────────────────────────────

async function buildFromAlchemy(
  address: string,
  chain: string,
  cfg: typeof EVM_CHAIN_CONFIG[string]
): Promise<EvmWalletIntelligence> {
  const [nativeBalStr, fromTxs, toTxs, nativePrice] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getAssetTransfers(address, chain, 'from', 100).catch(() => []),
    getAssetTransfers(address, chain, 'to', 100).catch(() => []),
    getNativePrice(chain, cfg.priceId),
  ]);

  const nativeBalance = parseFloat(nativeBalStr);
  const nativeValueUSD: number | null = nativePrice !== null ? nativeBalance * nativePrice : null;

  // Fetch all token balances (paginated)
  let tokenDetails: EvmEnrichedToken[] = [];
  try {
    const rawBalances = await getTokenBalances(address, chain);
    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0');

    // Get metadata for all non-zero tokens
    const metaResults = await Promise.allSettled(
      nonZero.map(async b => {
        const meta = await getTokenMetadata(b.contractAddress, chain);
        const decimals = meta.decimals ?? 18;
        const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
        if (balance <= 0) return null;
        return {
          contractAddress: b.contractAddress,
          symbol: meta.symbol || 'UNKNOWN',
          name: meta.name || 'Unknown Token',
          balance: balance > 1000 ? balance.toFixed(0) : balance.toFixed(4),
          rawAmount: balance,
          decimals,
          priceUSD: null as number | null,
          valueUSD: null as number | null,
          logoUrl: meta.logo || KNOWN_TOKEN_LOGOS[(meta.symbol || '').toUpperCase()] || null,
        };
      })
    );
    for (const r of metaResults) {
      if (r.status === 'fulfilled' && r.value !== null) {
        tokenDetails.push(r.value as EvmEnrichedToken);
      }
    }

    // Fetch prices: DexScreener > CoinGecko > null
    const priceMap = await fetchEvmTokenPrices(
      tokenDetails
        .filter((t): t is EvmEnrichedToken & { contractAddress: string } => t.contractAddress !== null),
      chain
    );
    for (const token of tokenDetails) {
      if (!token.contractAddress) continue;
      const priceData = priceMap.get(token.contractAddress.toLowerCase());
      if (priceData) {
        token.priceUSD = priceData.priceUSD;
        token.valueUSD = token.rawAmount * priceData.priceUSD;
        if (!token.logoUrl && priceData.logoUrl) token.logoUrl = priceData.logoUrl;
      }
    }
  } catch (err) {
    console.warn('[evm-intelligence] Token balance enrichment failed:', err);
  }

  // Deduplicate and sort transactions
  const allTxs = [...fromTxs, ...toTxs];
  const seenHashes = new Set<string>();
  const dedupedTxs = allTxs.filter(t => {
    if (seenHashes.has(t.hash)) return false;
    seenHashes.add(t.hash);
    return true;
  });

  const transactions: EvmTransaction[] = dedupedTxs
    .sort((a, b) => (b.blockNum || '').localeCompare(a.blockNum || ''))
    .slice(0, 30)
    .map(t => ({
      hash: t.hash,
      blockTime: null,
      status: 'success',
      type: 'transfer',
      asset: t.asset || cfg.nativeSymbol,
      value: t.value,
      from: t.from,
      to: t.to,
      valueUsd: null,
    }));

  // Build native token entry
  const nativeEntry: EvmEnrichedToken = {
    contractAddress: null,
    symbol: cfg.nativeSymbol,
    name: cfg.chainName,
    balance: nativeBalance.toFixed(4),
    rawAmount: nativeBalance,
    decimals: 18,
    priceUSD: nativePrice,
    valueUSD: nativeValueUSD,
    logoUrl: KNOWN_TOKEN_LOGOS[cfg.nativeSymbol] || null,
  };

  const allTokens = [nativeEntry, ...tokenDetails];
  const totalBalanceUSD = allTokens.reduce((s, t) => s + (t.valueUSD ?? 0), 0) || null;

  return {
    address,
    chain,
    chainName: cfg.chainName,
    nativeSymbol: cfg.nativeSymbol,
    nativeBalance,
    nativeValueUSD,
    totalBalanceUSD,
    tokens: allTokens,
    transactions,
    txCount: dedupedTxs.length,
    explorerUrl: cfg.explorerUrl,
    firstSeen: null,
    lastActive: null,
    dataSource: 'alchemy',
  };
}

// ─── Build from Zerion (SECONDARY) ──────────────────────────────────────────

async function buildFromZerion(
  address: string,
  cfg: typeof EVM_CHAIN_CONFIG[string]
): Promise<EvmWalletIntelligence> {
  const [zerionPositions, zerionTxns] = await Promise.all([
    fetchWalletPositions(address),
    fetchWalletTransactions(address, 30),
  ]);

  if (zerionPositions.length === 0) {
    throw new Error('Zerion returned no positions');
  }

  const tokens: EvmEnrichedToken[] = zerionPositions.map(p => ({
    contractAddress: p.isNative ? null : p.contractAddress,
    symbol: p.symbol,
    name: p.name,
    balance: p.balance,
    rawAmount: parseFloat(p.balance) || 0,
    decimals: 18,
    priceUSD: p.price > 0 ? p.price : null,
    valueUSD: p.valueUsd > 0 ? p.valueUsd : null,
    logoUrl: p.logo ?? KNOWN_TOKEN_LOGOS[p.symbol.toUpperCase()] ?? null,
  }));

  const totalValue = zerionPositions.reduce((s, p) => s + p.valueUsd, 0);
  const nativePos = zerionPositions.find(p => p.isNative);
  const nativeBalance = nativePos ? parseFloat(nativePos.balance) : 0;
  const nativeValueUSD = nativePos?.valueUsd ?? null;

  const transactions: EvmTransaction[] = zerionTxns.map(tx => ({
    hash: tx.hash,
    blockTime: tx.timestamp,
    status: tx.status,
    type: tx.type,
    asset: tx.transfers[0]?.symbol || cfg.nativeSymbol,
    value: tx.transfers[0]?.amount?.toString() ?? null,
    from: tx.from,
    to: tx.to ?? '',
    valueUsd: tx.valueUsd ?? null,
  }));

  // Extract timestamps for firstSeen/lastActive
  const timestamps = zerionTxns
    .map(tx => new Date(tx.timestamp).getTime() / 1000)
    .filter(t => t > 0)
    .sort((a, b) => a - b);
  const firstSeen = timestamps.length > 0
    ? new Date(timestamps[0] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const lastActive = timestamps.length > 0
    ? new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return {
    address,
    chain: cfg.chainName.toLowerCase(),
    chainName: cfg.chainName,
    nativeSymbol: cfg.nativeSymbol,
    nativeBalance,
    nativeValueUSD: nativeValueUSD !== null && nativeValueUSD > 0 ? nativeValueUSD : null,
    totalBalanceUSD: totalValue > 0 ? totalValue : null,
    tokens,
    transactions,
    txCount: zerionTxns.length,
    explorerUrl: cfg.explorerUrl,
    firstSeen,
    lastActive,
    dataSource: 'zerion',
  };
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function buildEvmWalletIntelligence(
  address: string,
  chain = 'ethereum'
): Promise<EvmWalletIntelligence> {
  const ck = `evm-intelligence:${chain}:${address.toLowerCase()}`;
  const cached = cache.get<EvmWalletIntelligence>(ck);
  if (cached) return cached;

  const cfg = EVM_CHAIN_CONFIG[chain] ?? EVM_CHAIN_CONFIG.ethereum;

  // ── Alchemy PRIMARY ──────────────────────────────────────────────────────
  try {
    const result = await buildFromAlchemy(address, chain, cfg);
    cache.set(ck, result, TTL.WALLET_BALANCE);
    return result;
  } catch (err) {
    console.warn('[evm-intelligence] Alchemy primary failed, falling back to Zerion:', err);
  }

  // ── Zerion SECONDARY ─────────────────────────────────────────────────────
  if (process.env.ZERION_API_KEY) {
    try {
      const result = await buildFromZerion(address, cfg);
      cache.set(ck, result, TTL.WALLET_BALANCE);
      return result;
    } catch (err) {
      console.warn('[evm-intelligence] Zerion fallback also failed:', err);
    }
  }

  throw new Error('Failed to fetch EVM wallet data from both Alchemy and Zerion');
}
