import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAddressIntel } from '@/lib/services/arkham';

const addressSchema = z.string().trim().min(1).max(100);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    const data = await getAddressIntel(parsed.data);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch address intelligence' }, { status: 500 });
  }
}
