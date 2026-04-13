import 'server-only';
import { NextResponse } from 'next/server';

// ─── Service Layer Imports ────────────────────────────────────────────────────
import { getTokenSecurity } from '@/lib/services/goplus';
import { searchPairs } from '@/lib/services/dexscreener';
import { getContractCode } from '@/lib/services/alchemy';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getBirdeyeTokenSecurity, getBirdeyeTokenOverview } from '@/lib/services/birdeye';
import type { TokenSecurityResult } from '@/lib/security/goplusService';

// ─── Chain Maps ───────────────────────────────────────────────────────────────

// Symbolic name → numeric chainId string
const CHAIN_MAP: Record<string, string> = {
  ethereum: '1', eth: '1',
  bsc: '56', bnb: '56',
  polygon: '137', matic: '137',
  solana: 'solana', sol: 'solana',
  base: '8453',
  avalanche: '43114', avax: '43114',
  arbitrum: '42161', arb: '42161',
  '1': '1', '56': '56', '137': '137',
  '8453': '8453', '43114': '43114', '42161': '42161',
};

// Numeric chainId → symbolic chain name (used by service layer)
const CHAIN_ID_TO_NAME: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '137': 'polygon',
  '8453': 'base',
  '42161': 'arbitrum',
  '10': 'optimism',
  '43114': 'avalanche',
};

const CHAIN_LABEL: Record<string, string> = {
  '1': 'Ethereum', '56': 'BSC', '137': 'Polygon',
  '8453': 'Base', '43114': 'Avalanche', '42161': 'Arbitrum',
  solana: 'Solana',
};

// Public RPC fallbacks for chains Alchemy SDK does not support (e.g. Avalanche)
const FALLBACK_RPC: Record<string, string> = {
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  '43114': 'https://api.avax.network/ext/bc/C/rpc',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Detect if an address is an EOA (non-contract) wallet.
 * Uses Alchemy service layer where supported; falls back to public RPC otherwise.
 * Returns false (unknown = not EOA) on any failure to be permissive.
 */
async function isEOAWallet(address: string, chainId: string): Promise<boolean> {
  const chainName = CHAIN_ID_TO_NAME[chainId] ?? 'ethereum';

  // Try Alchemy service layer first
  try {
    const code = await getContractCode(address, chainName);
    return !code || code === '0x' || code === '0x0';
  } catch {
    // Alchemy doesn't support this chain — try public RPC fallback
    const rpcUrl = FALLBACK_RPC[chainName] ?? FALLBACK_RPC[chainId];
    if (!rpcUrl) return false; // Can't determine — treat as contract (permissive)

    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json() as { result?: string };
      const code = data.result;
      return !code || code === '0x' || code === '0x0';
    } catch {
      return false;
    }
  }
}

/** Fetch DEX market data via service layer and return a normalized dexData block. */
async function fetchDexData(address: string): Promise<Record<string, unknown> | null> {
  try {
    const pairs = await searchPairs(address);
    const top = pairs[0];
    if (!top) return null;
    return {
      name: top.baseToken.name,
      symbol: top.baseToken.symbol,
      price: parseFloat(String(top.priceUsd ?? '0')),
      priceChange24h: top.priceChange?.h24 ?? 0,
      volume24h: top.volume?.h24 ?? 0,
      liquidity: top.liquidity?.usd ?? 0,
      fdv: top.fdv ?? 0,
      marketCap: top.fdv ?? 0,          // DexPair has no marketCap field; use fdv
      dexId: top.dexId,
      pairAddress: top.pairAddress,
      url: top.url ?? null,
      image: top.info?.imageUrl ?? null,
      websites: top.info?.websites ?? [],
    };
  } catch {
    return null;
  }
}

// ─── Solana Handler ───────────────────────────────────────────────────────────
// GoPlus does not support Solana. We combine Birdeye token security + DexScreener.

