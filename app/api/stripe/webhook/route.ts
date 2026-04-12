import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import {
  handleSubscriptionSuccess,
  handleSubscriptionCancellation,
} from '@/lib/stripe/subscriptions';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout completed');
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionSuccess(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancellation(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      console.log('💰 Payment succeeded');
      break;

    case 'invoice.payment_failed':
      console.log('❌ Payment failed');
      // TODO: Send email to user
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
