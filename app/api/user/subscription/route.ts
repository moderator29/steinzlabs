import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription } from '@/lib/stripe/subscriptions';
import { getUserByWallet } from '@/lib/database/supabase';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet parameter required' },
        { status: 400 }
      );
    }

    const user = await getUserByWallet(wallet);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const subscription = await getUserSubscription(user.id);

    return NextResponse.json(subscription);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
