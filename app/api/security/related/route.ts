import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenSecurity } from '@/lib/services/goplus';
import { findSimilarTokens, type SimilarToken } from '@/lib/services/similarTokens';
import { addressesEqual } from '@/lib/utils/addressNormalize';

/**
 * Read-only companion data for the Contract Analyzer result view:
 *   - relatedWallets: creator + owner + top holders (real GoPlus data)
 *   - similarTokens:  other tokens sharing the ticker (real DexScreener data)
 *
 * Non-custodial, no writes. Never fabricates rows — unavailable data returns
 * an empty array so the UI can show an honest empty state.
 */

const schema = z.object({
  address: z.string().trim().min(1).max(100),
  chain: z.string().trim().default('ethereum'),
  symbol: z.string().trim().max(64).optional(),
});

export interface RelatedHolder {
  address: string;
  percent: number; // 0..1
  isContract: boolean;
  tag?: string;
}

export interface RelatedWalletsResponse {
  creatorAddress: string | null;
  ownerAddress: string | null;
  holders: RelatedHolder[];
  similarTokens: SimilarToken[];
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function cleanAddress(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  if (s.toLowerCase() === ZERO_ADDR) return null;
  return s;
}

/** Extract the top holders from the raw GoPlus token-security payload. */
function parseHolders(raw: unknown): RelatedHolder[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  // EVM payload uses `holders`; the Solana parser stashes them under `_holders`.
  const list = Array.isArray(r.holders)
    ? r.holders
    : Array.isArray(r._holders)
      ? r._holders
      : [];

  return (list as Array<Record<string, unknown>>)
    .map((h) => {
      const address = typeof h.address === 'string' ? h.address.trim() : '';
      const pctRaw = parseFloat(String(h.percent ?? '0'));
      const percent = Number.isFinite(pctRaw) ? pctRaw : 0;
      const isContract = h.is_contract === 1 || h.is_contract === '1' || h.is_contract === true;
      const tagRaw = typeof h.tag === 'string' ? h.tag.trim() : '';
      return { address, percent, isContract, tag: tagRaw || undefined };
    })
    .filter((h) => h.address)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { address, chain, symbol } = parsed.data;

    // Run both lookups concurrently; each fails soft to an empty result.
    const [securityRes, similarTokens] = await Promise.all([
      getTokenSecurity(address, chain).catch(() => null),
      findSimilarTokens(symbol ?? '', address).catch(() => [] as SimilarToken[]),
    ]);

    let creatorAddress: string | null = null;
    let ownerAddress: string | null = null;
    let holders: RelatedHolder[] = [];

    if (securityRes) {
      creatorAddress = cleanAddress(securityRes.creatorAddress);
      ownerAddress = cleanAddress(securityRes.ownerAddress);
      // Drop owner duplicate when it equals the creator (chain-aware compare).
      if (ownerAddress && creatorAddress && addressesEqual(ownerAddress, creatorAddress, chain)) {
        ownerAddress = null;
      }
      holders = parseHolders(securityRes.raw);
    }

    const response: RelatedWalletsResponse = {
      creatorAddress,
      ownerAddress,
      holders,
      similarTokens,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Failed to load related data.' }, { status: 500 });
  }
}
