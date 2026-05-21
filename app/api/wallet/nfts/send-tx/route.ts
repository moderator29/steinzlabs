import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { buildErc721TransferFrom, buildErc1155SafeTransferFrom } from '@/lib/trading/nft';

/**
 * §3 P2-D.6 — NFT send-tx calldata builder.
 *
 * Listing is handled by the existing /api/wallet/nfts route (already
 * shipped); this companion path returns the unsigned transaction body
 * the wallet UI signs + broadcasts.
 *
 * POST body { kind:'erc721'|'erc1155', contract, from, to, token_id, amount? }
 *   → { tx: { to, data, value } }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  kind?: 'erc721' | 'erc1155';
  contract?: string;
  from?: string;
  to?: string;
  token_id?: string;
  amount?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as SendBody;
  const { kind, contract, from, to, token_id } = body;
  if (!kind || !contract || !from || !to || !token_id) {
    return NextResponse.json({ error: 'kind, contract, from, to, token_id required' }, { status: 400 });
  }
  if (kind !== 'erc721' && kind !== 'erc1155') {
    return NextResponse.json({ error: 'kind must be erc721 | erc1155' }, { status: 400 });
  }
  for (const a of [contract, from, to]) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
      return NextResponse.json({ error: 'addresses must be EVM format' }, { status: 400 });
    }
  }
  const tx = kind === 'erc721'
    ? buildErc721TransferFrom(contract, from, to, token_id)
    : buildErc1155SafeTransferFrom(contract, from, to, token_id, body.amount ?? '1');
  return NextResponse.json({ tx });
}
