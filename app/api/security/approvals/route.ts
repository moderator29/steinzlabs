import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getTokenApprovals,
  getTokenMetadata,
  getPermit2Approvals,
  getNftApprovals,
  buildPermit2RevokeCalldata,
  buildNftRevokeCalldata,
  type Permit2Allowance,
  type NftOperatorApproval,
} from '@/lib/services/alchemy';
import { getTokensMulti } from '@/lib/services/dexscreener';
import { getTokenPrice } from '@/lib/services/coingecko';
import { normalizeAddress } from '@/lib/utils/addressNormalize';
import { enrichAddress, displayLabel, type AddressEnrichment, type EnrichSourceState } from '@/lib/security/addressEnrich';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

/** ERC-20 allowance, Permit2 time-bounded grant, or an NFT operator approval. */
export type ApprovalKind = 'erc20' | 'permit2' | 'nft';

export interface ApprovalResult {
  /** Which approval standard this row represents. */
  kind: ApprovalKind;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string | null;
  decimals: number;
  spender: string;
  spenderLabel: string;
  /** Human-readable allowance ("Unlimited", "0", "1,234.5", "All items"). */
  allowance: string;
  /** Raw allowance in base units (string bigint) so the client shows exact caps. */
  allowanceRaw: string;
  isUnlimited: boolean;
  isPermit2: boolean;
  /** USD currently exposed = min(balance, allowance) x live price. null = no price. */
  usdAtRisk: number | null;
  /** Owner token balance in human units (context). null when unknown. */
  balance: number | null;
  riskLevel: 'safe' | 'warning' | 'danger';
  /** approve(spender, 0) calldata the wallet signs to revoke. */
  revokeCalldata: string;
  /**
   * On-chain target the revoke tx is sent TO. For ERC-20 this is the token
   * contract; for Permit2 it is the canonical Permit2 contract; for NFT it is
   * the collection contract. The client sends the tx to this address, not to
   * `tokenAddress` (which for Permit2 is the underlying token, not the target).
   */
  revokeTarget: string;
  /** Permit2 grants are time-bounded; unix seconds. Only set when kind==='permit2'. */
  permit2Expiration?: number;
  /** NFT operator grant metadata (kind==='nft' only). */
  nft?: {
    tokenType: string;
    ownedCount: number | null;
    floorNative: number | null;
    /** USD value of the owned floor exposure when a native price exists. */
    floorUsdExposure: number | null;
  };
  spenderRisk?: {
    isMalicious: boolean;
    isPhishing: boolean;
    isBlacklisted: boolean;
    labels: string[];
    /** Number of independent sources that flag the spender malicious (corroboration). */
    maliciousSourceCount: number;
    /** Community scam reports from Chainabuse, when configured. null = unavailable. */
    scamReportCount: number | null;
    /** True when the spender is a contract with unverified source (Etherscan). null = unknown. */
    isUnverifiedContract: boolean | null;
    /** Per-source status so the UI can show which sources agree / were unavailable. */
    sources: EnrichSourceState[];
  };
  /** Where `spenderLabel` was resolved from: a verified Etherscan name, a curated list, or null (truncated address). */
  spenderLabelSource: AddressEnrichment['labelSource'];
}

// Spender labels + malicious verdicts now come from the shared multi-source
// enrichment (lib/security/addressEnrich.ts): verified Etherscan contract name,
// a curated known-spender fallback, GoPlus flags and Chainabuse scam reports.

// Uniswap Permit2 — a single canonical contract across every EVM chain. An
// approval to Permit2 is itself standard (the router gateway), but it then
// sub-delegates via signatures, so we tag it for clarity.
const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';

// Chain → CoinGecko id of the native gas token, so NFT floor exposure quoted in
// native units can be converted to USD. Omitted chains yield null (honest).
const NATIVE_COIN_ID: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'ethereum',
  arbitrum: 'ethereum',
  optimism: 'ethereum',
  bsc: 'binancecoin',
  polygon: 'matic-network',
};

// uint256 max sentinel. Many tokens use a slightly-below-max value for
// "unlimited", so treat anything at/above 2^255 as an unlimited grant.
const UNLIMITED_THRESHOLD = BigInt(2) ** BigInt(255);
const APPROVE_SELECTOR = '0x095ea7b3'; // approve(address,uint256)

