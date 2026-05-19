import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { RATES, takeToken } from '@/lib/social/rateLimit';

/**
 * POST   /api/social/block  body: { target_id }    Block a user.
 * DELETE /api/social/block?target_id=<uuid>        Unblock.
 *
 * Side effect: blocking severs any existing follow edges in both
 * directions so the UI stops surfacing the other user immediately.
 */

const BlockBody = z.object({ target_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!takeToken(`block:${user.id}`, RATES.block)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const parsed = BlockBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const targetId = parsed.data.target_id;
  if (targetId === user.id) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error: blockErr } = await sb
    .from('social_blocks')
    .upsert({ blocker_id: user.id, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
  if (blockErr) return NextResponse.json({ error: blockErr.message }, { status: 500 });

  // Sever follows in both directions
  await sb
    .from('social_follows')
    .delete()
    .or(`and(follower_id.eq.${user.id},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${user.id})`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const targetId = req.nextUrl.searchParams.get('target_id');
  if (!targetId || !z.string().uuid().safeParse(targetId).success) {
    return NextResponse.json({ error: 'Invalid target_id' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('social_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