async function handleSolanaToken(address: string): Promise<Record<string, unknown>> {
  // Parallel fetch: DEX market data + Birdeye security + token overview (holder count)
  const [dexData, birdSec, birdOverview] = await Promise.all([
    fetchDexData(address),
    getBirdeyeTokenSecurity(address),
    getBirdeyeTokenOverview(address, 'solana'),
  ]);

  if (!dexData) throw new Error('Token not found. Verify the Solana token address.');

  const liquidity = (dexData.liquidity as number) ?? 0;
  const volume24h = (dexData.volume24h as number) ?? 0;
  const websites = (dexData.websites as Array<{ label: string; url: string }>) ?? [];

  // ── Real Birdeye security flags ──────────────────────────────────────────
  const isMintable = birdSec?.isMintable ?? false;
  const freezeable = birdSec?.freezeable ?? false;
  const lpBurned = birdSec?.lpBurned ?? false;
  const top10HolderPercent = birdSec?.top10HolderPercent ?? null;
  const creatorAddress = birdSec?.creatorAddress || birdSec?.ownerAddress || 'N/A';
  const holderCount = birdOverview?.holder ?? 0;

  // ── Deterministic trust score ─────────────────────────────────────────────
  let score = 70;
  // Market signals
  if (liquidity > 100_000) score += 10;
  else if (liquidity < 10_000) score -= 15;
  if (volume24h > 50_000) score += 5;
  if (websites.length > 0) score += 5;
  // Real security flags from Birdeye
  if (isMintable) score -= 10;
  if (!lpBurned && birdSec !== null) score -= 10; // only penalize if we have real data
  if (freezeable) score -= 10;
  if (top10HolderPercent !== null && top10HolderPercent > 80) score -= 15;
  else if (top10HolderPercent !== null && top10HolderPercent > 60) score -= 5;
  score = Math.max(0, Math.min(100, score));

  let safetyLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' = 'SAFE';
  let safetyColor = '#10B981';
  if (score < 30) { safetyLevel = 'DANGER'; safetyColor = '#EF4444'; }
  else if (score < 50) { safetyLevel = 'WARNING'; safetyColor = '#F59E0B'; }
  else if (score < 70) { safetyLevel = 'CAUTION'; safetyColor = '#F59E0B'; }

  // ── Security checks — all backed by real data ────────────────────────────
  const checks = [
    { label: 'Token Listed on DEX', status: 'pass' as const },
    { label: 'Has Liquidity Pool', status: liquidity > 1_000 ? 'pass' as const : 'fail' as const },
    { label: 'Active Trading Volume', status: volume24h > 1_000 ? 'pass' as const : volume24h > 0 ? 'warn' as const : 'fail' as const },
    { label: 'Has Website / Social', status: websites.length > 0 ? 'pass' as const : 'warn' as const },
    { label: 'Sufficient Liquidity (>$10k)', status: liquidity > 10_000 ? 'pass' as const : liquidity > 1_000 ? 'warn' as const : 'fail' as const },
    // Real Birdeye flags — only shown when Birdeye returned data
    ...(birdSec !== null ? [
      { label: 'Mint Authority Disabled', status: isMintable ? 'fail' as const : 'pass' as const },
      { label: 'Freeze Authority Disabled', status: freezeable ? 'fail' as const : 'pass' as const },
      { label: 'LP Tokens Burned', status: lpBurned ? 'pass' as const : 'warn' as const },
      {
        label: `Top 10 Holder Concentration${top10HolderPercent !== null ? ` (${top10HolderPercent.toFixed(1)}%)` : ''}`,
        status: top10HolderPercent === null ? 'warn' as const
          : top10HolderPercent > 80 ? 'fail' as const
          : top10HolderPercent > 60 ? 'warn' as const
          : 'pass' as const,
      },
    ] : []),
  ];

  return {
    contract: address,
    chainId: 'solana',
    name: (dexData.name as string) || birdOverview?.name || 'Unknown Token',
    symbol: (dexData.symbol as string) || birdOverview?.symbol || '???',
    totalSupply: 'N/A',
    holderCount,
    creatorAddress,
    ownerAddress: birdSec?.ownerAddress || 'N/A',
    trustScore: score,
    safetyLevel,
    safetyColor,
    buyTax: '0.0%',
    sellTax: '0.0%',
    isHoneypot: false,
    isOpenSource: true,
    isMintable,
    isProxy: freezeable,         // freezeable = can freeze accounts = closest proxy analogue
    hasHiddenOwner: false,
    canTakeBackOwnership: false,
    ownerCanChangeBalance: freezeable,
    lpHolders: [],
    lpTotalSupply: 'N/A',
    checks,
    dexData,
    timestamp: new Date().toISOString(),
    solanaNote: birdSec
      ? 'Security data from Birdeye on-chain analysis + DEX market signals.'
      : 'Security data derived from DEX market signals only (Birdeye data unavailable). Always DYOR.',
  };
}

// ─── AI Security Analysis ─────────────────────────────────────────────────────

async function buildAiAnalysis(response: Record<string, unknown>): Promise<string | null> {
  const chainLabel = CHAIN_LABEL[(response.chainId as string)] ?? 'EVM';
  const failedChecks = ((response.checks as Array<{ label: string; status: string }>) ?? [])
    .filter(c => c.status === 'fail').map(c => c.label).join(', ') || 'None';

  const prompt = `You are a crypto security expert. Analyze this token security scan and give a concise verdict.

Token: ${response.name} (${response.symbol}) on ${chainLabel}
Trust Score: ${response.trustScore}/100 — ${response.safetyLevel}
Honeypot: ${response.isHoneypot ? 'YES [WARNING]' : 'No'}
Open Source: ${response.isOpenSource ? 'Yes' : 'NO [WARNING]'}
Mintable: ${response.isMintable ? 'YES [WARNING]' : 'No'}
Hidden Owner: ${response.hasHiddenOwner ? 'YES [WARNING]' : 'No'}
Owner Can Change Balance: ${response.ownerCanChangeBalance ? 'YES [WARNING]' : 'No'}
Buy Tax: ${response.buyTax} | Sell Tax: ${response.sellTax}
Holders: ${response.holderCount}
Failed Checks: ${failedChecks}

Respond with 3 sections only:
SUMMARY: (2 sentences max — plain risk assessment)
RISKS: (bullet list of top risks, or "No critical risks identified" if clean)
VERDICT: (one word: SAFE / CAUTION / WARNING / DANGER) — (one sentence why)`;

  try {
    return await vtxAnalyze(prompt, 300);
  } catch {
    return null;
  }
}

