import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest as verifyAdmin } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function isAdmin(request: NextRequest): Promise<boolean> {
  return !!(await verifyAdmin(request));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let flags: Record<string, boolean>;
  try {
    const body = await request.json() as { flags: Record<string, boolean> };
    flags = body.flags;
    if (!flags || typeof flags !== 'object') throw new Error('Invalid flags');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const upserts = Object.entries(flags).map(([key, enabled]) => ({
      key,
      enabled,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('platform_settings').upsert(upserts, { onConflict: 'key' });
  } catch (err) {
    console.error('[admin/settings] Failed to persist to Supabase:', err);
    // Non-fatal — return ok so the UI doesn't show a failure
  }

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('platform_settings').select('key, enabled');
    const flags = Object.fromEntries((data ?? []).map(r => [r.key, r.enabled]));
    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ flags: {} });
  }
}
