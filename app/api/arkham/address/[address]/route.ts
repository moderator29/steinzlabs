import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { arkhamAPI } from '@/lib/arkham/api';

const addressSchema = z.string().trim().min(1).max(100);
const chainSchema = z.string().trim().min(1).max(50).optional();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const parsedAddress = addressSchema.safeParse(address);

    if (!parsedAddress.success) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const chainParam = request.nextUrl.searchParams.get('chain') || undefined;
    if (chainParam) {
      const parsedChain = chainSchema.safeParse(chainParam);
      if (!parsedChain.success) {
        return NextResponse.json({ error: 'Invalid chain' }, { status: 400 });
      }
    }

    const data = await arkhamAPI.getAddressIntel(parsedAddress.data, chainParam);

    return NextResponse.json(data);
  } catch (error) {

    return NextResponse.json(
      { error: 'Failed to fetch address intelligence' },
      { status: 500 }
    );
  }
}
