import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  estimateUserOp,
  sendUserOp,
  getUserOpReceipt,
  getPaymasterSponsorship,
  isPimlicoConfigured,
  ENTRY_POINT_V07,
} from '@/lib/aa/pimlico';

/**
 * §3 P2-D.4 — ERC-4337 user-op endpoint via Pimlico.
 *
 * POST body { action, chain, user_op?, hash? }
 *   action='estimate'    → gas estimate
 *   action='sponsor'     → paymaster sponsorship (returns paymasterAndData)
 *   action='send'        → submit; returns userOpHash
 *   action='receipt'     → look up receipt by hash
 *
 * EntryPoint is hardcoded to v0.7 (single canonical address across all
 * EVM chains Pimlico supports).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isPimlicoConfigured()) {
    return NextResponse.json({ error: 'ERC-4337 not configured (PIMLICO_API_KEY missing)' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as {
    action?: string; chain?: string; user_op?: Record<string, unknown>; hash?: string;
  };
  const { action, chain } = body;
  if (!action || !chain) return NextResponse.json({ error: 'action + chain required' }, { status: 400 });

  switch (action) {
    case 'estimate': {
      if (!body.user_op) return NextResponse.json({ error: 'user_op required' }, { status: 400 });
      const r = await estimateUserOp(chain, body.user_op, ENTRY_POINT_V07);
      return NextResponse.json({ estimate: r });
    }
    case 'sponsor': {
      if (!body.user_op) return NextResponse.json({ error: 'user_op required' }, { status: 400 });
      const r = await getPaymasterSponsorship(chain, body.user_op, ENTRY_POINT_V07);
      return NextResponse.json({ sponsorship: r });
    }
    case 'send': {
      if (!body.user_op) return NextResponse.json({ error: 'user_op required' }, { status: 400 });
      const hash = await sendUserOp(chain, body.user_op as unknown as Parameters<typeof sendUserOp>[1], ENTRY_POINT_V07);
      if (!hash) return NextResponse.json({ error: 'submit failed' }, { status: 502 });
      return NextResponse.json({ user_op_hash: hash });
    }
    case 'receipt': {
      if (!body.hash) return NextResponse.json({ error: 'hash required' }, { status: 400 });
      const r = await getUserOpReceipt(chain, body.hash);
      return NextResponse.json({ receipt: r });
    }
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