function buildRevokeCalldata(spender: string): string {
  const spenderPadded = spender.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  return APPROVE_SELECTOR + spenderPadded + '0'.repeat(64);
}

/** Format a raw base-unit allowance into a compact human string. */
function classifyAllowance(
  raw: string,
  decimals: number,
): { display: string; isUnlimited: boolean; value: bigint | null } {
  if (!raw || raw === 'unknown') return { display: 'Unknown', isUnlimited: false, value: null };
  let n: bigint;
  try { n = BigInt(raw); } catch { return { display: 'Unknown', isUnlimited: false, value: null }; }
  if (n >= UNLIMITED_THRESHOLD) return { display: 'Unlimited', isUnlimited: true, value: n };
  if (n === BigInt(0)) return { display: '0', isUnlimited: false, value: n };
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  if (frac === BigInt(0)) return { display: whole.toLocaleString('en-US'), isUnlimited: false, value: n };
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return { display: `${whole.toLocaleString('en-US')}${fracStr ? '.' + fracStr : ''}`, isUnlimited: false, value: n };
}

/** Convert a raw base-unit bigint to a JS number in human units. */
function toHuman(raw: bigint, decimals: number): number {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = Number(raw / divisor);
  const frac = Number(raw % divisor) / Number(divisor);
  return whole + frac;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
  chain: z.string().trim().default('ethereum'),
});

type SpenderRiskInfo = ApprovalResult['spenderRisk'];

/** Map a merged multi-source enrichment into the row's spenderRisk block. */
function spenderRiskInfo(e: AddressEnrichment): SpenderRiskInfo {
  return {
    isMalicious: e.isMalicious,
    isPhishing: e.isPhishing,
    isBlacklisted: e.isBlacklisted,
    labels: e.labels,
    maliciousSourceCount: e.maliciousSourceCount,
    scamReportCount: e.scamReportCount,
    isUnverifiedContract: e.isUnverifiedContract,
    sources: e.sources,
  };
}

function isFlagged(r: SpenderRiskInfo): boolean {
  return !!(r?.isMalicious || r?.isPhishing || r?.isBlacklisted);
}

// ─── Per-kind enrichment ────────────────────────────────────────────────────

/** Enrich one raw ERC-20 approval into a display row. */
async function enrichErc20(
  approval: { tokenAddress: string; spender: string; allowance: string; balanceRaw: string },
  chain: string,
  priceMap: Map<string, { priceUsd?: string; info?: { imageUrl?: string } }>,
): Promise<ApprovalResult> {
  const [meta, spenderEnrich] = await Promise.all([
    getTokenMetadata(approval.tokenAddress, chain).catch(() => null),
    enrichAddress(approval.spender, chain),
  ]);

  const tokenMeta = meta;
  const spenderRisk = spenderRiskInfo(spenderEnrich);
  const decimals = typeof tokenMeta?.decimals === 'number' ? tokenMeta.decimals : 18;

  const { display: allowanceDisplay, isUnlimited, value: allowanceVal } =
    classifyAllowance(approval.allowance, decimals);

  const isPermit2Spender = normalizeAddress(approval.spender, chain) === PERMIT2_ADDRESS;

  const pair = priceMap.get(approval.tokenAddress.toLowerCase());
  const priceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;

  let balanceHuman: number | null = null;
  let usdAtRisk: number | null = null;
  try {
    const bal = BigInt(approval.balanceRaw);
    balanceHuman = toHuman(bal, decimals);
    if (priceUsd > 0) {
      const exposedRaw = allowanceVal === null ? bal : (allowanceVal < bal ? allowanceVal : bal);
      usdAtRisk = toHuman(exposedRaw, decimals) * priceUsd;
    }
  } catch {
    balanceHuman = null;
  }

  let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
  if (isFlagged(spenderRisk)) riskLevel = 'danger';
  else if (isUnlimited) riskLevel = 'warning';

  return {
    kind: 'erc20',
    tokenAddress: approval.tokenAddress,
    tokenSymbol: tokenMeta?.symbol ?? '???',
    tokenName: tokenMeta?.name ?? 'Unknown Token',
    tokenLogo: tokenMeta?.logo ?? pair?.info?.imageUrl ?? null,
    decimals,
    spender: approval.spender,
    spenderLabel: displayLabel(spenderEnrich),
    spenderLabelSource: spenderEnrich.labelSource,
    allowance: allowanceDisplay,
    allowanceRaw: approval.allowance,
    isUnlimited,
    isPermit2: isPermit2Spender,
    usdAtRisk,
    balance: balanceHuman,
    riskLevel,
    revokeCalldata: buildRevokeCalldata(approval.spender),
    revokeTarget: approval.tokenAddress,
    spenderRisk,
  };
}