// ─── EVM Response Builder ─────────────────────────────────────────────────────
// TokenSecurityResult from the service layer already has trust score, safety
// level, color, and checks pre-computed. We just re-shape for the UI contract.

function buildEvmResponse(
  contractAddress: string,
  chainId: string,
  sec: TokenSecurityResult,
  dexData: Record<string, unknown> | null
): Record<string, unknown> {
  const name = sec.raw?.token_name || sec.raw?.name || 'Unknown Token';
  const symbol = sec.raw?.token_symbol || sec.raw?.symbol || '???';
  const totalSupply = sec.raw?.total_supply || 'N/A';

  return {
    contract: contractAddress,
    chainId,
    name,
    symbol,
    totalSupply,
    holderCount: sec.holderCount,
    creatorAddress: sec.creatorAddress || 'N/A',
    ownerAddress: sec.ownerAddress || 'N/A',
    trustScore: sec.trustScore,
    safetyLevel: sec.safetyLevel,
    safetyColor: sec.safetyColor,
    buyTax: (sec.buyTax * 100).toFixed(1) + '%',
    sellTax: (sec.sellTax * 100).toFixed(1) + '%',
    isHoneypot: sec.isHoneypot,
    isOpenSource: sec.isOpenSource,
    isMintable: sec.isMintable,
    isProxy: sec.isProxy,
    hasHiddenOwner: sec.hasHiddenOwner,
    canTakeBackOwnership: sec.canTakeBackOwnership,
    ownerCanChangeBalance: sec.ownerCanChangeBalance,
    lpHolders: sec.lpHolders,
    lpTotalSupply: sec.raw?.lp_total_supply || 'N/A',
    checks: sec.checks,
    dexData: dexData ?? undefined,
    timestamp: new Date().toISOString(),
  };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { contract, chain = 'ethereum' } = await request.json() as {
      contract?: string;
      chain?: string;
    };

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required' }, { status: 400 });
    }

    const chainId = CHAIN_MAP[chain.toLowerCase()] || '1';
    const address = contract.trim();
    const isSolana = chainId === 'solana' || isSolanaAddress(address);

    // ── Solana path ────────────────────���────────────────────────────────────
    if (isSolana) {
      const response = await handleSolanaToken(address);
      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    const contractAddress = address.toLowerCase();

    // ── EOA wallet guard ───────────────────────────────────���────────────────
    if (/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
      const isWallet = await isEOAWallet(contractAddress, chainId).catch(() => false);
      if (isWallet) {
        return NextResponse.json({
          error: 'This is a Wallet Address, Not a Contract',
          isWalletAddress: true,
          message: 'The address you entered belongs to an externally owned account (wallet), not a smart contract. Token Scanner only analyzes contract addresses.',
          suggestion: 'Use the DNA Analyzer to analyze wallet addresses.',
          redirectUrl: '/dashboard/dna-analyzer',
        }, { status: 400 });
      }
    }

    // ── Security scan + DEX data in parallel ────────────────────────────────
    const [sec, dexData] = await Promise.all([
      getTokenSecurity(contractAddress, chain),
      fetchDexData(contractAddress),
    ]);

    const response = buildEvmResponse(contractAddress, chainId, sec, dexData);

    // ── AI analysis (non-blocking) ──────────────────────────────────────────
    const aiText = await buildAiAnalysis(response);
    if (aiText) (response as any).aiAnalysis = aiText;

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to scan token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contract = searchParams.get('contract');
    const chain = searchParams.get('chain') || 'ethereum';

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required (use ?contract=0x...)' }, { status: 400 });
    }

    const chainId = CHAIN_MAP[chain.toLowerCase()] || '1';
    const address = contract.trim();
    const isSolana = chainId === 'solana' || isSolanaAddress(address);

    if (isSolana) {
      const response = await handleSolanaToken(address);
      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    const contractAddress = address.toLowerCase();
    const [sec, dexData] = await Promise.all([
      getTokenSecurity(contractAddress, chain),
      fetchDexData(contractAddress),
    ]);

    const response = buildEvmResponse(contractAddress, chainId, sec, dexData);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to scan token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
