import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWalletReputation } from '@/lib/security/walletReputation';
import { saveUser } from '@/lib/database/supabase';

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

    try {
      await saveUser({
        walletAddress,
        reputationScore: reputation.score,
        reputationStatus: reputation.reputation,
        isVerifiedEntity: reputation.verified,
        entityId: reputation.entity?.id,
        entityName: reputation.entity?.name,
        blocked: !reputation.allowAccess,
      });
    } catch (dbError) {

    }

    return NextResponse.json(reputation);
  } catch (error) {

    return NextResponse.json(
      { error: 'Reputation check failed' },
      { status: 500 }
    );
  }
}
