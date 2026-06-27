import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';
import { getTokenSecurity } from '@/lib/services/goplus';
import { getTokenPairs, searchPairs, type DexPair } from '@/lib/services/dexscreener';

/**
 * GET /api/sniper/token-detail?chain=&address=&symbol=
 *
 * One call that powers the Sniper token drawer with REAL data:
 *  - security  → Shadow Guardian scan (checks, taxes, score) + top holders
 *                (related wallets) from the underlying provider's holder list
 *  - market    → best live pair (price, liquidity, MC, volume, 24h change)
 *  - similar   → other tokens matching the symbol/name (Dexscreener search),
 *                deduped, self excluded, ranked by liquidity
 *
 * No mock data — every section degrades to empty/null when a source is down.
 */

export interface RelatedWallet {
  address: string;
  percent: number;
  tag: string | null;
  isContract: boolean;
  isLocked: boolean;
}

export interface SimilarToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  priceUsd: number | null;
  liquidity: number;
  marketCap: number | null;
  logo: string | null;
  url: string;
}

function mapHolders(raw: unknown): RelatedWallet[] {
  const r = raw as Record<string, unknown> | undefined;
  const holders = Array.isArray(r?.holders) ? (r!.holders as Array<Record<string, unknown>>) : [];
  return holders.slice(0, 10).map((h) => ({
    address: String(h.address ?? ''),
    // GoPlus returns percent as a 0..1 fraction; surface it as a real percent
    // (matches creatorHoldingPct below — was rendering 5.23% as 0.05%).
    percent: (parseFloat(String(h.percent ?? '0')) || 0) * 100,
    tag: h.tag ? String(h.tag) : null,
    isContract: h.is_contract === 1 || h.is_contract === '1',
    isLocked: h.is_locked === 1 || h.is_locked === '1',
  })).filter((h) => h.address);
}

function mapSimilar(pairs: DexPair[], selfAddr: string, chain: string): SimilarToken[] {
  const self = selfAddr.toLowerCase();
  const seen = new Set<string>([self]);
  const out: SimilarToken[] = [];
  // Prefer same chain first, then anything else.
  const ordered = [...pairs].sort((a, b) => {
    const ac = a.chainId === chain ? 0 : 1;
    const bc = b.chainId === chain ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
  });
  for (const p of ordered) {
    const addr = p.baseToken.address.toLowerCase();
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push({
      address: p.baseToken.address,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      chain: p.chainId,
      priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : null,
      liquidity: p.liquidity?.usd ?? 0,
      marketCap: p.marketCap ?? p.fdv ?? null,
      logo: p.info?.imageUrl ?? null,
      url: p.url,
    });
    if (out.length >= 6) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const gate = await checkTierServer('max');
  if (!gate.allowed) {
    return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  const chain = (searchParams.get('chain') || '').trim();
  const symbol = (searchParams.get('symbol') || '').trim();
  if (!address || !chain) {
    return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
  }

  // Run the sources concurrently; each is independently fault-tolerant.
  const [sec, tokenPairs, searchRes] = await Promise.all([
    getTokenSecurity(address, chain).catch(() => null),
    getTokenPairs(address).catch(() => [] as DexPair[]),
    symbol ? searchPairs(symbol).catch(() => [] as DexPair[]) : Promise.resolve([] as DexPair[]),
  ]);
  // Pick the highest-liquidity pair ON THE REQUESTED CHAIN (getBestPair ignored
  // chain and could return a same-symbol token's pool on a different network).
  const onChain = tokenPairs.filter((p) => p.chainId === chain);
  const bestPair = (onChain.length ? onChain : tokenPairs)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;

  const security = sec
    ? {
        score: sec.trustScore,
        level: sec.safetyLevel,
        honeypot: sec.isHoneypot,
        buyTax: parseFloat((sec.buyTax * 100).toFixed(1)),
        sellTax: parseFloat((sec.sellTax * 100).toFixed(1)),
        verified: sec.isOpenSource,
        mintable: sec.isMintable,
        holderCount: sec.holderCount,
        checks: sec.checks,
        creatorAddress: sec.creatorAddress,
        creatorHoldingPct: parseFloat((sec.creatorHoldingPct * 100).toFixed(2)),
        relatedWallets: mapHolders(sec.raw),
      }
    : null;

  const market = bestPair
    ? {
        priceUsd: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null,
        liquidity: bestPair.liquidity?.usd ?? 0,
        marketCap: bestPair.marketCap ?? bestPair.fdv ?? null,
        volume24h: bestPair.volume?.h24 ?? 0,
        priceChange24h: bestPair.priceChange?.h24 ?? 0,
        priceChange1h: bestPair.priceChange?.h1 ?? 0,
        pairCreatedAt: bestPair.pairCreatedAt ?? null,
        dexId: bestPair.dexId,
        url: bestPair.url,
        websites: bestPair.info?.websites ?? [],
        socials: bestPair.info?.socials ?? [],
        logo: bestPair.info?.imageUrl ?? null,
      }
    : null;

  const similar = mapSimilar(searchRes, address, chain);

  return NextResponse.json({ security, market, similar });
}
