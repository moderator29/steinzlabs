import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/payments/status?id=<paymentId> — poll a payment's status. Scoped to
// the authenticated owner so a user can only read their own payment.
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('crypto_payments')
    .select('id, tier, chain, status, expected_amount, tx_hash, expires_at, confirmed_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    tier: data.tier,
    chain: data.chain,
    status: data.status,
    amount: Number(data.expected_amount),
    txHash: data.tx_hash,
    expiresAt: data.expires_at,
    confirmedAt: data.confirmed_at,
  });
}
