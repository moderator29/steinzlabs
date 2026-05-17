import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET  /api/admin/social/reports?status=&category=&limit=
 * PATCH /api/admin/social/reports  body: { id, status: 'resolved'|'dismissed', admin_notes? }
 *
 * Admin-only moderation queue. Enriches each row with the
 * reporter + reported profile basics in one extra fetch so the
 * UI doesn't need N round-trips.
 */

export async function GET(req: NextRequest) {
  const adminId = await verifyAdminRequest(req);
  if (!adminId) return unauthorizedResponse();
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const category = req.nextUrl.searchParams.get('category');
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50')));

  const sb = getSupabaseAdmin();
  let q = sb.from('user_reports').select('id, reporter_id, reported_id, reason, category, status, admin_notes, created_at, resolved_at').order('created_at', { ascending: false }).limit(limit);
  if (status !== 'all') q = q.eq('status', status);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set([...(data ?? []).map((r) => r.reported_id), ...(data ?? []).map((r) => r.reporter_id).filter(Boolean) as string[]]));
  const { data: profiles } = ids.length
    ? await sb.from('profiles').select('id, username, display_name, avatar_url, tier').in('id', ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    reports: (data ?? []).map((r) => ({
      ...r,
      reporter: r.reporter_id ? byId.get(r.reporter_id) ?? null : null,
      reported: byId.get(r.reported_id) ?? null,
    })),
  });
}

const Patch = z.object({
  id: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
  admin_notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  const adminId = await verifyAdminRequest(req);
  if (!adminId) return unauthorizedResponse();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const sb = getSupabaseAdmin();
  await sb.from('user_reports').update({
    status: parsed.data.status,
    admin_notes: parsed.data.admin_notes ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', parsed.data.id);
  // Audit log
  await sb.from('admin_audit_log').insert({
    actor_id: adminId === 'admin-bearer' ? null : adminId,
    action: 'social.report.resolve',
    target_type: 'user_report',
    target_id: parsed.data.id,
    metadata: { status: parsed.data.status, notes: parsed.data.admin_notes ?? null },
  }).select().single().then(() => null, () => null);
  return NextResponse.json({ ok: true });
}
