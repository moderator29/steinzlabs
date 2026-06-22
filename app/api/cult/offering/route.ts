import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface EnterPayload { offeringId?: unknown }

/**
 * GET /api/cult/offering — the Offering board: open + recently-drawn
 * offerings, each flagged with whether the caller has entered and the live
 * entry count. Any cult member may read.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: offerings, error } = await admin
    .from('cult_offerings')
    .select('id, title, description, kind, status, reward_label, closes_at, winner_user_id, created_at, drawn_at')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (offerings ?? []).map((o) => o.id as string);
  const myEntries = new Set<string>();
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: entries } = await admin
      .from('cult_offering_entries')
      .select('offering_id, user_id')
      .in('offering_id', ids);
    for (const e of entries ?? []) {
      counts.set(e.offering_id as string, (counts.get(e.offering_id as string) ?? 0) + 1);
      if (e.user_id === access.userId) myEntries.add(e.offering_id as string);
    }
  }

  return NextResponse.json({
    offerings: (offerings ?? []).map((o) => ({
      ...o,
      entries: counts.get(o.id as string) ?? 0,
      entered: myEntries.has(o.id as string),
      won: o.winner_user_id === access.userId,
    })),
  });
}

/**
 * POST /api/cult/offering — enter an open offering. One entry per member
 * (DB unique constraint); entering a non-open offering is rejected.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: EnterPayload;
  try {
    payload = (await req.json()) as EnterPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : '';
  if (!offeringId) return NextResponse.json({ error: 'offering_required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: offering } = await admin
    .from('cult_offerings')
    .select('id, status')
    .eq('id', offeringId)
    .maybeSingle<{ id: string; status: string }>();
  if (!offering) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (offering.status !== 'open') return NextResponse.json({ error: 'closed' }, { status: 409 });

  const { error } = await admin
    .from('cult_offering_entries')
    .insert({ offering_id: offeringId, user_id: access.userId });
  if (error) {
    // 23505 = unique violation → already entered, treat as idempotent success.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, alreadyEntered: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
