import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getNewEvmPairs } from '@/lib/services/geckoterminal';
import type { DexPair } from '@/lib/services/dexscreener';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoPlusResult {
  address: string;
  chain: string;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  liquidity: number;
  isOpenSource: boolean;
  isMintable: boolean;
  hasBlacklist: boolean;
  holderCount: number;
  top10HolderPercent: number;
  status: 'SAFE' | 'CAUTION' | 'RISKY' | 'BLOCKED';
  flags: string[];
}

export interface SniperToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  chain: string;
  liquidity: number;
  tax: number;
  honeypot: boolean;
  securityScore: number;
  detectedAt: number;
  status: 'scanning' | 'safe' | 'risky' | 'blocked' | 'sniped';
  price?: number;
  marketCap?: number;
  pairAge?: string;
  logo?: string;
  source?: string;
  volume24h?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Heuristic security score from pair data alone (no GoPlus). */
function scoreFromPair(pair: DexPair): number {
  const liq = pair.liquidity?.usd ?? 0;
  let score = 65;
  if (liq > 100_000) score += 20;
  else if (liq > 50_000) score += 12;
  else if (liq > 10_000) score += 5;
  else if (liq < 5_000) score -= 20;
  else if (liq < 1_000) score -= 40;

  // Penalise very new pairs (< 5 min old)
  const ageMs = Date.now() - (pair.pairCreatedAt ?? Date.now());
  if (ageMs < 5 * 60_000) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function statusFromScore(score: number): SniperToken['status'] {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'risky';
  return 'blocked';
}

function pairAgeLabel(pairCreatedAt?: number): string {
  if (!pairCreatedAt) return 'New';
  const mins = Math.round((Date.now() - pairCreatedAt) / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

// ─── GET Handler — New Token Feed ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Sniper Bot is a Max-tier feature (per the pricing page).
  const gate = await checkTierServer('max');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24'), 40);
  const chainFilter = searchParams.get('chain') || undefined;
  const minLiquidity = parseFloat(searchParams.get('minLiquidity') ?? '3000');
  const maxLiquidity = searchParams.get('maxLiquidity') ? parseFloat(searchParams.get('maxLiquidity')!) : undefined;
  // Comma-separated DEX/source filter (e.g. "uniswap_v3,aerodrome").
  const sources = (searchParams.get('source') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  try {
    // Real freshly-created EVM pools (GeckoTerminal). EVM-only for now.
    let pairs = await getNewEvmPairs(minLiquidity, chainFilter === 'all' ? undefined : chainFilter);
    if (maxLiquidity !== undefined) pairs = pairs.filter(p => (p.liquidity?.usd ?? 0) <= maxLiquidity);
    if (sources.length) pairs = pairs.filter(p => sources.some(s => p.dexId.toLowerCase().includes(s)));
    if (q) pairs = pairs.filter(p =>
      p.baseToken.symbol.toLowerCase().includes(q) ||
      p.baseToken.name.toLowerCase().includes(q) ||
      p.baseToken.address.toLowerCase() === q,
    );

    const tokens: SniperToken[] = pairs.slice(0, limit).map(pair => {
      const score = scoreFromPair(pair);
      return {
        id: pair.baseToken.address,
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        chain: pair.chainId,
        liquidity: pair.liquidity?.usd ?? 0,
        tax: 0,
        honeypot: false,
        securityScore: score,
        detectedAt: pair.pairCreatedAt ?? Date.now(),
        status: statusFromScore(score),
        price: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
        marketCap: pair.fdv,
        logo: pair.info?.imageUrl ?? undefined,
        pairAge: pairAgeLabel(pair.pairCreatedAt),
        source: pair.dexId,
        volume24h: pair.volume?.h24,
      };
    });

    // Distinct sources present (for the UI source filter chips).
    const availableSources = Array.from(new Set(pairs.map(p => p.dexId))).slice(0, 12);
    return NextResponse.json({ tokens, sources: availableSources });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tokens';
    return NextResponse.json({ error: msg, tokens: [] }, { status: 500 });
  }
}

// ─── POST Handler — Token Security Check ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const gate = await checkTierServer('max');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  try {
    const body = await request.json();
    const { address, chain } = body as { address: string; chain: string };

    if (!address || !chain) {
      return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    }

    try {
      const sec = await getTokenSecurity(address, chain);

      // Derive status from safetyLevel
      let status: GoPlusResult['status'] = 'SAFE';
      if (sec.isHoneypot || sec.safetyLevel === 'DANGER') status = 'BLOCKED';
      else if (sec.safetyLevel === 'WARNING') status = 'RISKY';
      else if (sec.safetyLevel === 'CAUTION') status = 'CAUTION';

      // Extract extra fields from raw GoPlus response where available
      const raw = sec.raw as Record<string, unknown> | undefined;
      const dexArr = Array.isArray(raw?.dex) ? (raw!.dex as Array<Record<string, unknown>>) : [];
      const liquidity = parseFloat(String(dexArr[0]?.liquidity ?? '0'));
      const holders = Array.isArray(raw?.holders) ? (raw!.holders as Array<Record<string, unknown>>) : [];
      const top10 = parseFloat(
        holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(String(h.percent ?? '0')), 0).toFixed(2)
      );

      const flags = sec.checks
        .filter(c => c.status === 'fail')
        .map(c => c.label);

      const result: GoPlusResult = {
        address,
        chain,
        isHoneypot: sec.isHoneypot,
        buyTax: parseFloat((sec.buyTax * 100).toFixed(1)),
        sellTax: parseFloat((sec.sellTax * 100).toFixed(1)),
        liquidity,
        isOpenSource: sec.isOpenSource,
        isMintable: sec.isMintable,
        hasBlacklist: !!(raw?.is_blacklisted === '1'),
        holderCount: sec.holderCount,
        top10HolderPercent: top10,
        status,
        flags,
      };

      return NextResponse.json(result);
    } catch {
      // Service layer unavailable — return neutral CAUTION result
      return NextResponse.json({
        address, chain,
        isHoneypot: false, buyTax: 0, sellTax: 0, liquidity: 0,
        isOpenSource: false, isMintable: false, hasBlacklist: false,
        holderCount: 0, top10HolderPercent: 0,
        status: 'CAUTION',
        flags: ['Security data unavailable'],
      } satisfies GoPlusResult);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
