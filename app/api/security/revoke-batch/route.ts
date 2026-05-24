import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardRoute } from '@/lib/api/guardRoute';

/**
 * NW5: builds a Permit2 multi-revoke calldata bundle. The client signs
 * + broadcasts; the server never touches keys. Server's job is to:
 *
 *   1) Validate each token/spender pair (EVM addresses, no duplicates).
 *   2) Encode the Permit2 lockdown() multicall against the canonical
 *      Permit2 contract: 0x000000000022D473030F116dDEE9F6B43aC78BA3
 *      (deployed at the same address on every EVM chain we support).
 *
 * Frontend then submits the returned `to + data + value` via the
 * user's connected wallet. One signature, N approvals revoked.
 *
 * Permit2 ABI for lockdown:
 *   function lockdown((address token, address spender)[] approvals) external
 */

export const runtime = 'nodejs';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

const BodySchema = z.object({
  chain: z.enum(['ethereum', 'base', 'arbitrum', 'polygon', 'optimism', 'bsc']),
  approvals: z.array(z.object({
    token: z.string().regex(EVM_RE, 'token must be a 0x EVM address'),
    spender: z.string().regex(EVM_RE, 'spender must be a 0x EVM address'),
  })).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'med' });
  if (!guard.ok) return guard.response;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }

  // De-dupe (token, spender) tuples — a duplicate revoke is wasted gas
  // and the lockdown() ABI doesn't reject duplicates itself.
  const seen = new Set<string>();
  const approvals = parsed.data.approvals.filter((a) => {
    const k = `${a.token.toLowerCase()}|${a.spender.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let calldata: string;
  try {
    const { Interface } = await import('ethers');
    const iface = new Interface([
      'function lockdown(tuple(address token, address spender)[] approvals) external',
    ]);
    calldata = iface.encodeFunctionData('lockdown', [
      approvals.map((a) => [a.token, a.spender]),
    ]);
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to encode lockdown calldata',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  return NextResponse.json({
    chain: parsed.data.chain,
    to: PERMIT2_ADDRESS,
    data: calldata,
    value: '0x0',
    approvalCount: approvals.length,
  });
}
