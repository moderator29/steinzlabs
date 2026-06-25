import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/user/max-welcomed
 *
 * Marks the first-time Max welcome as seen so the gold welcome banners never
 * show again (industry-standard: once ever, not on every login). Idempotent —
 * only stamps when currently NULL, so it never overwrites the original time.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('profiles')
    .update({ max_welcomed_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('max_welcomed_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
