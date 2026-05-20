import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/feature-usage/log
 *
 * Tiny instrumentation endpoint so the nightly reputation scorer's
 * activity_score component has data to read. Records a single
 * (user_id, feature_name) event with optional action + metadata.
 * Anonymous calls (no session) are silently no-ops so we don't
 * pollute the table with junk.
 *
 * Caller is expected to use the useFeatureUsageLog hook which
 * de-duplicates per (feature_name, session) on the client side, so
 * one logged-in user visiting /dashboard 100 times in a session
 * produces ~1 row, not 100.
 */

export const dynamic = 'force-dynamic';

const Schema = z.object({
  feature_name: z.string().min(1).max(64),
  action: z.string().min(1).max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    const json = await req.json();
    parsed = Schema.safeParse(json);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ ok: true, skipped: 'anon' });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('feature_usage').insert({
    user_id: user.id,
    feature_name: parsed.data.feature_name,
    action: parsed.data.action ?? 'view',
    metadata: parsed.data.metadata ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
