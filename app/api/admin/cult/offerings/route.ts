import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, logAdminAction } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * POST /api/admin/cult/offerings — create an Offering (admin: research.publish).
 * Body: { title, description?, kind?, reward_label?, closes_at? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, 'research.publish');
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  const kind = ['raffle', 'airdrop', 'reward'].includes(body.kind as string) ? (body.kind as string) : 'raffle';
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const reward_label = typeof body.reward_label === 'string' ? body.reward_label.trim() : null;
  const closes_at = typeof body.closes_at === 'string' ? body.closes_at : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_offerings')
    .insert({ title, description, kind, reward_label, closes_at })
    .select('id, title, kind, status, reward_label, closes_at, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, {
    action: 'cult.offering.create',
    target_type: 'cult_offering',
    target_id: data.id as string,
    after_state: data,
  });
  return NextResponse.json({ offering: data }, { status: 201 });
}

/**
 * PATCH /api/admin/cult/offerings — draw a winner now, or close an offering.
 * Body: { id, op?: 'draw' | 'close' } (default 'draw').
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requirePermission(req, 'research.publish');
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  const op = body.op === 'close' ? 'close' : 'draw';

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (op === 'close') {
    const { error } = await admin.from('cult_offerings').update({ status: 'closed', drawn_at: nowIso }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdminAction(ctx, { action: 'cult.offering.close', target_type: 'cult_offering', target_id: id });
    return NextResponse.json({ ok: true });
  }

  const { data: entries } = await admin.from('cult_offering_entries').select('user_id').eq('offering_id', id);
  if (!entries || entries.length === 0) {
    await admin.from('cult_offerings').update({ status: 'closed', drawn_at: nowIso }).eq('id', id);
    return NextResponse.json({ ok: true, winner: null, note: 'no_entries_closed' });
  }
  const winner = entries[Math.floor(Math.random() * entries.length)].user_id;
  const { error } = await admin
    .from('cult_offerings')
    .update({ status: 'drawn', winner_user_id: winner, drawn_at: nowIso })
    .eq('id', id)
    .eq('status', 'open');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, {
    action: 'cult.offering.draw',
    target_type: 'cult_offering',
    target_id: id,
    after_state: { winner },
  });
  return NextResponse.json({ ok: true, winner });
}
