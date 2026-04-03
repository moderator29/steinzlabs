import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByWallet, getUserThreats } from '@/lib/database/supabase';

const walletSchema = z.string().trim().min(1).max(100);

export async function GET(request: NextRequest) {
  try {
    const walletParam = request.nextUrl.searchParams.get('wallet');
    const parsed = walletSchema.safeParse(walletParam);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid wallet parameter is required' },
        { status: 400 }
      );
    }

    const walletAddress = parsed.data;

    const user = await getUserByWallet(walletAddress);
    if (!user) {
      return NextResponse.json({ threats: [] });
    }

    const threats = await getUserThreats(user.id);

    return NextResponse.json({ threats });
  } catch (error) {
    console.error('Failed to fetch threats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threats' },
      { status: 500 }
    );
  }
}
