import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface GrantPayload {
  user_id?: unknown;
  code?: unknown;
  note?: unknown;
}

/**
 * GET /api/cult/sanctum/annals — Annals catalog plus the caller's earnings.
 *
 * Returns:
 *   - catalog: every active achievement (bronze..mythic)
 *   - earnings: just the caller's earned rows (sufficient for the v1
 *     "your annals" view; aggregate counts come in a follow-up)
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  // Hard upper bounds — catalog won't ever hit 200, but unbounded SELECTs
  // are an RLS/perf risk and the audit flagged them.
  const [{ data: catalog }, { data: earnings }] = await Promise.all([
    admin
      .from('cult_achievements')
      .select('id,code,title,description,tier')
      .eq('active', true)
      .order('tier', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(200),
    admin
      .from('cult_member_achievements')
      .select('achievement_id,earned_at,note')
      .eq('user_id', access.userId)
      .order('earned_at', { ascending: false })
      .limit(500),
  ]);

  return NextResponse.json({
    catalog: catalog ?? [],
    earnings: earnings ?? [],
    isChosen: access.isChosen,
  });
}

/**
 * POST — Chosen-only grant. Body: { user_id, code, note? }. Idempotent —
 * the PK (user_id, achievement_id) means a re-grant returns 409 cleanly.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!access.isChosen) {
    return NextResponse.json({ error: 'chosen_only' }, { status: 403 });
  }

  let payload: GrantPayload;
  try {
    payload = (await req.json()) as GrantPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const targetUser = typeof payload.user_id === 'string' ? payload.user_id : '';
  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';

  if (!targetUser) return NextResponse.json({ error: 'user_id_required' }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });
  if (note.length > 280) return NextResponse.json({ error: 'note_too_long' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: achievement } = await admin
    .from('cult_achievements')
    .select('id,active')
    .eq('code', code)
    .maybeSingle<{ id: string; active: boolean }>();
  if (!achievement) return NextResponse.json({ error: 'unknown_code' }, { status: 404 });
  if (!achievement.active) return NextResponse.json({ error: 'inactive_code' }, { status: 410 });

  // Only grant to actual cult members so a Chosen can't accidentally award
  // a free user the chamber doesn't surface.
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id,tier')
    .eq('id', targetUser)
    .maybeSingle<{ id: string; tier: string | null }>();
  if (!targetProfile || targetProfile.tier !== 'naka_cult') {
    return NextResponse.json({ error: 'target_not_in_cult' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('cult_member_achievements')
    .insert({
      user_id: targetUser,
      achievement_id: achievement.id,
      granted_by: access.userId,
      note: note || null,
    })
    .select('user_id,achievement_id,earned_at,note')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'already_granted' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ award: data }, { status: 201 });
}
