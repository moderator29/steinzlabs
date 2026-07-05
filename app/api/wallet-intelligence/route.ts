import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';
import { buildEvmWalletIntelligence, EVM_CHAIN_CONFIG, KNOWN_TOKEN_LOGOS } from '@/lib/services/evm-intelligence';
import { buildWalletRealizedPnl } from '@/lib/walletIntel/walletPnl';
import { lookupEntity } from '@/lib/clusters/entityRegistry';
import { normalizeAddress, isEvmAddress } from '@/lib/utils/addressNormalize';
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
  isOpenSource: boolean | null;
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

// ─── Counterparty Links ─────────────────────────────────────────────────────
// Who this wallet transacts with most, derived purely from the real recent
// transactions already fetched. The counterparty is whichever side of a
// transfer isn't the wallet itself; we tally interaction frequency and tag
// known entities (CEX / DEX / bridge / mixer) from the on-chain registry.

interface TxSide { from?: string; to?: string }

export interface CounterpartyLink {
  address: string;
  count: number;
  inbound: number;
  outbound: number;
  label: string | null;
  category: string | null;
  parent: string | null;
}

function buildCounterparties(txs: TxSide[], wallet: string): CounterpartyLink[] {
  const self = normalizeAddress(wallet);
  const map = new Map<string, { count: number; inbound: number; outbound: number }>();

  for (const tx of txs) {
    const from = tx.from ? normalizeAddress(tx.from) : '';
    const to = tx.to ? normalizeAddress(tx.to) : '';
    let cp = '';
    let inbound = false;
    if (from && from === self && to && to !== self) { cp = to; inbound = false; }
    else if (to && to === self && from && from !== self) { cp = from; inbound = true; }
    else continue; // self-transfer, contract self-call, or missing side
    if (!cp || cp === self) continue;

    const e = map.get(cp) ?? { count: 0, inbound: 0, outbound: 0 };
    e.count++;
    if (inbound) e.inbound++; else e.outbound++;
    map.set(cp, e);
  }

  return Array.from(map.entries())
    .map(([address, c]) => {
      // Registry is EVM-keyed; only look up EVM-shaped counterparties.
      const ent = isEvmAddress(address) ? lookupEntity(address) : null;
      return {
        address,
        count: c.count,
        inbound: c.inbound,
        outbound: c.outbound,
        label: ent?.name ?? null,
        category: ent?.category ?? null,
        parent: ent?.parent ?? null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
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
    firstSeen: intel.firstSeen,
    lastActive: intel.lastActive,
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
      // An explicitly requested chain we don't index must 400, not silently
      // fall back to Ethereum — that fallback rendered Ethereum holdings
      // under an "Optimism"/"Fantom"/"Linea" label, i.e. wrong balances.
      if (chainParam !== 'auto' && !EVM_CHAIN_CONFIG[chainParam]) {
        return NextResponse.json(
          { error: `Chain not indexed yet: ${chainParam}. Supported: ${Object.keys(EVM_CHAIN_CONFIG).join(', ')}, solana.`, code: 'UNSUPPORTED_CHAIN' },
          { status: 400 }
        );
      }
      const chain = chainParam !== 'auto' ? chainParam : 'ethereum';
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
        // Key by lowercased address (EVM is case-insensitive) so the page's
        // lookup matches regardless of checksum casing from the holdings source.
        contractSecurityMap[h.contractAddress.toLowerCase()] = r.status === 'fulfilled' ? toContractSecurity(r.value) : null;
      });
    }

    // Realized PnL from REAL Bitquery DEX trades (trade-time USD → FIFO). Null
    // when Bitquery is off or the wallet has no priced trades in the window.
    const pnlChain = detectedType === 'SOL'
      ? 'solana'
      : (chainParam !== 'auto' && EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum');
    const sinceIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const realizedPnl = await buildWalletRealizedPnl(pnlChain, address, sinceIso);

    // Top counterparties from the real recent transactions already fetched.
    const txs = (walletData.recentTransactions as TxSide[] | undefined) ?? [];
    const counterparties = buildCounterparties(txs, address);

    return NextResponse.json({ ...walletData, contractSecurity: contractSecurityMap, realizedPnl, counterparties }, {
      headers: { 'Cache-Control': 'public, max-age=30' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to analyze wallet';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
