import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWalletReputation } from '@/lib/security/walletReputation';
import { addWalletProfile } from '@/lib/services/supabase';

const checkWalletSchema = z.object({
  walletAddress: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkWalletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { walletAddress } = parsed.data;

    const reputation = await getWalletReputation(walletAddress);

    // Log wallet check — non-critical, fire and forget
    addWalletProfile({ userId: walletAddress, address: walletAddress, chain: 'ethereum', label: reputation.reputation }).catch(() => {});

    return NextResponse.json(reputation);
  } catch (error) {

    return NextResponse.json(
      { error: 'Reputation check failed' },
      { status: 500 }
    );
  }
}
