import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, logAdminAction } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ADM4: feature flags CRUD. Every toggle goes through admin_audit_log
 * via logAdminAction so we have a durable paper trail of who flipped
 * what.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'admin.read');
  if (ctx instanceof Response) return ctx;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('feature_flags')
    .select('key, enabled, description, rollout_pct, updated_by, updated_at')
    .order('key', { ascending: true });
  return NextResponse.json({ flags: data ?? [] });
}

const PatchBody = z.object({
  key: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  rollout_pct: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest) {
  const ctx = await requirePermission(request, 'feature_flag.toggle');
  if (ctx instanceof Response) return ctx;

  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase
    .from('feature_flags')
    .select('enabled, rollout_pct, description')
    .eq('key', parsed.data.key)
    .maybeSingle<{ enabled: boolean; rollout_pct: number; description: string | null }>();

  const next = {
    key: parsed.data.key,
    enabled: parsed.data.enabled ?? before?.enabled ?? false,
    rollout_pct: parsed.data.rollout_pct ?? before?.rollout_pct ?? 0,
    description: parsed.data.description ?? before?.description ?? null,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('feature_flags').upsert(next, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, {
    action: 'feature_flag.toggle',
    target_type: 'feature_flag',
    target_id: parsed.data.key,
    before_state: before ?? null,
    after_state: { enabled: next.enabled, rollout_pct: next.rollout_pct },
  });
  return NextResponse.json({ ok: true });
}
