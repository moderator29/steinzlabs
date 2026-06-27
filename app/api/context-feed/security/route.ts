import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenSecurity } from '@/lib/services/goplus';

export const runtime = 'nodejs';

/**
 * GET /api/context-feed/security?chain=<chain>&address=<token>
 *
 * Public, lightweight token-safety read for View Proof: liquidity-lock share,
 * holder count, top-holder concentration, honeypot + buy/sell tax, and an
 * overall safety level. Unlike the Sniper audit (max-tier) this is NOT gated —
 * everyone should see safety info before they buy. Branded "Shadow Guardian";
 * never surfaces the underlying provider. Real data only (no false SAFE).
 */

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function deriveLpLocked(lpHolders: unknown): number | null {
  if (!Array.isArray(lpHolders) || lpHolders.length === 0) return null;
  let locked = 0;
  let sawPct = false;
  for (const h of lpHolders as Array<Record<string, unknown>>) {
    const pct = parseFloat(String(h.percent ?? '0'));
    if (!Number.isFinite(pct)) continue;
    sawPct = true;
    const isLocked = h.is_locked === 1 || h.is_locked === '1';
    const addr = String(h.address ?? '').toLowerCase();
    const isBurn = addr === '0x000000000000000000000000000000000000dead' || addr === '0x0000000000000000000000000000000000000000';
    if (isLocked || isBurn) locked += pct;
  }
  return sawPct ? Math.min(1, locked) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get('address') || '').trim();
  const chain = (searchParams.get('chain') || '').trim().toLowerCase();
  if (!address || !chain) return NextResponse.json({ error: 'address and chain required' }, { status: 400 });
  const valid = chain === 'solana' ? SOL_RE.test(address) : EVM_RE.test(address);
  if (!valid) return NextResponse.json({ error: 'invalid address' }, { status: 400 });

  try {
    const sec = await getTokenSecurity(address, chain);
    return NextResponse.json({
      score: sec.trustScore,
      level: sec.safetyLevel,
      honeypot: sec.isHoneypot,
      buyTax: parseFloat(((sec.buyTax ?? 0) * 100).toFixed(1)),
      sellTax: parseFloat(((sec.sellTax ?? 0) * 100).toFixed(1)),
      mintable: sec.isMintable,
      verified: sec.isOpenSource,
      holderCount: sec.holderCount ?? null,
      topHolderPct: sec.creatorHoldingPct != null ? parseFloat((sec.creatorHoldingPct * 100).toFixed(1)) : null,
      lpLockedPct: deriveLpLocked(sec.lpHolders),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
