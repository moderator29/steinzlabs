import 'server-only';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the current active VAPID public key + its version. The client
 * subscribes against this; the server records which version each
 * subscription was made under so rotations can use the matching private key
 * during the grace window.
 *
 * Falls back to NEXT_PUBLIC_VAPID_PUBLIC_KEY so deploys that haven't seeded
 * the vapid_keys table yet keep working.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('vapid_keys')
      .select('version, public_key')
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return NextResponse.json({ version: data.version, public_key: data.public_key });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'push/vapid-public-key' } });
  }
  const fallback = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  return NextResponse.json({ version: null, public_key: fallback });
}
