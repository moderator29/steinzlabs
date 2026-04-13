import 'server-only';
import { NextResponse } from 'next/server';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getTokenPairs } from '@/lib/services/dexscreener';
import { getTokenSecurity } from '@/lib/services/goplus';
import { fetchWalletPositions, fetchWalletTransactions } from '@/lib/services/zerion';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';
import type { TokenSecurityResult } from '@/lib/security/goplusService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityFlag {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  explanation: string;
}

export interface ContractSecurity {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  ownershipRenounced: boolean;
  holderCount: number;
  trustScore: number;
  trustLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  flags: SecurityFlag[];
}

// ─── Chain Config ─────────────────────────────────────────────────────────────

const EVM_CHAIN_CONFIG: Record<string, {
  nativeSymbol: string;
  chainName: string;
  explorerUrl: string;
  priceId: string;
  fallbackPrice: number;
}> = {
  ethereum: { nativeSymbol: 'ETH', chainName: 'Ethereum', explorerUrl: 'https://etherscan.io', priceId: 'ethereum', fallbackPrice: 3500 },
  base:     { nativeSymbol: 'ETH', chainName: 'Base',     explorerUrl: 'https://basescan.org', priceId: 'ethereum', fallbackPrice: 3500 },
  polygon:  { nativeSymbol: 'MATIC', chainName: 'Polygon', explorerUrl: 'https://polygonscan.com', priceId: 'matic-network', fallbackPrice: 0.7 },
  avalanche:{ nativeSymbol: 'AVAX', chainName: 'Avalanche', explorerUrl: 'https://snowtrace.io', priceId: 'avalanche-2', fallbackPrice: 35 },
  arbitrum: { nativeSymbol: 'ETH', chainName: 'Arbitrum', explorerUrl: 'https://arbiscan.io', priceId: 'ethereum', fallbackPrice: 3500 },
  bsc:      { nativeSymbol: 'BNB', chainName: 'BNB Chain', explorerUrl: 'https://bscscan.com', priceId: 'binancecoin', fallbackPrice: 600 },
};

const KNOWN_TOKEN_LOGOS: Record<string, string> = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

function buildAiAnalysisContext(
  address: string,
  chain: string,
  holdings: Array<{ symbol: string; balance: string; valueUsd: string | null }>,
  totalBalanceUsd: string,
  txCount: number
): string {
  const tokenList = holdings
    .slice(0, 20)
    .map(h => `${h.symbol}: ${h.balance}${h.valueUsd ? ` ($${h.valueUsd})` : ''}`)
    .join(', ');
  return `Analyze this wallet: ${address} on ${chain}. Holdings (${holdings.length} total): ${tokenList}. Total value: $${totalBalanceUsd}. Transaction count: ${txCount}. Give me: risk assessment, notable patterns, is this wallet suspicious or legitimate, and what actions the wallet owner should take.`;
}

function toContractSecurity(sec: TokenSecurityResult): ContractSecurity {
  const flags: SecurityFlag[] = sec.checks
    .filter(c => c.status === 'fail')
    .map(c => ({ name: c.label, severity: 'high' as const, explanation: c.label }));

  if (sec.isHoneypot) flags.unshift({ name: 'Honeypot', severity: 'critical', explanation: 'This token cannot be sold.' });

  return {
    isHoneypot: sec.isHoneypot,
    buyTax: parseFloat((sec.buyTax * 100).toFixed(2)),
    sellTax: parseFloat((sec.sellTax * 100).toFixed(2)),
    isOpenSource: sec.isOpenSource,
    isProxy: sec.isProxy,
    isMintable: sec.isMintable,
    ownershipRenounced: !sec.canTakeBackOwnership,
    holderCount: sec.holderCount,
    trustScore: sec.trustScore,
    trustLevel: sec.safetyLevel,
    flags,
  };
}

async function resolveLogoFromDex(contractAddress: string): Promise<string | null> {
  try {
    const pairs = await getTokenPairs(contractAddress);
    return pairs[0]?.info?.imageUrl ?? null;
  } catch {
    return null;
  }
}

// ─── EVM Data Fetcher ─────────────────────────────────────────────────────────
// Primary: Zerion (multi-chain, pre-priced, single call)
// Fallback: Alchemy (Ethereum only, no token USD values)

