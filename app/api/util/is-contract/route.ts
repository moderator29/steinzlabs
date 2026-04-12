import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getContractCode } from '@/lib/services/alchemy';

/**
 * Contract Detection Endpoint
 * GET /api/util/is-contract?address=0x...
 *
 * Returns { isContract: boolean }.
 * Uses Alchemy getContractCode for supported EVM chains.
 * Only EVM addresses (0x...) can be contracts; Solana addresses return false.
 */

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  }

  // Solana addresses are never EVM contracts
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ isContract: false });
  }

  try {
    const code = await getContractCode(address, 'ethereum');
    const isContract = code !== '0x' && code !== '0x0' && code.length > 2;
    return NextResponse.json({ isContract }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    // If Alchemy can't check (unsupported chain etc.) return false — callers handle gracefully
    return NextResponse.json({ isContract: false });
  }
}
