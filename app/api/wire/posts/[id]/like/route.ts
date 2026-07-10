import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST   /api/wire/posts/[id]/like   like a wire (idempotent via pk dedupe)
 * DELETE /api/wire/posts/[id]/like   remove the like
 *
 * Owner-scoped: user_id is the session user. The (post_id,user_id) primary key
 * makes a double-like a no-op. Counts are trigger-maintained; we read the fresh
 * like_count back so the client can reconcile its optimistic value.
 */

async function likeCount(sb: ReturnType<typeof getSupabaseAdmin>, id: string): Promise<number | null> {
  const { data } = await sb.from('wire_posts').select('like_count').eq('id', id).maybeSingle();
  return typeof data?.like_count === 'number' ? data.like_count : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('wire_post_likes')
    .upsert({ post_id: id, user_id: user.id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ liked: true, like_count: await likeCount(sb, id) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('wire_post_likes')
    .delete()
    .eq('post_id', id)
    .eq('user_id', user.id); // owner-scoped
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ liked: false, like_count: await likeCount(sb, id) });
}