async function getEvmData(address: string, chain: string) {
  const cfg = EVM_CHAIN_CONFIG[chain] ?? EVM_CHAIN_CONFIG.ethereum;

  // ── Try Zerion first ──────────────────────────────────────────────────────
  if (process.env.ZERION_API_KEY) {
    try {
      const [zerionPositions, zerionTxns] = await Promise.all([
        fetchWalletPositions(address),
        fetchWalletTransactions(address, 30),
      ]);

      if (zerionPositions.length > 0) {
        const holdings = zerionPositions.map(p => ({
          symbol: p.symbol,
          name: p.name,
          balance: p.balance,
          valueUsd: p.valueUsd > 0 ? p.valueUsd.toFixed(2) : null,
          contractAddress: p.isNative ? null : p.contractAddress,
          logoUrl: p.logo ?? KNOWN_TOKEN_LOGOS[p.symbol.toUpperCase()] ?? null,
        }));

        const totalValue = zerionPositions.reduce((s, p) => s + p.valueUsd, 0);
        const nativePos = zerionPositions.find(p => p.isNative);
        const nativeBalance = nativePos ? parseFloat(nativePos.balance) : 0;
        const nativeValueUsd = nativePos?.valueUsd ?? 0;

        const recentTransactions = zerionTxns.map(tx => ({
          hash: tx.hash,
          blockTime: tx.timestamp,
          status: tx.status,
          type: tx.type,
          asset: tx.transfers[0]?.symbol || cfg.nativeSymbol,
          value: tx.transfers[0]?.amount?.toString() ?? null,
          from: tx.from,
          to: tx.to,
        }));

        const txCount = zerionTxns.length;
        const aiAnalysisContext = buildAiAnalysisContext(address, cfg.chainName, holdings, totalValue.toFixed(2), txCount);

        return {
          chain: cfg.chainName,
          address,
          nativeBalance: nativeBalance.toFixed(4),
          nativeValueUsd: nativeValueUsd.toFixed(2),
          totalBalanceUsd: totalValue.toFixed(2),
          txCount,
          holdings,
          tokenCount: holdings.filter(h => h.contractAddress).length,
          explorerUrl: cfg.explorerUrl,
          ...(cfg.nativeSymbol === 'ETH' ? {
            ethBalance: nativeBalance.toFixed(4),
            ethValueUsd: nativeValueUsd.toFixed(2),
          } : {}),
          aiAnalysisContext,
          recentTransactions,
          dataSource: 'zerion',
        };
      }
    } catch (err) {
      console.warn('[WalletIntel] Zerion EVM failed, falling back to Alchemy:', err);
    }
  }

  // ── Alchemy fallback ──────────────────────────────────────────────────────
  const [nativeBalStr, fromTxs, toTxs, nativePrice] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getAssetTransfers(address, chain, 'from', 100).catch(() => []),
    getAssetTransfers(address, chain, 'to', 100).catch(() => []),
    getTokenPrice(cfg.priceId).catch(() => cfg.fallbackPrice),
  ]);

  const nativeBalance = parseFloat(nativeBalStr);
  const nativeValueUsd = nativeBalance * nativePrice;

  let tokenDetails: Array<{
    symbol: string; name: string; balance: number;
    valueUsd: string | null; contractAddress: string; logoUrl: string | null;
  }> = [];

  try {
    const rawBalances = await getTokenBalances(address, chain);
    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0');

    const metaResults = await Promise.allSettled(
      nonZero.map(async b => {
        try {
          const meta = await getTokenMetadata(b.contractAddress, chain);
          const decimals = meta.decimals ?? 18;
          const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
          if (balance <= 0) return null;
          return {
            symbol: meta.symbol || 'UNKNOWN',
            name: meta.name || 'Unknown Token',
            balance,
            valueUsd: null as string | null,
            contractAddress: b.contractAddress,
            logoUrl: meta.logo || KNOWN_TOKEN_LOGOS[(meta.symbol || '').toUpperCase()] || null,
          };
        } catch { return null; }
      })
    );
    tokenDetails = metaResults
      .filter((r): r is PromiseFulfilledResult<NonNullable<typeof tokenDetails[number]>> =>
        r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  } catch {}

  await Promise.allSettled(
    tokenDetails
      .filter(t => !t.logoUrl)
      .map(async t => {
        const logo = await resolveLogoFromDex(t.contractAddress);
        if (logo) t.logoUrl = logo;
      })
  );

  const allTxs = [...fromTxs, ...toTxs];
  const seenHashes = new Set<string>();
  const dedupedTxs = allTxs.filter(t => {
    if (seenHashes.has(t.hash)) return false;
    seenHashes.add(t.hash);
    return true;
  });

  const recentTransactions = dedupedTxs
    .sort((a, b) => (b.blockNum || '').localeCompare(a.blockNum || ''))
    .slice(0, 30)
    .map(t => ({
      hash: t.hash, blockTime: null as string | null,
      status: 'success', type: 'transfer',
      asset: t.asset || cfg.nativeSymbol,
      value: t.value, from: t.from, to: t.to,
    }));

  const holdings = [
    {
      symbol: cfg.nativeSymbol, name: cfg.chainName,
      balance: nativeBalance.toFixed(4), valueUsd: nativeValueUsd.toFixed(2),
      contractAddress: null, logoUrl: KNOWN_TOKEN_LOGOS[cfg.nativeSymbol] || null,
    },
    ...tokenDetails.map(t => ({
      symbol: t.symbol, name: t.name,
      balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
      valueUsd: t.valueUsd, contractAddress: t.contractAddress, logoUrl: t.logoUrl,
    })),
  ];

  const txCount = dedupedTxs.length;
  const aiAnalysisContext = buildAiAnalysisContext(address, cfg.chainName, holdings, nativeValueUsd.toFixed(2), txCount);

  return {
    chain: cfg.chainName, address,
    nativeBalance: nativeBalance.toFixed(4),
    nativeValueUsd: nativeValueUsd.toFixed(2),
    totalBalanceUsd: nativeValueUsd.toFixed(2),
    txCount, holdings,
    tokenCount: tokenDetails.length,
    explorerUrl: cfg.explorerUrl,
    ...(cfg.nativeSymbol === 'ETH' ? {
      ethBalance: nativeBalance.toFixed(4),
      ethValueUsd: nativeValueUsd.toFixed(2),
    } : {}),
    aiAnalysisContext, recentTransactions,
    dataSource: 'alchemy',
  };
}

