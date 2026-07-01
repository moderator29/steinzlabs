import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-user opt-in security monitoring toggle, persisted to
 * user_security_settings. GET reports the current state; PUT flips it.
 * When the settings table hasn't been migrated yet the endpoints degrade
 * to an honest "unavailable" state rather than pretending monitoring is on.
 */

const Body = z.object({ enabled: z.boolean() });

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  try {
    const { data, error } = await admin
      .from('user_security_settings')
      .select('monitoring_enabled')
      .eq('user_id', user.id)
      .maybeSingle<{ monitoring_enabled: boolean }>();

    if (error) return NextResponse.json({ enabled: false, available: false });
    return NextResponse.json({ enabled: data?.monitoring_enabled ?? false, available: true });
  } catch {
    return NextResponse.json({ enabled: false, available: false });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = getSupabaseAdmin();
  try {
    const { error } = await admin
      .from('user_security_settings')
      .upsert(
        { user_id: user.id, monitoring_enabled: parsed.data.enabled, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ enabled: parsed.data.enabled, available: true });
  } catch {
    return NextResponse.json({ error: 'Monitoring settings unavailable' }, { status: 503 });
  }
}
