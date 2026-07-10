import { NextRequest, NextResponse } from 'next/server';
import { guardRoute } from '@/lib/api/guardRoute';
import { resolveReceiveAddress } from '@/lib/wire/resolveReceiveAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resolve a recipient's receive address for a chain so the Gift sheet can
// show where funds will land (and send there). Read-only; auth-gated so we
// don't expose an open address-lookup for arbitrary user ids.
const GIFT_CHAINS = new Set(['ethereum', 'base', 'bsc', 'robinhood', 'solana']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'low' });
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const recipientId = (searchParams.get('recipientId') ?? '').trim();
  const chain = (searchParams.get('chain') ?? '').toLowerCase();

  if (!UUID_RE.test(recipientId)) return NextResponse.json({ error: 'Invalid recipientId' }, { status: 400 });
  if (!GIFT_CHAINS.has(chain)) return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });

  const address = await resolveReceiveAddress(recipientId, chain);
  return NextResponse.json({ address });
}
