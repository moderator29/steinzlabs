import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';
import { getTokenSecurity } from '@/lib/services/goplus';

/**
 * GET /api/sniper/audit?chain=<chain>&address=<token>
 *
 * Shadow Guardian — compact per-token security audit for the Sniper feed.
 * Reuses the cached single-address `getTokenSecurity` (L1 memory + L2 Redis,
 * 60s TTL) so the feed can lazily badge tokens without hammering the upstream
 * scanner. Branded as "Shadow Guardian" / "Security Scanner" in the UI — the
 * underlying provider (GoPlus) is never surfaced (CLAUDE.md).
 *
 * The heavy pre-snipe gate lives in the execution path (isHighRisk). This is
 * the lightweight display layer for the discovery feed.
 */

export interface SniperAudit {
  address: string;
  chain: string;
  /** 0..100 composite trust score. */
  score: number;
  level: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  honeypot: boolean;
  /** Buy/sell tax as whole-number percentages (e.g. 5 = 5%). */
  buyTax: number;
  sellTax: number;
  mintable: boolean;
  verified: boolean;
  /** Fraction of LP that is locked/burned (0..1); null when unknown. */
  lpLockedPct: number | null;
  /** True when execution MUST be blocked (honeypot / can't sell / etc.). */
  blocked: boolean;
  /** Short human-readable risk flags for badges (failed checks). */
  flags: string[];
}

/** Derive locked-LP share from GoPlus lp_holders (is_locked + percent). */
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
    // Burn addresses count as permanently locked liquidity.
    const isBurn = addr === '0x000000000000000000000000000000000000dead' ||
      addr === '0x0000000000000000000000000000000000000000';
    if (isLocked || isBurn) locked += pct;
  }
  return sawPct ? Math.min(1, locked) : null;
}

export async function GET(request: NextRequest) {
  const gate = await checkTierServer('max');
  if (!gate.allowed) {
    return NextResponse.json(
      { error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  const chain = (searchParams.get('chain') || '').trim();
  if (!address || !chain) {
    return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
  }

  try {
    const sec = await getTokenSecurity(address, chain);

    const blocked =
      sec.isHoneypot ||
      sec.cannotBuy ||
      sec.cannotSellAll ||
      sec.selfDestruct ||
      sec.canTakeBackOwnership ||
      sec.ownerCanChangeBalance ||
      sec.hasHiddenOwner ||
      (sec.sellTax ?? 0) > 0.30;

    const flags = sec.checks.filter((c) => c.status === 'fail').map((c) => c.label).slice(0, 4);

    const audit: SniperAudit = {
      address,
      chain,
      score: sec.trustScore,
      level: sec.safetyLevel,
      honeypot: sec.isHoneypot,
      buyTax: parseFloat((sec.buyTax * 100).toFixed(1)),
      sellTax: parseFloat((sec.sellTax * 100).toFixed(1)),
      mintable: sec.isMintable,
      verified: sec.isOpenSource,
      lpLockedPct: deriveLpLocked(sec.lpHolders),
      blocked,
      flags,
    };
    return NextResponse.json(audit);
  } catch {
    // Scanner unavailable — return a neutral "unknown" audit (never a false SAFE).
    return NextResponse.json({
      address, chain, score: 0, level: 'CAUTION',
      honeypot: false, buyTax: 0, sellTax: 0, mintable: false, verified: false,
      lpLockedPct: null, blocked: false, flags: ['Security data unavailable'],
    } satisfies SniperAudit);
  }
}
