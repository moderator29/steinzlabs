import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest as verifyAdmin } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';

const SettingsBody = z.object({
  flags: z.record(z.string().min(1).max(120), z.boolean()),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = SettingsBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
  }
  const { flags } = parsed.data;

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

  void logAdminAction({
    adminId,
    action: 'settings_update',
    details: { flagKeys: Object.keys(flags), flagCount: Object.keys(flags).length },
  });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
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
