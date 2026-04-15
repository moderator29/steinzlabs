import 'server-only';
import { cache, TTL } from '../api/cache-manager';
import {
  getSolanaSOLBalance,
  getSolanaWalletTokens,
  getSolanaTransactions,
  getSolanaTokenMetaBatch,
  getSolanaAssetsByOwner,
  type SolanaTransaction,
} from './alchemy-solana';
import { getMultiTokenPrices, getBirdeyeTokenOverview } from './birdeye';
import { getTokensMulti } from './dexscreener';
import { getTokenPrice } from './coingecko';

// ─── Well-Known Token Logos ────────────────────────────────────────────────────

const KNOWN_LOGOS: Record<string, string> = {
  So11111111111111111111111111111111111111112:
    'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:
    'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:
    'https://assets.coingecko.com/coins/images/325/small/tether.png',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So:
    'https://assets.coingecko.com/coins/images/17172/small/msol.png',
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj':
    'https://assets.coingecko.com/coins/images/17172/small/msol.png',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263:
    'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:
    'https://assets.coingecko.com/coins/images/34286/small/jup.png',
};

const KNOWN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolanaEnrichedToken {
  mintAddress: string;
  symbol: string;
  name: string;
  balance: string;       // display string
  rawAmount: number;     // uiAmount
  decimals: number;
  priceUSD: number | null;
  valueUSD: number | null;
  logoURI: string | null;
  liquidity: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  verified: boolean;     // has DexScreener listing
  chain: 'solana';
}

export interface SolanaWalletTx {
  hash: string;
  type: 'buy' | 'sell' | 'transfer' | 'swap' | 'mint' | 'burn' | 'failed' | 'other';
  timestamp: string;       // ISO
  timestampUnix: number;
  tokenSymbol: string;
  tokenMint: string | null;
  amount: string;          // formatted
  amountRaw: number;
  valueUSD: number | null;
  counterparty: string | null;
  direction: 'in' | 'out' | 'self';
  fee: number;             // SOL
}

export interface SolanaWalletIntelligence {
  address: string;
  chain: 'solana';
  solBalance: number;
  solValueUSD: number | null;
  totalBalanceUSD: number;
  tokens: SolanaEnrichedToken[];
  transactions: SolanaWalletTx[];
  tokenDistribution: Array<{ symbol: string; valueUSD: number; percentage: number }>;
  metadata: {
    totalTokens: number;
    activeTokens: number;
    dustTokensRemoved: boolean;
    txCount: number;
    firstSeen: string | null;
    lastActive: string | null;
    txPerWeek: number;
    totalBuys: number;
    totalSells: number;
  };
  isWhale: boolean;
  whaleScore: 'MEGA' | 'LARGE' | 'MEDIUM' | 'SMALL' | null;
  clusterHints: {
    concentrationScore: number;
    topTokenPercent: number;
    hasBlueChips: boolean;
    memeTokenPercent: number;
  };
  dataSource: 'alchemy+birdeye+dexscreener';
}

// ─── Whale Classification ─────────────────────────────────────────────────────

const BLUE_CHIP_MINTS = new Set([
  'So11111111111111111111111111111111111111112',  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (wormhole)
]);

function classifyWhale(totalUSD: number): SolanaWalletIntelligence['whaleScore'] {
  if (totalUSD >= 1_000_000) return 'MEGA';
  if (totalUSD >= 100_000) return 'LARGE';
  if (totalUSD >= 10_000) return 'MEDIUM';
  if (totalUSD >= 1_000) return 'SMALL';
  return null;
}

// ─── Transaction Normalizer ────────────────────────────────────────────────────

function normalizeTxType(
  raw: string,
  transfers: SolanaTransaction['tokenTransfers'],
  walletAddress: string
): SolanaWalletTx['type'] {
  const t = raw?.toUpperCase() ?? '';
  if (t.includes('SWAP')) return 'swap';
  if (t.includes('BUY') || t === 'DEX_TRADING') return 'buy';
  if (t.includes('SELL')) return 'sell';
  if (t.includes('BURN')) return 'burn';
  if (t.includes('MINT')) return 'mint';
  if (t.includes('TRANSFER')) {
    // determine direction from token transfers
    if (transfers?.some(tr => tr.toUserAccount === walletAddress)) return 'transfer';
    if (transfers?.some(tr => tr.fromUserAccount === walletAddress)) return 'transfer';
  }
  return 'other';
}

