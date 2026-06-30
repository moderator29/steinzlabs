import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenApprovals, getTokenMetadata } from '@/lib/services/alchemy';
import { getAddressSecurity } from '@/lib/services/goplus';
import { getTokensMulti } from '@/lib/services/dexscreener';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApprovalResult {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string | null;
  decimals: number;
  spender: string;
  spenderLabel: string;
  /** Human-readable allowance ("Unlimited", "0", "1,234.5"). */
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
  spenderRisk?: {
    isMalicious: boolean;
    isPhishing: boolean;
    isBlacklisted: boolean;
    labels: string[];
  };
}

// ─── Known Spender Labels ─────────────────────────────────────────────────────
// Map well-known protocol addresses to friendly labels (EVM mainnet).
// Keys are lowercase — these are EVM-scoped, so lowercasing is correct.

const KNOWN_SPENDERS: Record<string, string> = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router 2',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
  '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch V3',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Permit2',
  '0x1bd435f3c054b6e901b7b108a0ab7617c808677b': 'ParaSwap',
  '0x216b4b4ba9f3e719726886d34a177484278bfcae': 'ParaSwap V5',
  '0xa2f78ab2355fe2f984d808b5cee7fd0a93d5270e': 'OpenSea Seaport',
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': 'OpenSea Seaport 1.5',
};

// Uniswap Permit2 — a single canonical contract across every EVM chain. An
// approval to Permit2 is itself standard (the router gateway), but it then
// sub-delegates via signatures, so we tag it for clarity.
const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';

function getSpenderLabel(address: string): string {
  return KNOWN_SPENDERS[address.toLowerCase()] || `${address.slice(0, 6)}…${address.slice(-4)}`;
}

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

    // Chunked/paginated Alchemy scan (asset-transfer discovery + per-token
    // Approval logs). Returns current allowance + owner balance per pair.
    const rawApprovals = await getTokenApprovals(address, chain);

    if (rawApprovals.length === 0) {
      return NextResponse.json({
        approvals: [], totalRisk: 'safe', unlimitedCount: 0, dangerCount: 0,
        totalUsdAtRisk: 0, scannedAt: new Date().toISOString(),
      });
    }

    // Batch live USD prices for every distinct token (DexScreener, free).
    const uniqueTokens = Array.from(new Set(rawApprovals.map(a => a.tokenAddress)));
    const priceMap = await getTokensMulti(uniqueTokens).catch(() => new Map());

    const enriched: ApprovalResult[] = await Promise.all(
      rawApprovals.map(async (approval): Promise<ApprovalResult> => {
        const [meta, spenderSecurity] = await Promise.allSettled([
          getTokenMetadata(approval.tokenAddress, chain),
          getAddressSecurity(approval.spender, chain),
        ]);

        const tokenMeta = meta.status === 'fulfilled' ? meta.value : null;
        const spenderRisk = spenderSecurity.status === 'fulfilled' ? spenderSecurity.value : null;
        const decimals = typeof tokenMeta?.decimals === 'number' ? tokenMeta.decimals : 18;

        const { display: allowanceDisplay, isUnlimited, value: allowanceVal } =
          classifyAllowance(approval.allowance, decimals);

        const isPermit2 = normalizeAddress(approval.spender, chain) === PERMIT2_ADDRESS;
        const spenderLabel = getSpenderLabel(approval.spender);

        // USD-at-risk = min(current balance, allowance) x live price.
        const pair = priceMap.get(approval.tokenAddress.toLowerCase());
        const priceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;

        let balanceHuman: number | null = null;
        let usdAtRisk: number | null = null;
        try {
          const bal = BigInt(approval.balanceRaw);
          balanceHuman = toHuman(bal, decimals);
          if (priceUsd > 0) {
            // Exposure is capped by what the wallet actually holds.
            const exposedRaw = allowanceVal === null
              ? bal // unknown allowance — assume balance fully exposed
              : (allowanceVal < bal ? allowanceVal : bal);
            usdAtRisk = toHuman(exposedRaw, decimals) * priceUsd;
          }
        } catch {
          balanceHuman = null;
        }

        // Risk classification: a flagged spender is always danger; an unlimited
        // grant is a warning (escalated in the UI when real USD is exposed).
        let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
        if (spenderRisk?.isMalicious || spenderRisk?.isPhishing || spenderRisk?.isBlacklisted) {
          riskLevel = 'danger';
        } else if (isUnlimited) {
          riskLevel = 'warning';
        }

        return {
          tokenAddress: approval.tokenAddress,
          tokenSymbol: tokenMeta?.symbol ?? '???',
          tokenName: tokenMeta?.name ?? 'Unknown Token',
          tokenLogo: tokenMeta?.logo ?? pair?.info?.imageUrl ?? null,
          decimals,
          spender: approval.spender,
          spenderLabel,
          allowance: allowanceDisplay,
          allowanceRaw: approval.allowance,
          isUnlimited,
          isPermit2,
          usdAtRisk,
          balance: balanceHuman,
          riskLevel,
          revokeCalldata: buildRevokeCalldata(approval.spender),
          spenderRisk: spenderRisk ? {
            isMalicious: spenderRisk.isMalicious,
            isPhishing: spenderRisk.isPhishing,
            isBlacklisted: spenderRisk.isBlacklisted,
            labels: spenderRisk.labels,
          } : undefined,
        };
      })
    );

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
      scannedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
