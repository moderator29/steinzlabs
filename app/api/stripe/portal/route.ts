import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createPortalSession } from '@/lib/stripe/subscriptions';
import { getUserByWallet } from '@/lib/database/supabase';

export async function POST(request: NextRequest) {
  try {
    const { wallet } = await request.json();

    const user = await getUserByWallet(wallet);
    if (!user || !(user as any).stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const portalUrl = await createPortalSession(
      (user as any).stripe_customer_id,
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
