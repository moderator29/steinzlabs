import 'server-only';
import { NextResponse } from 'next/server';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getTokenPairs } from '@/lib/services/dexscreener';
import { getTokenSecurity } from '@/lib/services/goplus';
import {
  getSolanaSOLBalance,
  getSolanaWalletTokens,
  getSolanaTransactions,
} from '@/lib/services/helius';
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
    .slice(0, 15)
    .map(h => `${h.symbol}: ${h.balance}${h.valueUsd ? ` ($${h.valueUsd})` : ''}`)
    .join(', ');
  return `Analyze this wallet: ${address} on ${chain}. Holdings: ${tokenList}. Total value: $${totalBalanceUsd}. Transaction count: ${txCount}. Give me: risk assessment, notable patterns, is this wallet suspicious or legitimate, and what actions the wallet owner should take.`;
}

/** Convert TokenSecurityResult from service layer to ContractSecurity UI shape. */
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

/** Resolve DexScreener image for a token address (non-blocking). */
async function resolveLogoFromDex(contractAddress: string): Promise<string | null> {
  try {
    const pairs = await getTokenPairs(contractAddress);
    return pairs[0]?.info?.imageUrl ?? null;
  } catch {
    return null;
  }
}

// ─── EVM Data Fetcher ─────────────────────────────────────────────────────────

async function getEvmData(address: string, chain: string) {
  const cfg = EVM_CHAIN_CONFIG[chain] ?? EVM_CHAIN_CONFIG.ethereum;

  // Parallel: native balance + transfers + native price
  const [nativeBalStr, fromTxs, toTxs, nativePrice] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getAssetTransfers(address, chain, 'from', 20).catch(() => []),
    getAssetTransfers(address, chain, 'to', 20).catch(() => []),
    getTokenPrice(cfg.priceId).catch(() => cfg.fallbackPrice),
  ]);

  const nativeBalance = parseFloat(nativeBalStr);
  const nativeValueUsd = nativeBalance * nativePrice;

  // ERC-20 token balances + metadata
  let tokenDetails: Array<{
    symbol: string; name: string; balance: number;
    valueUsd: string | null; contractAddress: string; logoUrl: string | null;
  }> = [];

  try {
    const rawBalances = await getTokenBalances(address, chain);
    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0').slice(0, 30);

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

  // Resolve missing logos from DexScreener
  await Promise.allSettled(
    tokenDetails
      .filter(t => !t.logoUrl)
      .map(async t => {
        const logo = await resolveLogoFromDex(t.contractAddress);
        if (logo) t.logoUrl = logo;
      })
  );

  // Merge + dedupe recent transactions
  const allTxs = [...fromTxs, ...toTxs];
  const seenHashes = new Set<string>();
  const recentTransactions = allTxs
    .filter(t => { if (seenHashes.has(t.hash)) return false; seenHashes.add(t.hash); return true; })
    .sort((a, b) => (b.blockNum || '').localeCompare(a.blockNum || ''))
    .slice(0, 30)
    .map(t => ({
      hash: t.hash,
      blockTime: null as string | null,
      status: 'success',
      type: 'transfer',
      asset: t.asset || cfg.nativeSymbol,
      value: t.value,
      from: t.from,
      to: t.to,
    }));

  const holdings = [
    {
      symbol: cfg.nativeSymbol,
      name: cfg.chainName,
      balance: nativeBalance.toFixed(4),
      valueUsd: nativeValueUsd.toFixed(2),
      contractAddress: null,
      logoUrl: KNOWN_TOKEN_LOGOS[cfg.nativeSymbol] || null,
    },
    ...tokenDetails.map(t => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
      valueUsd: t.valueUsd,
      contractAddress: t.contractAddress,
      logoUrl: t.logoUrl,
    })),
  ];

  const txCount = fromTxs.length + toTxs.length;
  const aiAnalysisContext = buildAiAnalysisContext(address, cfg.chainName, holdings, nativeValueUsd.toFixed(2), txCount);

  return {
    chain: cfg.chainName,
    address,
    nativeBalance: nativeBalance.toFixed(4),
    nativeValueUsd: nativeValueUsd.toFixed(2),
    totalBalanceUsd: nativeValueUsd.toFixed(2),
    txCount,
    holdings,
    tokenCount: tokenDetails.length,
    explorerUrl: cfg.explorerUrl,
    ...(cfg.nativeSymbol === 'ETH' ? {
      ethBalance: nativeBalance.toFixed(4),
      ethValueUsd: nativeValueUsd.toFixed(2),
    } : {}),
    aiAnalysisContext,
    recentTransactions,
  };
}

