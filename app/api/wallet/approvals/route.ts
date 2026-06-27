import { NextRequest, NextResponse } from 'next/server';
import { getTokenApprovals, getTokenMetadata } from '@/lib/services/alchemy';

export const runtime = 'nodejs';

// ERC-20 approvals are EVM-only (Alchemy log scan), so a 20-byte hex address
// is the only valid owner shape here.
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Token approvals manager (revoke.cash-style).
 *
 * GET /api/wallet/approvals?wallet=<addr>&chain=<chain>
 *   Scans real ERC-20 Approval logs on-chain via Alchemy, resolves the current
 *   allowance for every (token, spender) pair, drops anything already at zero,
 *   and enriches each open approval with token symbol/name/decimals plus a
 *   human-readable allowance (incl. "Unlimited" detection).
 *
 * Revocation is performed client-side: the wallet signs an `approve(spender, 0)`
 * transaction with the user's own key (same flow as Send), so no private key
 * ever touches the server. The route returns the calldata needed for that.
 */

// uint256 max (unlimited approval). Anything at/above ~2^255 is, in practice,
// an unlimited grant — many tokens use slightly-below-max sentinels.
const UNLIMITED_THRESHOLD = BigInt(2) ** BigInt(255);
const APPROVE_SELECTOR = '0x095ea7b3'; // approve(address,uint256)

function formatAllowance(raw: string, decimals: number): { display: string; unlimited: boolean } {
  if (raw === 'unknown') return { display: 'Unknown', unlimited: false };
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    return { display: 'Unknown', unlimited: false };
  }
  if (value >= UNLIMITED_THRESHOLD) return { display: 'Unlimited', unlimited: true };
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === BigInt(0)) return { display: whole.toLocaleString('en-US'), unlimited: false };
  // Show up to 4 significant fractional digits without trailing zeros.
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return { display: `${whole.toLocaleString('en-US')}${fracStr ? '.' + fracStr : ''}`, unlimited: false };
}

// Build approve(spender, 0) calldata so the client can sign + broadcast it.
function buildRevokeCalldata(spender: string): string {
  const spenderPadded = spender.replace('0x', '').toLowerCase().padStart(64, '0');
  const zeroAmount = '0'.padStart(64, '0');
  return APPROVE_SELECTOR + spenderPadded + zeroAmount;
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
          revokeCalldata: buildRevokeCalldata(a.spender),
        };
      }),
    );

    // Unlimited grants are the highest risk — surface them first.
    enriched.sort((x, y) => Number(y.unlimited) - Number(x.unlimited));
    return NextResponse.json({ approvals: enriched });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load approvals';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
