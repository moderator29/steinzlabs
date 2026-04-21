/**
 * Supabase Auth webhook → sends our Naka-branded welcome email via Resend
 * when a user's email is confirmed.
 *
 * Configure in Supabase:
 *   Dashboard → Database → Webhooks → Create webhook
 *     Name:   naka-welcome-email
 *     Table:  auth.users (or public.profiles — whichever you prefer)
 *     Events: UPDATE  (fires when email_confirmed_at transitions from NULL → timestamp)
 *     Type:   HTTP Request
 *     URL:    https://nakalabs.xyz/api/webhooks/supabase-auth
 *     HTTP Headers:
 *       x-supabase-webhook-secret: <pick a random string, set as env too>
 *
 * Set SUPABASE_WEBHOOK_SECRET in Vercel env to the same value.
 *
 * The webhook fires once per confirmation event; this route dedupes by
 * checking that email_confirmed_at was NULL in the OLD record and is
 * non-null in the NEW record (i.e. the actual confirmation transition,
 * not an unrelated profile field update).
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SupabaseAuthWebhookBody {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record?: {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
    raw_user_meta_data?: { first_name?: string; full_name?: string };
  };
  old_record?: {
    email_confirmed_at?: string | null;
  };
}

export async function POST(req: NextRequest) {
  // Verify webhook secret — Supabase supports a custom header you define.
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;
  const got = req.headers.get('x-supabase-webhook-secret') || req.headers.get('authorization');
  if (expected && got !== expected && got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SupabaseAuthWebhookBody;
  try {
    body = (await req.json()) as SupabaseAuthWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only act on UPDATE of auth.users where email_confirmed_at just transitioned
  // from NULL → timestamp. Everything else is noise we ignore with 200 OK so
  // Supabase doesn't retry.
  if (body.type !== 'UPDATE' || body.table !== 'users') {
    return NextResponse.json({ ok: true, skipped: 'not a user update' });
  }

  const wasConfirmed = !!body.old_record?.email_confirmed_at;
  const isConfirmed = !!body.record?.email_confirmed_at;
  if (wasConfirmed || !isConfirmed) {
    return NextResponse.json({ ok: true, skipped: 'not a confirmation transition' });
  }

  const email = body.record?.email;
  if (!email) {
    return NextResponse.json({ ok: true, skipped: 'no email on record' });
  }

  const firstName =
    body.record?.raw_user_meta_data?.first_name ||
    body.record?.raw_user_meta_data?.full_name?.split(' ')[0] ||
    email.split('@')[0];

  const sent = await sendWelcomeEmail(email, firstName);
  if (!sent) {
    // Don't 500 — Supabase will retry on non-2xx which would spam the
    // user. Log and return 200 with error field for debugging.
    console.error('[supabase-auth webhook] welcome send failed for', email);
    return NextResponse.json({ ok: true, sent: false, error: 'resend error' });
  }

  return NextResponse.json({ ok: true, sent: true, to: email });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    secretConfigured: !!process.env.SUPABASE_WEBHOOK_SECRET,
    hint: 'POST only. Configure in Supabase → Database → Webhooks on auth.users UPDATE.',
  });
}