// ─── Solana Data Fetcher ──────────────────────────────────────────────────────

async function getSolData(address: string) {
  const [solBalance, splTokens, txs, solPrice] = await Promise.all([
    getSolanaSOLBalance(address).catch(() => 0),
    getSolanaWalletTokens(address).catch(() => []),
    getSolanaTransactions(address, 30).catch(() => []),
    getTokenPrice('solana').catch(() => 130),
  ]);

  const solValueUsd = solBalance * solPrice;

  // Fetch price + metadata for each SPL token via DexScreener
  const tokenResults = await Promise.allSettled(
    splTokens.slice(0, 30).map(async t => {
      try {
        const pairs = await getTokenPairs(t.mint);
        const top = pairs[0];
        if (!top) return null;
        const priceUsd = parseFloat(String(top.priceUsd ?? '0'));
        const valueUsd = t.uiAmount * priceUsd;
        const symbol = top.baseToken.symbol;
        return {
          symbol,
          name: top.baseToken.name,
          balance: t.uiAmount > 1000 ? t.uiAmount.toFixed(0) : t.uiAmount.toFixed(4),
          valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
          contractAddress: t.mint,
          logoUrl: top.info?.imageUrl ?? KNOWN_TOKEN_LOGOS[symbol.toUpperCase()] ?? null,
        };
      } catch { return null; }
    })
  );

  let totalTokenValueUsd = 0;
  const tokenHoldings = tokenResults
    .filter((r): r is PromiseFulfilledResult<NonNullable<ReturnType<typeof tokenResults[number] extends PromiseFulfilledResult<infer V> ? () => V : never>>> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => {
      const t = (r as PromiseFulfilledResult<{
        symbol: string; name: string; balance: string;
        valueUsd: string | null; contractAddress: string; logoUrl: string | null;
      }>).value;
      if (t.valueUsd) totalTokenValueUsd += parseFloat(t.valueUsd);
      return t;
    })
    .sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));

  const totalBalanceUsd = solValueUsd + totalTokenValueUsd;

  const holdings = [
    {
      symbol: 'SOL',
      name: 'Solana',
      balance: solBalance.toFixed(4),
      valueUsd: solValueUsd.toFixed(2),
      contractAddress: null,
      logoUrl: KNOWN_TOKEN_LOGOS['SOL'],
    },
    ...tokenHoldings,
  ];

  const recentTransactions = txs.slice(0, 30).map(tx => ({
    hash: tx.signature,
    blockTime: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null,
    status: 'success' as const,
    type: tx.type || 'transaction',
    asset: 'SOL',
    value: null,
    from: tx.feePayer,
    to: '',
    slot: tx.slot,
  }));

  const aiAnalysisContext = buildAiAnalysisContext(address, 'Solana', holdings, totalBalanceUsd.toFixed(2), txs.length);

  return {
    chain: 'Solana',
    address,
    solBalance: solBalance.toFixed(4),
    solValueUsd: solValueUsd.toFixed(2),
    totalBalanceUsd: totalBalanceUsd.toFixed(2),
    txCount: txs.length,
    holdings,
    tokenCount: tokenHoldings.length,
    explorerUrl: 'https://solscan.io',
    aiAnalysisContext,
    recentTransactions,
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

    // GoPlus security scan for top EVM token holdings (non-blocking)
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
