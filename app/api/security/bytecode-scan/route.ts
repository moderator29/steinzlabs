import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { scanBytecode } from '@/lib/security/bytecodeSimilarity';

/**
 * GET /api/security/bytecode-scan?chain=ethereum&address=0x...
 *
 * Returns BytecodeScanResult. Matches against rug_contract_signatures.
 * Tier-1 (exact hash) is authoritative-block; tier-2 (Jaccard ≥ 0.85)
 * lands once the signatures table grows a denormalized shingle bitmap
 * — schema extension noted in lib/security/bytecodeSimilarity.ts.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get('chain')?.trim();
  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!chain || !address) {
    return NextResponse.json({ error: 'chain and address required' }, { status: 400 });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'address must be 0x-prefixed 40-hex' }, { status: 400 });
  }
  const result = await scanBytecode(chain, address);
  return NextResponse.json(result);
}
