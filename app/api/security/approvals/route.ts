import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenApprovals, getTokenMetadata } from '@/lib/services/alchemy';
import { getAddressSecurity } from '@/lib/services/goplus';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApprovalResult {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  spender: string;
  spenderLabel: string;
  allowance: string;
  isUnlimited: boolean;
  riskLevel: 'safe' | 'warning' | 'danger';
  spenderRisk?: {
    isMalicious: boolean;
    isPhishing: boolean;
    labels: string[];
  };
}

// ─── Known Spender Labels ─────────────────────────────────────────────────────
// Map well-known protocol addresses to friendly labels (EVM mainnet)

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

function getSpenderLabel(address: string): string {
  return KNOWN_SPENDERS[address.toLowerCase()] || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const UNLIMITED_THRESHOLD = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') - BigInt(1000);

function classifyAllowance(raw: string): { display: string; isUnlimited: boolean } {
  if (!raw || raw === 'unknown') return { display: 'Unknown', isUnlimited: false };
  try {
    const n = BigInt(raw);
    if (n >= UNLIMITED_THRESHOLD) return { display: 'Unlimited', isUnlimited: true };
    if (n === 0n) return { display: '0', isUnlimited: false };
    // Format large numbers in human-readable form
    if (n > 1_000_000_000_000_000_000_000n) return { display: `${(Number(n) / 1e18).toFixed(2)} tokens`, isUnlimited: false };
    return { display: n.toString(), isUnlimited: false };
  } catch {
    return { display: raw, isUnlimited: false };
  }
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

    // Fetch raw approval list from service layer (Alchemy ERC-20 transfer events)
    const rawApprovals = await getTokenApprovals(address, chain);

    if (rawApprovals.length === 0) {
      return NextResponse.json({ approvals: [], totalRisk: 'safe', scannedAt: new Date().toISOString() });
    }

    // Enrich each approval: token metadata + spender risk check (parallel)
    const enriched: ApprovalResult[] = await Promise.all(
      rawApprovals.map(async (approval): Promise<ApprovalResult> => {
        // Fetch token metadata and spender security in parallel
        const [meta, spenderSecurity] = await Promise.allSettled([
          getTokenMetadata(approval.tokenAddress, chain),
          getAddressSecurity(approval.spender, chain),
        ]);

        const tokenMeta = meta.status === 'fulfilled' ? meta.value : null;
        const spenderRisk = spenderSecurity.status === 'fulfilled' ? spenderSecurity.value : null;

        const { display: allowanceDisplay, isUnlimited } = classifyAllowance(approval.allowance);
        const spenderLabel = getSpenderLabel(approval.spender);

        // Risk classification
        let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
        if (spenderRisk?.isMalicious || spenderRisk?.isPhishing) {
          riskLevel = 'danger';
        } else if (isUnlimited) {
          riskLevel = 'warning';
        }

        return {
          tokenAddress: approval.tokenAddress,
          tokenSymbol: tokenMeta?.symbol ?? '???',
          tokenName: tokenMeta?.name ?? 'Unknown Token',
          spender: approval.spender,
          spenderLabel,
          allowance: allowanceDisplay,
          isUnlimited,
          riskLevel,
          spenderRisk: spenderRisk ? {
            isMalicious: spenderRisk.isMalicious,
            isPhishing: spenderRisk.isPhishing,
            labels: spenderRisk.labels,
          } : undefined,
        };
      })
    );

    // Sort: danger first, then warning, then safe
    const sorted = enriched.sort((a, b) => {
      const order = { danger: 0, warning: 1, safe: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    });

    // Overall risk summary
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
      scannedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
