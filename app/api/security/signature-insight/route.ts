import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSignatureDecode } from '@/lib/services/goplus';
import { decodeCalldataWithRegistries } from '@/lib/security/calldataDecode';
import { parseTypedDataInput, decodeTypedData } from '@/lib/security/typedDataDecode';
import { simulateAssetChangesRpc } from '@/lib/services/alchemy';
import { isEvmAddress } from '@/lib/utils/addressNormalize';

const schema = z.object({
  data: z.string().trim().min(1).max(20000),
  chain: z.string().trim().default('ethereum'),
  // Optional context for the pre-sign asset-diff simulation (calldata mode only).
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  value: z.string().trim().optional(),
});

/** A GoPlus decode counts as a real hit only when it named the function. */
function goplusHit(r: { functionName?: string }): boolean {
  const n = (r.functionName || '').toLowerCase();
  return !!n && n !== 'unknown function' && n !== 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { data, chain, from, to, value } = parsed.data;
    const decodedAt = new Date().toISOString();

    // ── Mode 1: EIP-712 typed data (gas-less signature) ──────────────────────
    const typed = parseTypedDataInput(data);
    if (typed) {
      const result = decodeTypedData(typed);
      return NextResponse.json({ ...result, chain, decodedAt });
    }

    // ── Mode 2: raw calldata ─────────────────────────────────────────────────
    const clean = data.startsWith('0x') ? data : '0x' + data;
    if (!/^0x[0-9a-fA-F]*$/.test(clean) || clean.length < 10) {
      return NextResponse.json(
        {
          error:
            'Could not recognize input. Paste either EVM calldata (0x + at least a 4-byte selector) or an EIP-712 typed-data JSON object.',
        },
        { status: 400 }
      );
    }

    // Primary: GoPlus ABI decode. Fallback: 4byte.directory / OpenChain + viem.
    let decoded;
    try {
      const goplus = await getSignatureDecode(clean, chain);
      if (goplusHit(goplus)) {
        decoded = {
          ...goplus,
          mode: 'calldata' as const,
          selector: clean.slice(0, 10).toLowerCase(),
          source: 'GoPlus',
        };
      }
    } catch {
      // fall through to registry decode
    }
    if (!decoded) {
      decoded = await decodeCalldataWithRegistries(clean);
    }

    // ── Bonus: pre-sign asset-diff simulation (only with from/to context) ────
    let assetDiff: unknown = { available: false, reason: 'No wallet context provided' };
    const simFrom = from && isEvmAddress(from) ? from : null;
    const simTo = to && isEvmAddress(to) ? to : null;
    if (simFrom && simTo) {
      assetDiff = await simulateAssetChangesRpc(chain, {
        from: simFrom,
        to: simTo,
        data: clean,
        value,
      });
    }

    return NextResponse.json({
      ...decoded,
      inputData: clean.slice(0, 10),
      chain,
      decodedAt,
      assetDiff,
    });
  } catch {
    return NextResponse.json({ error: 'Decode failed. Please try again.' }, { status: 500 });
  }
}