/** Enrich one live Permit2 grant. Revoke targets the Permit2 contract. */
async function enrichPermit2(
  a: Permit2Allowance,
  chain: string,
  priceMap: Map<string, { priceUsd?: string; info?: { imageUrl?: string } }>,
): Promise<ApprovalResult> {
  const [meta, spenderEnrich] = await Promise.all([
    getTokenMetadata(a.tokenAddress, chain).catch(() => null),
    enrichAddress(a.spender, chain),
  ]);
  const tokenMeta = meta;
  const spenderRisk = spenderRiskInfo(spenderEnrich);
  const decimals = typeof tokenMeta?.decimals === 'number' ? tokenMeta.decimals : 18;

  const { display: allowanceDisplay, isUnlimited, value: allowanceVal } =
    classifyAllowance(a.amount, decimals);

  const pair = priceMap.get(a.tokenAddress.toLowerCase());
  const priceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;

  let balanceHuman: number | null = null;
  let usdAtRisk: number | null = null;
  try {
    const bal = BigInt(a.balanceRaw);
    balanceHuman = toHuman(bal, decimals);
    if (priceUsd > 0 && allowanceVal !== null) {
      const exposedRaw = allowanceVal < bal ? allowanceVal : bal;
      usdAtRisk = toHuman(exposedRaw, decimals) * priceUsd;
    }
  } catch {
    balanceHuman = null;
  }

  // A live Permit2 grant is directly spendable, so an unlimited one is a
  // warning at minimum; a flagged spender is danger.
  let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
  if (isFlagged(spenderRisk)) riskLevel = 'danger';
  else if (isUnlimited) riskLevel = 'warning';

  return {
    kind: 'permit2',
    tokenAddress: a.tokenAddress,
    tokenSymbol: tokenMeta?.symbol ?? '???',
    tokenName: tokenMeta?.name ?? 'Unknown Token',
    tokenLogo: tokenMeta?.logo ?? pair?.info?.imageUrl ?? null,
    decimals,
    spender: a.spender,
    spenderLabel: displayLabel(spenderEnrich),
    spenderLabelSource: spenderEnrich.labelSource,
    allowance: allowanceDisplay,
    allowanceRaw: a.amount,
    isUnlimited,
    isPermit2: true,
    usdAtRisk,
    balance: balanceHuman,
    riskLevel,
    revokeCalldata: buildPermit2RevokeCalldata(a.tokenAddress, a.spender),
    revokeTarget: PERMIT2_ADDRESS,
    permit2Expiration: a.expiration,
    spenderRisk,
  };
}

