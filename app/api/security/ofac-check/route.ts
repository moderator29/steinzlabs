import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkOfac } from '@/lib/security/ofac';

/**
 * GET /api/security/ofac-check?address=0x...
 *
 * Returns { address, sanctioned, identifications, source }. The relayer +
 * swap-execute paths consult this before broadcasting any user-bound or
 * counterparty transfer.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  }
  // Light syntactic guard: EVM = 0x + 40 hex; Solana = 32-44 base58. Don't
  // be strict — just refuse obvious junk so we don't hammer the upstream.
  if (address.length < 26 || address.length > 64) {
    return NextResponse.json({ error: 'address looks malformed' }, { status: 400 });
  }
  const result = await checkOfac(address);
  return NextResponse.json(result);
}
