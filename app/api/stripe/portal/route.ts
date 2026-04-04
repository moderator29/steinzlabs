import { NextRequest, NextResponse } from 'next/server';
import { createPortalSession } from '@/lib/stripe/subscriptions';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const url = await createPortalSession(customerId, `${baseUrl}/dashboard`);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create portal session' }, { status: 500 });
  }
}
