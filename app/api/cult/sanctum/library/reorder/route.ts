import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface ReorderPayload {
  order?: unknown;
}

/**
 * PATCH /api/cult/sanctum/library/reorder
 *
 * Body: { order: [trackId1, trackId2, ...] }. Each id gets display_order
 * assigned as its index in the array. Ids not in the catalog (or not
 * is_active) are ignored silently — never error on a half-sync from the
 * client because Sanctum can be edited concurrently.
 *
 * Chosen-only. Server-side gate via getCultAccess(); the RLS policy in
 * 2026_05_12_cult_sanctum_curation.sql is a second line of defense.
 */
export async function PATCH(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!access.isChosen) {
    return NextResponse.json({ error: 'chosen_only' }, { status: 403 });
  }

  let payload: ReorderPayload;
  try {
    payload = (await req.json()) as ReorderPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const order = Array.isArray(payload.order)
    ? payload.order.filter((id): id is string => typeof id === 'string')
    : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ error: 'order_required' }, { status: 400 });
  }
  if (order.length > 500) {
    return NextResponse.json({ error: 'too_many' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // One UPDATE per row keeps the audit trail clean (curated_by per row).
  // The catalog is tiny (<50 tracks expected) so the round-trip count is fine.
  const results = await Promise.all(
    order.map((id, index) =>
      admin
        .from('cult_ambient_tracks')
        .update({ display_order: index, curated_by: access.userId, curated_at: now })
        .eq('id', id)
        .select('id')
        .maybeSingle()
    )
  );

  const updated = results.filter((r) => r.data && !r.error).length;
  return NextResponse.json({ updated, total: order.length });
}
