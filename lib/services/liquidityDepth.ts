import 'server-only';

// Liquidity-Cliff analysis — real DexScreener pool liquidity + a standard
// constant-product (x*y=k) slippage ESTIMATE. Everything is derived from live
// pool depth; the slippage figures are an explicit model estimate (labelled as
// such in the UI), never a fabricated quote. For an exact quote the swap still
// uses the 0x/Jupiter route.

interface DexPairLite {
  chainId?: string;
  dexId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  baseToken?: { address?: string; symbol?: string; name?: string };
  info?: { imageUrl?: string };
  url?: string;
}

export interface LiquidityDepth {
  token: string;
  chain: string | null;
  symbol: string | null;
  priceUsd: number | null;
  totalLiquidityUsd: number;
  deepestPool: { dex: string; liquidityUsd: number; url: string | null } | null;
  poolCount: number;
  // Estimated price impact (%) for each trade size (USD), constant-product model.
  impact: Array<{ sizeUsd: number; impactPct: number }>;
  // Largest trade (USD) that stays under a 1% slippage estimate on the deepest pool.
  safeSizeUsd: number | null;
  model: 'constant-product-estimate';
}

const SIZES = [100, 1_000, 5_000, 25_000, 100_000];

// Constant-product single-sided impact: buying S dollars against a pool whose
// per-side reserve ≈ liquidity/2 moves price by S / (reserve + S).
function impactPct(sizeUsd: number, liquidityUsd: number): number {
  const reserve = liquidityUsd / 2;
  if (reserve <= 0) return 100;
  return Math.min(100, (sizeUsd / (reserve + sizeUsd)) * 100);
}

export async function getLiquidityDepth(token: string, chain: string | null): Promise<LiquidityDepth | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(token)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { pairs?: DexPairLite[] };
    let pairs = Array.isArray(body.pairs) ? body.pairs : [];
    if (chain) {
      const onChain = pairs.filter((p) => p.chainId === chain);
      if (onChain.length) pairs = onChain;
    }
    if (pairs.length === 0) return null;

    const totalLiquidityUsd = pairs.reduce((s, p) => s + (Number(p.liquidity?.usd) || 0), 0);
    const deepest = pairs.slice().sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
    const deepestLiq = Number(deepest?.liquidity?.usd) || 0;

    const impact = SIZES.map((sizeUsd) => ({ sizeUsd, impactPct: Number(impactPct(sizeUsd, deepestLiq).toFixed(2)) }));

    // Solve S at 1% impact: S/(reserve+S)=0.01 → S = reserve*0.01/0.99.
    const reserve = deepestLiq / 2;
    const safeSizeUsd = reserve > 0 ? Math.round((reserve * 0.01) / 0.99) : null;

    return {
      token,
      chain: deepest?.chainId ?? chain,
      symbol: deepest?.baseToken?.symbol ?? null,
      priceUsd: deepest?.priceUsd ? Number(deepest.priceUsd) : null,
      totalLiquidityUsd,
      deepestPool: deepest ? { dex: deepest.dexId || 'dex', liquidityUsd: deepestLiq, url: deepest.url ?? null } : null,
      poolCount: pairs.length,
      impact,
      safeSizeUsd,
      model: 'constant-product-estimate',
    };
  } catch {
    return null;
  }
}
