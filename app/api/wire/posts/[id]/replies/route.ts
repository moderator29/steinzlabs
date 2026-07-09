import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/wire/posts/[id]/replies?order=asc|desc&cursor=<iso>
 *
 * The reply thread for wire [id]. Replies are wire_posts rows with
 * reply_to = [id]. Public-readable; a viewer (if present) only annotates
 * liked/reposted state, never widens access. Cursor-paginated by created_at.
 * Default order is oldest-first (natural conversation reading).
 */

const AUTHOR =
  'author:profiles!wire_posts_author_id_fkey(id,username,display_name,avatar_url,is_verified)';
const REPLY_SELECT = `*, ${AUTHOR}`;
const PAGE_SIZE = 20;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const order = sp.get('order') === 'desc' ? 'desc' : 'asc';
  const cursor = sp.get('cursor');
  const ascending = order === 'asc';

  const sb = getSupabaseAdmin();
  const viewer = await getAuthenticatedUser(req);

  let q = sb
    .from('wire_posts')
    .select(REPLY_SELECT)
    .eq('reply_to', id)
    .is('deleted_at', null)
    .order('created_at', { ascending })
    .limit(PAGE_SIZE);
  if (cursor) q = ascending ? q.gt('created_at', cursor) : q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const replies = Array.isArray(data) ? data : [];
  const annotated = await annotate(sb, replies, viewer?.id);
  const nextCursor =
    replies.length === PAGE_SIZE ? replies[replies.length - 1]?.created_at ?? null : null;
  return NextResponse.json({ replies: annotated, nextCursor });
}

async function annotate(
  sb: ReturnType<typeof getSupabaseAdmin>,
  posts: any[],
  viewerId?: string,
): Promise<any[]> {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  if (!viewerId) return posts.map((p) => ({ ...p, liked: false, reposted: false }));

  const ids = posts.map((p) => p?.id).filter(Boolean);
  if (ids.length === 0) return posts.map((p) => ({ ...p, liked: false, reposted: false }));

  const [{ data: likes }, { data: rps }] = await Promise.all([
    sb.from('wire_post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
    sb.from('wire_reposts').select('post_id').eq('user_id', viewerId).in('post_id', ids),
  ]);
  const likedSet = new Set((likes ?? []).map((r: any) => r.post_id));
  const repostedSet = new Set((rps ?? []).map((r: any) => r.post_id));

  return posts.map((p) => ({
    ...p,
    liked: likedSet.has(p?.id),
    reposted: repostedSet.has(p?.id),
  }));
}
