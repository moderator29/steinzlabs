import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * DELETE /api/cult/sanctum/library/[id]
 *
 * Soft-delete (sets is_active = false) so the audit log keeps the row.
 * Curating the Library is a privileged write; "Chosen" is retired, so this is
 * gated to platform admins via the admin bearer — like every other privileged
 * cult write (see sanctum/annals). Previously it only checked cult membership,
 * so ANY member could hide any track. Hard delete stays Supabase-only.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const adminUserId = await verifyAdminRequest(req);
  if (!adminUserId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_ambient_tracks')
    .update({
      is_active: false,
      curated_by: adminUserId,
      curated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ removed: data.id });
}