// ─── Solana Data Fetcher ──────────────────────────────────────────────────────
// Uses the canonical Solana intelligence pipeline:
// Helius (authoritative balances + txns) → Birdeye (prices) → DexScreener (logos)

async function getSolData(address: string) {
  const intel = await buildSolanaWalletIntelligence(address);

  // Map to the holdings format expected by the response shape
  const holdings = intel.tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.mintAddress === 'So11111111111111111111111111111111111111112'
      ? null
      : t.mintAddress,
    logoUrl: t.logoURI ?? KNOWN_TOKEN_LOGOS[t.symbol] ?? null,
  }));

  const recentTransactions = intel.transactions.map(tx => ({
    hash: tx.hash,
    blockTime: tx.timestamp,
    status: tx.type === 'burn' ? 'burn' : 'success',
    type: tx.type,
    asset: tx.tokenSymbol || 'SOL',
    value: tx.amountRaw > 0 ? String(tx.amountRaw) : null,
    from: tx.direction === 'out' ? address : (tx.counterparty ?? address),
    to: tx.direction === 'in' ? address : (tx.counterparty ?? ''),
    valueUsd: tx.valueUSD ?? null,
  }));

  const totalBalanceUsd = intel.totalBalanceUSD;
  const aiAnalysisContext = buildAiAnalysisContext(
    address, 'Solana', holdings, totalBalanceUsd.toFixed(2), intel.metadata.txCount
  );

  return {
    chain: 'Solana',
    address,
    solBalance: intel.solBalance.toFixed(4),
    solValueUsd: intel.solValueUSD.toFixed(2),
    totalBalanceUsd: totalBalanceUsd.toFixed(2),
    txCount: intel.metadata.txCount,
    firstSeen: intel.metadata.firstSeen,
    lastActive: intel.metadata.lastActive,
    holdings,
    tokenCount: holdings.filter(h => h.contractAddress).length,
    explorerUrl: 'https://solscan.io',
    aiAnalysisContext,
    recentTransactions,
    isWhale: intel.isWhale,
    whaleScore: intel.whaleScore,
    tokenDistribution: intel.tokenDistribution,
    dataSource: intel.dataSource,
  };
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainParam = searchParams.get('chain') || 'auto';

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const detectedType = detectChain(address);
    if (detectedType === 'UNKNOWN') {
      return NextResponse.json(
        { error: 'Invalid wallet address. Supports EVM (0x...) and SOL (base58) addresses.' },
        { status: 400 }
      );
    }

    let walletData: Record<string, unknown>;

    if (detectedType === 'SOL') {
      walletData = await getSolData(address);
    } else {
      const chain = chainParam !== 'auto' && EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum';
      walletData = await getEvmData(address, chain);
    }

    // GoPlus security scan for top token holdings (non-blocking)
    const contractSecurityMap: Record<string, ContractSecurity | null> = {};
    if (detectedType === 'EVM') {
      const holdings = (walletData.holdings as Array<{ contractAddress: string | null }>) ?? [];
      const evmTokens = holdings
        .filter(h => h.contractAddress && h.contractAddress !== 'null')
        .slice(0, 5) as Array<{ contractAddress: string }>;

      const chain = chainParam !== 'auto' && EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum';
      const secResults = await Promise.allSettled(
        evmTokens.map(h => getTokenSecurity(h.contractAddress, chain))
      );
      evmTokens.forEach((h, i) => {
        const r = secResults[i];
        contractSecurityMap[h.contractAddress] = r.status === 'fulfilled' ? toContractSecurity(r.value) : null;
      });
    }

    return NextResponse.json({ ...walletData, contractSecurity: contractSecurityMap }, {
      headers: { 'Cache-Control': 'public, max-age=30' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to analyze wallet';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
