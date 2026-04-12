import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe/subscriptions';
import { getUserByWallet } from '@/lib/database/supabase';

export async function POST(request: NextRequest) {
  try {
    const { wallet, tier, interval } = await request.json();

    if (!wallet || !tier || !interval) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user
    const user = await getUserByWallet(wallet);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create checkout session
    const checkoutUrl = await createCheckoutSession({
      userId: user.id,
      tier,
      interval,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?subscription=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing?subscription=canceled`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    console.error('Checkout creation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
