import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenApprovals,
  getTokenMetadata,
  getPermit2Approvals,
  getNftApprovals,
  buildPermit2RevokeCalldata,
  buildNftRevokeCalldata,
} from '@/lib/services/alchemy';
import { getTokensMulti } from '@/lib/services/dexscreener';

export const runtime = 'nodejs';

// The canonical cross-chain Permit2 contract (same address on every EVM chain).
const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';

// Approvals are EVM-only (Alchemy log scan), so a 20-byte hex address
// is the only valid owner shape here.
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Token approvals manager (revoke.cash-style).
 *
 * GET /api/wallet/approvals?wallet=<addr>&chain=<chain>
 *   Scans real ERC-20 allowances, Permit2 time-bounded grants, and ERC-721 /
 *   ERC-1155 setApprovalForAll operator approvals via Alchemy (asset-transfer
 *   discovery + Approval / ApprovalForAll / Permit2 logs + live on-chain reads),
 *   drops anything already revoked, and enriches each open grant with token or
 *   collection metadata, a human-readable allowance, live USD-at-risk, and the
 *   correct zeroing calldata + target contract for revocation.
 *
 * Revocation is performed client-side: the wallet signs the zeroing tx with the
 * user's own key (same flow as Send), so no private key ever touches the server.
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
    // Three independent on-chain scans in parallel; one failing never blanks
    // the others (each degrades to an empty set).
    const [erc20Settled, permit2Settled, nftSettled] = await Promise.allSettled([
      getTokenApprovals(wallet, chain),
      getPermit2Approvals(wallet, chain),
      getNftApprovals(wallet, chain),
    ]);
    const erc20 = erc20Settled.status === 'fulfilled' ? erc20Settled.value : [];
    const permit2 = permit2Settled.status === 'fulfilled' ? permit2Settled.value : [];
    const nft = nftSettled.status === 'fulfilled' ? nftSettled.value : [];

    if (erc20.length === 0 && permit2.length === 0 && nft.length === 0) {
      return NextResponse.json({ approvals: [] });
    }

    const uniqueTokens = Array.from(new Set([
      ...erc20.map(a => a.tokenAddress),
      ...permit2.map(a => a.tokenAddress),
    ]));
    const priceMap = uniqueTokens.length > 0
      ? await getTokensMulti(uniqueTokens).catch(() => new Map())
      : new Map();

    // Shared fungible-token enrichment for ERC-20 + Permit2 rows.
    const enrichFungible = async (
      kind: 'erc20' | 'permit2',
      tokenAddress: string,
      spender: string,
      rawAmount: string,
      balanceRaw: string,
      revokeCalldata: string,
      revokeTarget: string,
      expiration?: number,
    ) => {
      let symbol = 'TOKEN';
      let name = 'Unknown Token';
      let decimals = 18;
      let logo: string | null = null;
      try {
        const meta = await getTokenMetadata(tokenAddress, chain);
        symbol = meta.symbol ?? symbol;
        name = meta.name ?? name;
        decimals = typeof meta.decimals === 'number' ? meta.decimals : decimals;
        logo = meta.logo ?? null;
      } catch {
        /* metadata best-effort */
      }
      const allowance = formatAllowance(rawAmount, decimals);
      const pair = priceMap.get(tokenAddress.toLowerCase());
      const priceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) || 0 : 0;
      if (!logo) logo = pair?.info?.imageUrl ?? null;

      let balance: number | null = null;
      let usdAtRisk: number | null = null;
      try {
        const bal = BigInt(balanceRaw);
        balance = toHuman(bal, decimals);
        if (priceUsd > 0) {
          const exposed = allowance.value === null ? bal : (allowance.value < bal ? allowance.value : bal);
          usdAtRisk = toHuman(exposed, decimals) * priceUsd;
        }
      } catch {
        balance = null;
      }

      return {
        kind,
        tokenAddress,
        spender,
        symbol,
        name,
        decimals,
        logo,
        allowanceRaw: rawAmount,
        allowanceDisplay: allowance.display,
        unlimited: allowance.unlimited,
        balance,
        usdAtRisk,
        revokeCalldata,
        revokeTarget,
        ...(expiration !== undefined ? { permit2Expiration: expiration } : {}),
      };
    };

    const enriched = await Promise.all([
      ...erc20.map(a => enrichFungible(
        'erc20', a.tokenAddress, a.spender, a.allowance, a.balanceRaw,
        buildRevokeCalldata(a.spender), a.tokenAddress,
      )),
      ...permit2.map(a => enrichFungible(
        'permit2', a.tokenAddress, a.spender, a.amount, a.balanceRaw,
        buildPermit2RevokeCalldata(a.tokenAddress, a.spender), PERMIT2_ADDRESS, a.expiration,
      )),
      ...nft.map(async (a) => ({
        kind: 'nft' as const,
        tokenAddress: a.collection,
        spender: a.operator,
        symbol: a.symbol ?? a.name ?? 'NFT',
        name: a.name ?? a.collection,
        decimals: 0,
        logo: a.logo,
        allowanceRaw: 'all',
        allowanceDisplay: 'All items',
        unlimited: true,
        balance: a.ownedCount,
        usdAtRisk: null as number | null,
        revokeCalldata: buildNftRevokeCalldata(a.operator),
        revokeTarget: a.collection,
        tokenType: a.tokenType,
        ownedCount: a.ownedCount,
        floorNative: a.floorNative,
      })),
    ]);

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
