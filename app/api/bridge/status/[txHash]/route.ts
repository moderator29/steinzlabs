import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getLifiStatus } from '@/lib/services/lifi';

/**
 * GET /api/bridge/status/{txHash}?bridge=stargate&fromChain=1&toChain=8453
 *
 * Thin pass-through to LiFi's status endpoint. The frontend polls this
 * every 10s until status is DONE or FAILED.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ txHash: string }> }) {
  const { txHash } = await params;
  if (!txHash) return NextResponse.json({ error: 'txHash required' }, { status: 400 });

  const url = new URL(_req.url);
  const bridge = url.searchParams.get('bridge') ?? undefined;
  const fromChain = url.searchParams.get('fromChain') ?? undefined;
  const toChain = url.searchParams.get('toChain') ?? undefined;

  const status = await getLifiStatus(txHash, bridge, fromChain, toChain);
  if (!status) return NextResponse.json({ error: 'No status' }, { status: 502 });
  return NextResponse.json(status);
}
