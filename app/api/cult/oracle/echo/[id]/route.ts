import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * DELETE /api/cult/oracle/echo/[id] — soft-remove a slot.
 *
 * Admin-only (curation), matching the POST add route: the member-facing remove
 * UI was gated on the retired "Chosen" role and is dead, so this is a curator
 * surface behind the admin bearer. active=false vacates the position so the
 * partial unique index allows a future re-add, while the row stays for audit.
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
    .from('cult_echo_wallets')
    .update({ active: false })
    .eq('id', id)
    .eq('active', true)
    .select('id,position')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ removed: data });
}
