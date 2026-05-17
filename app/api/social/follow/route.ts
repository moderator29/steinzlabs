import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isBlockedBetween } from '@/lib/social/permissions';
import { RATES, takeToken } from '@/lib/social/rateLimit';

/**
 * POST /api/social/follow  body: { target_id }
 * DELETE /api/social/follow?target_id=<uuid>
 *
 * Creates / removes a follow edge. Private accounts produce a
 * 'pending' row that the target must accept via PATCH on this
 * route (target_id = caller's id, action = 'accept'|'reject').
 */

const FollowBody = z.object({ target_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!takeToken(`follow:${user.id}`, RATES.follow)) {
    return NextResponse.json({ error: 'Rate limit exceeded — slow down' }, { status: 429 });
  }
  const parsed = FollowBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const targetId = parsed.data.target_id;
  if (targetId === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  if (await isBlockedBetween(user.id, targetId)) return NextResponse.json({ error: 'Blocked' }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data: target } = await sb.from('profiles').select('is_private').eq('id', targetId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const status: 'pending' | 'accepted' = target.is_private ? 'pending' : 'accepted';

  const { data, error } = await sb
    .from('social_follows')
    .upsert({ follower_id: user.id, following_id: targetId, status }, { onConflict: 'follower_id,following_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ follow: data });
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
    .from('social_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const PatchBody = z.object({
  follower_id: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (parsed.data.action === 'reject') {
    const { error } = await sb
      .from('social_follows')
      .delete()
      .eq('follower_id', parsed.data.follower_id)
      .eq('following_id', user.id)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await sb
    .from('social_follows')
    .update({ status: 'accepted' })
    .eq('follower_id', parsed.data.follower_id)
    .eq('following_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
