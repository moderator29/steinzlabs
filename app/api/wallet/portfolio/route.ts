import 'server-only';
import { NextResponse } from 'next/server';
import {
  buildEvmWalletIntelligence,
  EVM_CHAIN_CONFIG,
  KNOWN_TOKEN_LOGOS,
} from '@/lib/services/evm-intelligence';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/portfolio?evm=<0x…>&sol=<base58>&chains=ethereum,base,…
 *
 * Multi-chain balances + holdings for the in-app Naka Wallet home. Fans out the
 * SAME real intelligence pipeline the single-chain /api/wallet-intelligence
 * route uses (Alchemy balances, DexScreener/CoinGecko/Birdeye prices, token
 * logos) across every requested chain in parallel, and returns just the pieces
 * the wallet list needs: per-chain priced total + normalized holdings.
 *
 * This exists so the home view can show a REAL combined net worth without firing
 * six full wallet-intelligence calls (each of which also runs GoPlus security
 * scans, Bitquery PnL and counterparty analysis the aggregate doesn't use).
 *
 * Only ever returns real, priced data — a chain that fails or the wallet has
 * never touched resolves to `null`, never a fabricated balance.
 */

// Native token contract sentinels that should surface as `contractAddress: null`
// (a native asset, not an ERC-20/SPL), matching the single-chain route's shape.
const SOL_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

interface Holding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logoUrl: string | null;
}

interface ChainPortfolio {
  totalBalanceUsd: string;
  holdings: Holding[];
  dataSource: string;
}

function isEvm(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
function isSol(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

async function evmChainPortfolio(address: string, chain: string): Promise<ChainPortfolio | null> {
  const intel = await buildEvmWalletIntelligence(address, chain);
  const holdings: Holding[] = intel.tokens.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD !== null ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.contractAddress,
    logoUrl: t.logoUrl,
  }));
  return {
    totalBalanceUsd: intel.totalBalanceUSD !== null ? intel.totalBalanceUSD.toFixed(2) : '0',
    holdings,
    dataSource: intel.dataSource,
  };
}

async function solChainPortfolio(address: string): Promise<ChainPortfolio | null> {
  const intel = await buildSolanaWalletIntelligence(address);
  const holdings: Holding[] = intel.tokens.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD !== null && t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.mintAddress === SOL_NATIVE_MINT ? null : t.mintAddress,
    logoUrl: t.logoURI ?? KNOWN_TOKEN_LOGOS[t.symbol] ?? null,
  }));
  return {
    totalBalanceUsd: intel.totalBalanceUSD.toFixed(2),
    holdings,
    dataSource: intel.dataSource,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const evm = searchParams.get('evm');
    const sol = searchParams.get('sol');
    const chainsParam = searchParams.get('chains');

    if ((!evm || !isEvm(evm)) && (!sol || !isSol(sol))) {
      return NextResponse.json({ error: 'A valid EVM (evm=0x…) or Solana (sol=…) address is required' }, { status: 400 });
    }

    // Requested chains, filtered to what we can actually price. Default to the
    // full supported EVM set + solana when the caller doesn't specify.
    const requested = (chainsParam ? chainsParam.split(',') : [...Object.keys(EVM_CHAIN_CONFIG), 'solana'])
      .map((c) => c.trim())
      .filter(Boolean);

    const jobs: Array<{ chain: string; run: () => Promise<ChainPortfolio | null> }> = [];
    for (const chain of requested) {
      if (chain === 'solana') {
        if (sol && isSol(sol)) jobs.push({ chain, run: () => solChainPortfolio(sol) });
      } else if (EVM_CHAIN_CONFIG[chain]) {
        if (evm && isEvm(evm)) jobs.push({ chain, run: () => evmChainPortfolio(evm, chain) });
      }
    }

    const settled = await Promise.allSettled(jobs.map((j) => j.run()));
    const chains: Record<string, ChainPortfolio | null> = {};
    let totalUsd = 0;
    settled.forEach((r, i) => {
      const chain = jobs[i].chain;
      if (r.status === 'fulfilled' && r.value) {
        chains[chain] = r.value;
        totalUsd += parseFloat(r.value.totalBalanceUsd || '0');
      } else {
        chains[chain] = null;
      }
    });

    return NextResponse.json(
      { evm: evm && isEvm(evm) ? evm : null, sol: sol && isSol(sol) ? sol : null, totalUsd: totalUsd.toFixed(2), chains },
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to aggregate portfolio';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