export function normalizeSolanaTransactions(
  txns: SolanaTransaction[],
  walletAddress: string
): SolanaWalletTx[] {
  return txns.slice(0, 25).map(tx => {
    const transfers = tx.tokenTransfers ?? [];
    const nativeTransfers = tx.nativeTransfers ?? [];

    // Pick the most significant token transfer
    const primaryTransfer = transfers[0] ?? null;
    const primaryNative = nativeTransfers[0] ?? null;

    const direction: SolanaWalletTx['direction'] =
      primaryTransfer?.toUserAccount === walletAddress ? 'in' :
      primaryTransfer?.fromUserAccount === walletAddress ? 'out' :
      primaryNative?.toUserAccount === walletAddress ? 'in' :
      primaryNative?.fromUserAccount === walletAddress ? 'out' :
      'self';

    const counterparty: string | null =
      direction === 'in'
        ? (primaryTransfer?.fromUserAccount ?? primaryNative?.fromUserAccount ?? null)
        : direction === 'out'
        ? (primaryTransfer?.toUserAccount ?? primaryNative?.toUserAccount ?? null)
        : null;

    const amountRaw = primaryTransfer?.tokenAmount ?? (
      primaryNative ? primaryNative.amount / 1e9 : 0
    );
    const amountDisplay = amountRaw > 10_000
      ? amountRaw.toFixed(0)
      : amountRaw > 1
      ? amountRaw.toFixed(4)
      : amountRaw.toFixed(8);

    return {
      hash: tx.signature,
      type: normalizeTxType(tx.type, transfers, walletAddress),
      timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
      timestampUnix: tx.timestamp ?? 0,
      tokenSymbol: primaryTransfer ? 'SPL' : 'SOL',
      tokenMint: primaryTransfer?.mint ?? null,
      amount: amountDisplay,
      amountRaw,
      valueUSD: null,  // enriched separately if needed
      counterparty: counterparty && counterparty !== walletAddress ? counterparty : null,
      direction,
      fee: (tx.fee ?? 0) / 1e9,
    } satisfies SolanaWalletTx;
  });
}

// ─── Token Enrichment Pipeline ────────────────────────────────────────────────

