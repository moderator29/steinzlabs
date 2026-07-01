import { NextRequest, NextResponse } from 'next/server';
import { getTokenApprovals, getTokenMetadata } from '@/lib/services/alchemy';
import { getTokensMulti } from '@/lib/services/dexscreener';

export const runtime = 'nodejs';

// ERC-20 approvals are EVM-only (Alchemy log scan), so a 20-byte hex address
// is the only valid owner shape here.
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Token approvals manager (revoke.cash-style).
 *
 * GET /api/wallet/approvals?wallet=<addr>&chain=<chain>
 *   Scans real ERC-20 approvals via the chunked Alchemy scanner (asset-transfer
 *   discovery + per-token Approval logs + live allowance() / balanceOf), drops
 *   anything already at zero, and enriches each open approval with token
 *   symbol/name/decimals/logo, a human-readable allowance (incl. "Unlimited"),
 *   live USD-at-risk, and the approve(spender,0) calldata for revocation.
 *
 * Revocation is performed client-side: the wallet signs an `approve(spender, 0)`
 * transaction with the user's own key (same flow as Send), so no private key
 * ever touches the server.
 */

// uint256 max (unlimited approval). Anything at/above ~2^255 is, in practice,
// an unlimited grant — many tokens use slightly-below-max sentinels.
const UNLIMITED_THRESHOLD = BigInt(2) ** BigInt(255);
const APPROVE_SELECTOR = '0x095ea7b3'; // approve(address,uint256)

function formatAllowance(raw: string, decimals: number): { display: string; unlimited: boolean; value: bigint | null } {
  if (raw === 'unknown') return { display: 'Unknown', unlimited: false, value: null };
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    return { display: 'Unknown', unlimited: false, value: null };
  }
  if (value >= UNLIMITED_THRESHOLD) return { display: 'Unlimited', unlimited: true, value };
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === BigInt(0)) return { display: whole.toLocaleString('en-US'), unlimited: false, value };
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return { display: `${whole.toLocaleString('en-US')}${fracStr ? '.' + fracStr : ''}`, unlimited: false, value };
}

function toHuman(raw: bigint, decimals: number): number {
  const divisor = BigInt(10) ** BigInt(decimals);
  return Number(raw / divisor) + Number(raw % divisor) / Number(divisor);
}

// Build approve(spender, 0) calldata so the client can sign + broadcast it.
function buildRevokeCalldata(spender: string): string {
  const spenderPadded = spender.replace('0x', '').toLowerCase().padStart(64, '0');
  return APPROVE_SELECTOR + spenderPadded + '0'.repeat(64);
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const chain = request.nextUrl.searchParams.get('chain');

  if (!wallet || !chain) {
    return NextResponse.json({ error: 'wallet and chain parameters required' }, { status: 400 });
  }
  if (!EVM_ADDRESS_RE.test(wallet)) {
    return NextResponse.json({ error: 'Approvals are available for EVM addresses only' }, { status: 400 });
  }

  try {
    const approvals = await getTokenApprovals(wallet, chain);
    if (approvals.length === 0) return NextResponse.json({ approvals: [] });

    const uniqueTokens = Array.from(new Set(approvals.map(a => a.tokenAddress)));
    const priceMap = await getTokensMulti(uniqueTokens).catch(() => new Map());

    const enriched = await Promise.all(
      approvals.map(async (a) => {
        let symbol = 'TOKEN';
        let name = 'Unknown Token';
        let decimals = 18;
        let logo: string | null = null;
        try {
          const meta = await getTokenMetadata(a.tokenAddress, chain);
          symbol = meta.symbol ?? symbol;
          name = meta.name ?? name;
          decimals = typeof meta.decimals === 'number' ? meta.decimals : decimals;
          logo = meta.logo ?? null;
        } catch {
          /* metadata best-effort — show the raw token address fallback */
        }
        const allowance = formatAllowance(a.allowance, decimals);

        const pair = priceMap.get(a.tokenAddress.toLowerCase());
        const priceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;
        if (!logo) logo = pair?.info?.imageUrl ?? null;

        let balance: number | null = null;
        let usdAtRisk: number | null = null;
        try {
          const bal = BigInt(a.balanceRaw);
          balance = toHuman(bal, decimals);
          if (priceUsd > 0) {
            const exposed = allowance.value === null
              ? bal
              : (allowance.value < bal ? allowance.value : bal);
            usdAtRisk = toHuman(exposed, decimals) * priceUsd;
          }
        } catch {
          balance = null;
        }

        return {
          tokenAddress: a.tokenAddress,
          spender: a.spender,
          symbol,
          name,
          decimals,
          logo,
          allowanceRaw: a.allowance,
          allowanceDisplay: allowance.display,
          unlimited: allowance.unlimited,
          balance,
          usdAtRisk,
          revokeCalldata: buildRevokeCalldata(a.spender),
        };
      }),
    );

    // Highest dollar exposure first, then unlimited grants.
    enriched.sort((x, y) => {
      const dx = (y.usdAtRisk ?? 0) - (x.usdAtRisk ?? 0);
      if (dx !== 0) return dx;
      return Number(y.unlimited) - Number(x.unlimited);
    });
    return NextResponse.json({ approvals: enriched });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load approvals';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
