import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';
import { buildEvmWalletIntelligence, EVM_CHAIN_CONFIG, KNOWN_TOKEN_LOGOS } from '@/lib/services/evm-intelligence';
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

// Chain config and logos imported from evm-intelligence.ts (single source of truth)

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

// ─── EVM Data Fetcher (uses shared evm-intelligence.ts) ──────────────────────
// Primary: Alchemy (paginated, with DexScreener/CoinGecko prices)
// Fallback: Zerion (multi-chain, pre-priced)

async function getEvmData(address: string, chain: string) {
  const intel = await buildEvmWalletIntelligence(address, chain);
  const cfg = EVM_CHAIN_CONFIG[chain] ?? EVM_CHAIN_CONFIG.ethereum;

  const holdings = intel.tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD !== null ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.contractAddress,
    logoUrl: t.logoUrl,
  }));

  const totalBalanceUsd = intel.totalBalanceUSD !== null ? intel.totalBalanceUSD.toFixed(2) : null;
  const nativeValueUsd = intel.nativeValueUSD !== null ? intel.nativeValueUSD.toFixed(2) : null;

  const recentTransactions = intel.transactions.map(tx => ({
    hash: tx.hash,
    blockTime: tx.blockTime,
    status: tx.status,
    type: tx.type,
    asset: tx.asset,
    value: tx.value,
    from: tx.from,
    to: tx.to,
  }));

  const txCount = intel.txCount;
  const aiAnalysisContext = buildAiAnalysisContext(
    address, intel.chainName, holdings, totalBalanceUsd ?? '0', txCount
  );

  return {
    chain: intel.chainName,
    address,
    nativeBalance: intel.nativeBalance.toFixed(4),
    nativeValueUsd,
    totalBalanceUsd,
    txCount,
    holdings,
    tokenCount: holdings.filter(h => h.contractAddress).length,
    explorerUrl: intel.explorerUrl,
    ...(cfg.nativeSymbol === 'ETH' ? {
      ethBalance: intel.nativeBalance.toFixed(4),
      ethValueUsd: nativeValueUsd,
    } : {}),
    aiAnalysisContext,
    recentTransactions,
    dataSource: intel.dataSource,
  };
}

// ─── Solana Data Fetcher ──────────────────────────────────────────────────────
// Uses the canonical Solana intelligence pipeline:
// Alchemy Solana (authoritative balances + txns) → Birdeye (prices) → DexScreener (logos)

async function getSolData(address: string) {
  const intel = await buildSolanaWalletIntelligence(address);

  // Map to the holdings format expected by the response shape
  const holdings = intel.tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD !== null && t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
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
    solValueUsd: intel.solValueUSD !== null ? intel.solValueUSD.toFixed(2) : null,
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