async function enrichTokensBatch(
  rawTokens: Array<{ mint: string; uiAmount: number; decimals: number }>
): Promise<SolanaEnrichedToken[]> {
  if (rawTokens.length === 0) return [];

  const mints = rawTokens.map(t => t.mint);

  // Step 1: Parallel — Helius metadata + Birdeye multi-price + DexScreener logos
  const [solanaMeta, birdeyePrices, dexPairs] = await Promise.all([
    getSolanaTokenMetaBatch(mints),
    getMultiTokenPrices(mints, 'solana'),
    getTokensMulti(mints),
  ]);

  // Step 2: Build enriched token list
  const enriched: SolanaEnrichedToken[] = [];

  for (const raw of rawTokens) {
    const mint = raw.mint;
    const meta = solanaMeta.get(mint);
    const birdeyePrice = birdeyePrices[mint];
    const dexPair = dexPairs.get(mint.toLowerCase());

    // Name / Symbol resolution: DexScreener > Helius > well-known > fallback
    const symbol =
      dexPair?.baseToken?.symbol ||
      meta?.symbol ||
      KNOWN_SYMBOLS[mint] ||
      mint.slice(0, 6);

    const name =
      dexPair?.baseToken?.name ||
      meta?.name ||
      symbol;

    // Logo: DexScreener pair image > Helius off-chain > well-known > null
    const logoURI =
      dexPair?.info?.imageUrl ||
      meta?.logoUrl ||
      KNOWN_LOGOS[mint] ||
      null;

    // Price: DexScreener primary (free) > Birdeye secondary > null (never $0)
    const dexPrice = dexPair ? parseFloat(dexPair.priceUsd || '0') : 0;
    const birdPrice = birdeyePrice?.value ?? 0;
    const priceUSD: number | null = dexPrice > 0 ? dexPrice : birdPrice > 0 ? birdPrice : null;

    const valueUSD: number | null = priceUSD !== null ? raw.uiAmount * priceUSD : null;

    // Show all tokens regardless of USD value — user expects to see everything
    const liquidity = dexPair?.liquidity?.usd ?? 0;
    const volume24h = dexPair?.volume?.h24 ?? 0;
    const marketCap = dexPair?.fdv ?? 0;
    const priceChange24h = dexPair?.priceChange?.h24 ?? (birdeyePrice?.priceChange24h ?? 0);

    enriched.push({
      mintAddress: mint,
      symbol,
      name,
      balance: raw.uiAmount > 10_000
        ? raw.uiAmount.toFixed(0)
        : raw.uiAmount > 1
        ? raw.uiAmount.toFixed(4)
        : raw.uiAmount.toFixed(8),
      rawAmount: raw.uiAmount,
      decimals: meta?.decimals ?? raw.decimals,
      priceUSD,
      valueUSD,
      logoURI,
      liquidity,
      volume24h,
      marketCap,
      priceChange24h,
      verified: !!dexPair,
      chain: 'solana',
    });
  }

  return enriched.sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0));
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function buildSolanaWalletIntelligence(
  address: string
): Promise<SolanaWalletIntelligence> {
  const cacheKey = `sol-intelligence:${address.toLowerCase()}`;
  const cached = cache.get<SolanaWalletIntelligence>(cacheKey);
  if (cached) return cached;

  // ── STEP 1: Alchemy Solana — authoritative wallet data in parallel ────────
  const [solBalance, rawTokens, rawTxns, solPrice, assetsByOwner] = await Promise.all([
    getSolanaSOLBalance(address),
    getSolanaWalletTokens(address),
    getSolanaTransactions(address, 1000),
    getTokenPrice('solana').catch(() => null as number | null),
    getSolanaAssetsByOwner(address).catch((err) => {
      console.error('[solana-intelligence] DAS getAssetsByOwner failed:', err?.message ?? err);
      return { items: [] };
    }),
  ]);

  // Merge getAssetsByOwner fungible tokens with getTokenAccountsByOwner
  const assetItems = ((assetsByOwner as Record<string, unknown>)?.items as unknown[]) ?? [];
  const existingMints = new Set(rawTokens.map(t => t.mint));
  for (const item of assetItems) {
    const r = item as Record<string, unknown>;
    if (r.interface !== 'FungibleToken' && r.interface !== 'FungibleAsset') continue;
    const id = r.id as string;
    if (!id || existingMints.has(id)) continue;
    const tokenInfo = r.token_info as Record<string, unknown> | undefined;
    const balance = (tokenInfo?.balance as number) ?? 0;
    const decimals = (tokenInfo?.decimals as number) ?? 0;
    const uiAmount = decimals > 0 ? balance / Math.pow(10, decimals) : balance;
    if (uiAmount > 0) {
      rawTokens.push({ mint: id, amount: balance, decimals, uiAmount });
      existingMints.add(id);
    }
  }

  const solValueUSD: number | null = solPrice !== null ? solBalance * solPrice : null;

  // ── STEP 2: Filter zero-balance tokens ────────────────────────────────────
  const nonZeroTokens = rawTokens.filter(
    t => t.uiAmount > 0 && t.mint !== 'So11111111111111111111111111111111111111112'
  );

  // ── STEP 3: Enrich tokens (Helius meta + Birdeye prices + DexScreener logos)
  const enrichedTokens = await enrichTokensBatch(nonZeroTokens);

  // ── STEP 4: Normalize transactions (use signature-level data for display)
  const recentSigs = rawTxns.slice(0, 20);
  const transactions: SolanaWalletTx[] = recentSigs.map(tx => ({
    hash: tx.signature,
    type: tx.type === 'FAILED' ? 'failed' : 'transfer',
    timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
    timestampUnix: tx.timestamp ?? 0,
    tokenSymbol: 'SOL',
    tokenMint: null,
    amount: '',
    amountRaw: 0,
    valueUSD: null,
    counterparty: null,
    direction: 'self' as const,
    fee: (tx.fee ?? 0) / 1e9,
  }));

  // ── STEP 5: Build SOL entry ───────────────────────────────────────────────
  const solEntry: SolanaEnrichedToken = {
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    balance: solBalance.toFixed(4),
    rawAmount: solBalance,
    decimals: 9,
    priceUSD: solPrice ?? null,
    valueUSD: solValueUSD,
    logoURI: KNOWN_LOGOS['So11111111111111111111111111111111111111112'],
    liquidity: 0,
    volume24h: 0,
    marketCap: 0,
    priceChange24h: 0,
    verified: true,
    chain: 'solana',
  };

  // ── STEP 6: Totals and derived stats ─────────────────────────────────────
  const allTokens = [solEntry, ...enrichedTokens];
  const totalBalanceUSD = allTokens.reduce((s, t) => s + (t.valueUSD ?? 0), 0);
  const activeTokens = allTokens.filter(t => (t.valueUSD ?? 0) >= 1).length;

  // Token distribution (top 10 for display)
  const tokenDistribution = allTokens
    .filter(t => (t.valueUSD ?? 0) > 0)
    .slice(0, 10)
    .map(t => ({
      symbol: t.symbol,
      valueUSD: t.valueUSD ?? 0,
      percentage: totalBalanceUSD > 0 ? Math.round(((t.valueUSD ?? 0) / totalBalanceUSD) * 10000) / 100 : 0,
    }));

  // Transaction stats
  const timestamps = rawTxns
    .map(tx => tx.timestamp)
    .filter((t): t is number => typeof t === 'number' && t > 0)
    .sort((a, b) => a - b);

  const firstSeen = timestamps.length > 0
    ? new Date(timestamps[0] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const lastActive = timestamps.length > 0
    ? new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  let txPerWeek = 0;
  if (timestamps.length >= 2) {
    const daysActive = (timestamps[timestamps.length - 1] - timestamps[0]) / 86400;
    txPerWeek = daysActive > 0 ? (rawTxns.length / daysActive) * 7 : rawTxns.length;
  }

  const totalBuys = transactions.filter(tx => tx.type === 'buy' || tx.direction === 'in').length;
  const totalSells = transactions.filter(tx => tx.type === 'sell' || tx.direction === 'out').length;

  // Cluster hints
  const topToken = allTokens[0];
  const topTokenPercent = totalBalanceUSD > 0 && topToken
    ? ((topToken.valueUSD ?? 0) / totalBalanceUSD) * 100
    : 0;
  const blueChipValue = allTokens
    .filter(t => BLUE_CHIP_MINTS.has(t.mintAddress))
    .reduce((s, t) => s + (t.valueUSD ?? 0), 0);
  const memeTokenPercent = totalBalanceUSD > 0
    ? Math.max(0, 100 - (blueChipValue / totalBalanceUSD) * 100)
    : 0;
  const hhi = allTokens.reduce((sum, t) => {
    const share = totalBalanceUSD > 0 ? (t.valueUSD ?? 0) / totalBalanceUSD : 0;
    return sum + share * share;
  }, 0);
  const concentrationScore = Math.round(hhi * 100); // 0-100, higher = more concentrated

  // Whale classification
  const whaleScore = classifyWhale(totalBalanceUSD);

  const intelligence: SolanaWalletIntelligence = {
    address,
    chain: 'solana',
    solBalance,
    solValueUSD,
    totalBalanceUSD,
    tokens: allTokens,
    transactions,
    tokenDistribution,
    metadata: {
      totalTokens: allTokens.length,
      activeTokens,
      dustTokensRemoved: true,
      txCount: rawTxns.length,
      firstSeen,
      lastActive,
      txPerWeek: Math.round(txPerWeek * 10) / 10,
      totalBuys,
      totalSells,
    },
    isWhale: totalBalanceUSD >= 10_000,
    whaleScore,
    clusterHints: {
      concentrationScore,
      topTokenPercent: Math.round(topTokenPercent * 10) / 10,
      hasBlueChips: blueChipValue > totalBalanceUSD * 0.1,
      memeTokenPercent: Math.round(memeTokenPercent),
    },
    dataSource: 'alchemy+birdeye+dexscreener',
  };

  cache.set(cacheKey, intelligence, TTL.WALLET_BALANCE);
  return intelligence;
}
