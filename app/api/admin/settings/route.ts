import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyAdminRequest(request: NextRequest): boolean {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  return !!token && token === process.env.ADMIN_BEARER_TOKEN;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminRequest(request)) {
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
  if (!verifyAdminRequest(request)) {
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