/** Enrich one live NFT operator grant. Revoke targets the collection. */
async function enrichNft(
  a: NftOperatorApproval,
  chain: string,
  nativeUsd: number | null,
): Promise<ApprovalResult> {
  const operatorEnrich = await enrichAddress(a.operator, chain);
  const spenderRisk = spenderRiskInfo(operatorEnrich);

  // Floor-price USD exposure = ownedCount x floorNative x nativeUsd, when all
  // three are known. Otherwise honest null (Alchemy has no floor for most sets).
  let floorUsdExposure: number | null = null;
  if (a.floorNative !== null && a.ownedCount !== null && nativeUsd !== null && a.ownedCount > 0) {
    floorUsdExposure = a.floorNative * a.ownedCount * nativeUsd;
  }

  // An operator grant lets the spender move EVERY token in the collection.
  // Flagged operator → danger; otherwise it is a standing warning by nature.
  let riskLevel: 'safe' | 'warning' | 'danger' = 'warning';
  if (isFlagged(spenderRisk)) riskLevel = 'danger';

  // Collection display name: prefer Alchemy's on-chain collection name, else a
  // truncated collection address. Never fabricated.
  const collectionLabel = a.name ?? `${a.collection.slice(0, 6)}…${a.collection.slice(-4)}`;

  return {
    kind: 'nft',
    tokenAddress: a.collection,
    tokenSymbol: a.symbol ?? a.name ?? 'NFT Collection',
    tokenName: collectionLabel,
    tokenLogo: a.logo,
    decimals: 0,
    spender: a.operator,
    // The operator (spender) label comes from the shared multi-source enrichment.
    spenderLabel: displayLabel(operatorEnrich),
    spenderLabelSource: operatorEnrich.labelSource,
    allowance: 'All items',
    allowanceRaw: 'all',
    isUnlimited: true,
    isPermit2: false,
    usdAtRisk: floorUsdExposure,
    balance: a.ownedCount,
    riskLevel,
    revokeCalldata: buildNftRevokeCalldata(a.operator),
    revokeTarget: a.collection,
    nft: {
      tokenType: a.tokenType,
      ownedCount: a.ownedCount,
      floorNative: a.floorNative,
      floorUsdExposure,
    },
    spenderRisk,
  };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid address. Must be a valid EVM address (0x...).' },
        { status: 400 }
      );
    }

    const { address, chain } = parsed.data;

    // Three independent on-chain scans in parallel: ERC-20 allowances, Permit2
    // time-bounded grants, and ERC-721/1155 operator approvals. Each degrades to
    // an empty set on failure so one source failing never blanks the others.
    const [erc20Settled, permit2Settled, nftSettled] = await Promise.allSettled([
      getTokenApprovals(address, chain),
      getPermit2Approvals(address, chain),
      getNftApprovals(address, chain),
    ]);

    const rawErc20 = erc20Settled.status === 'fulfilled' ? erc20Settled.value : [];
    const rawPermit2 = permit2Settled.status === 'fulfilled' ? permit2Settled.value : [];
    const rawNft = nftSettled.status === 'fulfilled' ? nftSettled.value : [];

    if (rawErc20.length === 0 && rawPermit2.length === 0 && rawNft.length === 0) {
      return NextResponse.json({
        approvals: [], totalRisk: 'safe', unlimitedCount: 0, dangerCount: 0,
        totalUsdAtRisk: 0, erc20Count: 0, permit2Count: 0, nftCount: 0,
        scannedAt: new Date().toISOString(),
      });
    }

    // Batch live USD prices for every distinct fungible token (DexScreener).
    const uniqueTokens = Array.from(new Set([
      ...rawErc20.map(a => a.tokenAddress),
      ...rawPermit2.map(a => a.tokenAddress),
    ]));
    const priceMap = uniqueTokens.length > 0
      ? await getTokensMulti(uniqueTokens).catch(() => new Map())
      : new Map();

    // Native gas-token USD price, only fetched when there is NFT floor exposure
    // to convert (keeps the CoinGecko call off the hot path otherwise).
    let nativeUsd: number | null = null;
    if (rawNft.some(n => n.floorNative !== null && (n.ownedCount ?? 0) > 0)) {
      const coinId = NATIVE_COIN_ID[chain.toLowerCase()];
      if (coinId) {
        const p = await getTokenPrice(coinId).catch(() => 0);
        nativeUsd = p > 0 ? p : null;
      }
    }

    const enriched: ApprovalResult[] = await Promise.all([
      ...rawErc20.map(a => enrichErc20(a, chain, priceMap)),
      ...rawPermit2.map(a => enrichPermit2(a, chain, priceMap)),
      ...rawNft.map(a => enrichNft(a, chain, nativeUsd)),
    ]);

    // Sort: danger first, then by USD-at-risk descending.
    const order = { danger: 0, warning: 1, safe: 2 };
    const sorted = enriched.sort((a, b) => {
      if (order[a.riskLevel] !== order[b.riskLevel]) return order[a.riskLevel] - order[b.riskLevel];
      return (b.usdAtRisk ?? 0) - (a.usdAtRisk ?? 0);
    });

    const totalRisk = sorted.some(a => a.riskLevel === 'danger')
      ? 'danger'
      : sorted.some(a => a.riskLevel === 'warning')
        ? 'warning'
        : 'safe';

    return NextResponse.json({
      approvals: sorted,
      totalRisk,
      unlimitedCount: sorted.filter(a => a.isUnlimited).length,
      dangerCount: sorted.filter(a => a.riskLevel === 'danger').length,
      totalUsdAtRisk: sorted.reduce((sum, a) => sum + (a.usdAtRisk ?? 0), 0),
      erc20Count: rawErc20.length,
      permit2Count: rawPermit2.length,
      nftCount: rawNft.length,
      scannedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
