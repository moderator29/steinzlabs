import { NextRequest, NextResponse } from 'next/server';
import { getTokenMetadata } from '@/lib/services/alchemy';
import { getTokenPairs } from '@/lib/services/dexscreener';
import { getEvmTokenDecimals } from '@/lib/sniper/priceFeed';

export const runtime = 'nodejs';

// DexScreener chainId → our canonical chain id. Lets a pasted contract resolve
// on whatever chain it actually trades on (e.g. an ETH-mainnet token while the
// UI defaulted to another chain).
const DEX_TO_CHAIN: Record<string, string> = {
  ethereum: 'ethereum', bsc: 'bsc', base: 'base', arbitrum: 'arbitrum',
  optimism: 'optimism', polygon: 'polygon', avalanche: 'avalanche',
};

/**
 * GET /api/swap/token-meta?chain=<chain>&address=<contract|mint>
 *
 * Resolves real on-chain metadata for an ARBITRARY token so the swap UI can
 * let users import + swap memecoins by pasting a contract address. Returns
 * { symbol, name, decimals, logo, address }. Decimals come from an
 * authoritative source (Alchemy for EVM, Jupiter token list for Solana) —
 * never guessed — because a wrong decimals value corrupts the swap amount.
 *
 * Returns 404 when the token can't be resolved (the UI then refuses to import
 * rather than fabricate metadata — no-mock rule).
 */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface TokenMetaResponse {
  symbol: string;
  name: string;
  decimals: number;
  logo: string | null;
  address: string;
  chain: string;
}

async function resolveSolana(mint: string): Promise<TokenMetaResponse | null> {
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const t = await res.json();
    if (!t || typeof t.decimals !== 'number') return null;
    return {
      symbol: (t.symbol || mint.slice(0, 4)).toUpperCase(),
      name: t.name || t.symbol || 'Unknown token',
      decimals: t.decimals,
      logo: t.logoURI ?? null,
      address: mint,
      chain: 'solana',
    };
  } catch {
    return null;
  }
}

async function resolveEvm(address: string, chain: string): Promise<TokenMetaResponse | null> {
  // Resolve from MULTIPLE sources so any token listed on a DEX (or known to
  // Alchemy) imports — not just Alchemy-indexed ones:
  //  1. Alchemy metadata (authoritative symbol/name/decimals/logo when present)
  //  2. DexScreener pairs (symbol/name/logo + the REAL chain it trades on)
  //  3. On-chain eth_call for decimals when Alchemy didn't have it
  const [alchemy, pairs] = await Promise.all([
    getTokenMetadata(address, chain).catch(() => null),
    getTokenPairs(address).catch(() => []),
  ]);

  // Prefer a pair on the requested chain; otherwise the highest-liquidity pair
  // anywhere (the token may live on mainnet while the UI defaulted elsewhere).
  const onChain = pairs.filter((p) => p.chainId === chain);
  const best = (onChain.length ? onChain : pairs)
    .slice()
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

  // Require at least one real source — never fabricate metadata for an
  // arbitrary/non-token address (no-mock rule).
  const hasAlchemy = !!(alchemy && typeof alchemy.decimals === 'number');
  if (!hasAlchemy && !best) return null;

  const resolvedChain = best?.chainId && DEX_TO_CHAIN[best.chainId] ? DEX_TO_CHAIN[best.chainId] : chain;
  const decimals = hasAlchemy
    ? alchemy!.decimals as number
    : await getEvmTokenDecimals(resolvedChain, address);

  const symbol = (alchemy?.symbol || best?.baseToken?.symbol || address.slice(2, 6)).toUpperCase();
  const name = alchemy?.name || best?.baseToken?.name || symbol;
  const logo = alchemy?.logo || best?.info?.imageUrl || null;

  return { symbol, name, decimals, logo, address: address.toLowerCase(), chain: resolvedChain };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
  const address = (searchParams.get('address') || '').trim();
  if (!address) {
    return NextResponse.json({ error: 'missing_address' }, { status: 400 });
  }

  let meta: TokenMetaResponse | null = null;
  if (chain === 'solana') {
    if (!SOLANA_ADDRESS_RE.test(address)) {
      return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    meta = await resolveSolana(address);
  } else {
    if (!EVM_ADDRESS_RE.test(address)) {
      return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    meta = await resolveEvm(address, chain);
  }

  if (!meta) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Cache resolved metadata at the edge for a day — token metadata is static.
  return NextResponse.json(meta, {
    headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  });
}
