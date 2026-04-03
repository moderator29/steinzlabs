import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { arkhamAPI } from '@/lib/arkham/api';

const tokenSchema = z.string().trim().min(1).max(100);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const parsedToken = tokenSchema.safeParse(token);

    if (!parsedToken.success) {
      return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    }

    const limitParam = request.nextUrl.searchParams.get('limit') || '20';
    const parsedLimit = limitSchema.safeParse(limitParam);
    const limit = parsedLimit.success ? parsedLimit.data : 20;

    const chain = request.nextUrl.searchParams.get('chain') || undefined;

    const data = await arkhamAPI.getTokenHolders(parsedToken.data, limit, chain);

    return NextResponse.json({ holders: data });
  } catch (error) {
    console.error('Arkham holders fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token holders' },
      { status: 500 }
    );
  }
}
