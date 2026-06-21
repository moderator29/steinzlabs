import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, logAdminAction } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * POST /api/admin/cult/signals — push a curated signal into the Pulse
 * (admin: research.publish). The consensus feeder fills the Pulse automatically;
 * this lets the team post hand-picked alpha on top.
 * Body: { title, kind?, severity?: 'info'|'watch'|'alert', message? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, 'research.publish');
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  const kind = typeof body.kind === 'string' && body.kind.trim() ? body.kind.trim() : 'note';
  const severity = ['info', 'watch', 'alert'].includes(body.severity as string) ? (body.severity as string) : 'info';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_signals')
    .insert({ kind, title, severity, detail: message ? { message } : {} })
    .select('id, kind, title, severity, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, {
    action: 'cult.signal.post',
    target_type: 'cult_signal',
    target_id: data.id as string,
    after_state: data,
  });
  return NextResponse.json({ signal: data }, { status: 201 });
}
