import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenHolders } from '@/lib/services/arkham';

const tokenSchema = z.string().trim().min(1).max(100);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const parsedToken = tokenSchema.safeParse(token);
    if (!parsedToken.success) return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    const limitParam = request.nextUrl.searchParams.get('limit') || '20';
    const limit = limitSchema.safeParse(limitParam).success ? limitSchema.parse(limitParam) : 20;
    const data = await getTokenHolders(parsedToken.data, limit);
    return NextResponse.json({ holders: data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch token holders' }, { status: 500 });
  }
}
