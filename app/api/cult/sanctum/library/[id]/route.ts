import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * DELETE /api/cult/sanctum/library/[id]
 *
 * Soft-delete (sets is_active = false) so the audit log keeps the row.
 * Chosen-only. Hard delete is intentionally not exposed here; an admin
 * must purge via Supabase if a track needs to be fully erased.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_ambient_tracks')
    .update({
      is_active: false,
      curated_by: access.userId,
      curated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ removed: data.id });
}
