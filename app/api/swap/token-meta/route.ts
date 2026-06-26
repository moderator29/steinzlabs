import { NextRequest, NextResponse } from 'next/server';
import { getTokenMetadata } from '@/lib/services/alchemy';

export const runtime = 'nodejs';

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
  try {
    const meta = await getTokenMetadata(address, chain);
    // Alchemy returns null fields for non-token addresses; decimals is the
    // critical one — bail if it's missing.
    if (!meta || typeof meta.decimals !== 'number') return null;
    return {
      symbol: (meta.symbol || address.slice(2, 6)).toUpperCase(),
      name: meta.name || meta.symbol || 'Unknown token',
      decimals: meta.decimals,
      logo: meta.logo ?? null,
      address: address.toLowerCase(),
      chain,
    };
  } catch {
    return null;
  }
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
