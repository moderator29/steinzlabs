import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { decodeSignature } from '@/lib/security/goplusService';

const schema = z.object({
  data: z.string().trim().min(1).max(10000),
  chain: z.string().trim().default('ethereum'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { data, chain } = parsed.data;

    // Validate it looks like hex data
    const clean = data.startsWith('0x') ? data : '0x' + data;
    if (!/^0x[0-9a-fA-F]+$/.test(clean)) {
      return NextResponse.json(
        { error: 'Invalid transaction data. Must be hexadecimal.' },
        { status: 400 }
      );
    }

    const result = await decodeSignature(clean, chain);

    return NextResponse.json({
      ...result,
      inputData: clean.slice(0, 10),
      chain,
      decodedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Signature insight error:', err);
    return NextResponse.json({ error: 'Decode failed. Please try again.' }, { status: 500 });
  }
}
