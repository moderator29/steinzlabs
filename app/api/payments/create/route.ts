import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  TIER_PRICE_USD,
  PAYMENT_WINDOW_MINUTES,
  PAYMENT_CHAINS,
  isPaymentChain,
  treasuryAddress,
  type PaidTier,
} from '@/lib/payments/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/payments/create { tier, chain }
// Creates a pending USDC payment for a tier and returns the pay-to address +
// the UNIQUE amount the user must send. The unique cents offset lets the
// verify cron match the incoming transfer to this exact payment without memos.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const treasury = treasuryAddress();
  if (!treasury) {
    return NextResponse.json(
      { error: 'Payments are not configured yet. Set TREASURY_EVM_ADDRESS.', code: 'NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  let body: { tier?: string; chain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tier = body.tier as PaidTier;
  const chain = String(body.chain || '');
  if (!tier || !(tier in TIER_PRICE_USD)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }
  if (!isPaymentChain(chain)) {
    return NextResponse.json({ error: 'Unsupported payment chain' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Reuse an existing still-open pending payment for the same (tier, chain)
  // so refreshing the modal doesn't mint a new amount every time.
  const { data: existing } = await admin
    .from('crypto_payments')
    .select('*')
    .eq('user_id', user.id)
    .eq('tier', tier)
    .eq('chain', chain)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const chainMeta = PAYMENT_CHAINS.find((c) => c.id === chain)!;

  if (existing) {
    return NextResponse.json({
      paymentId: existing.id,
      payTo: existing.pay_to_address,
      amount: Number(existing.expected_amount),
      token: 'USDC',
      tokenContract: chainMeta.usdc,
      chain,
      chainLabel: chainMeta.label,
      expiresAt: existing.expires_at,
    });
  }

  // Unique amount = base + a per-payment cents offset in [0.001, 0.0099] so no
  // two open payments collide. Deterministic-free is fine here; derive from a
  // random 3-digit tail (Date/Math.random unavailable in workflows only —
  // route handlers run in normal Node, so crypto.randomInt is available).
  const { randomInt } = await import('crypto');
  const offset = randomInt(1, 990) / 100000; // 0.00001 .. 0.0099
  const amount = Number((TIER_PRICE_USD[tier] + offset).toFixed(6));
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString();

  const { data, error } = await admin
    .from('crypto_payments')
    .insert({
      user_id: user.id,
      tier,
      chain,
      token: 'USDC',
      pay_to_address: treasury,
      expected_amount: amount,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not create payment' }, { status: 500 });
  }

  return NextResponse.json({
    paymentId: data.id,
    payTo: treasury,
    amount,
    token: 'USDC',
    tokenContract: chainMeta.usdc,
    chain,
    chainLabel: chainMeta.label,
    expiresAt,
  });
}
