import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/wire/posts/[id]/reply
 *
 * Create a reply to wire [id]. A reply is itself a wire_posts row with
 * reply_to = [id]. author_id is ALWAYS the session user (IDOR-safe). The
 * parent's reply_count is incremented atomically by the trg_wire_reply_count
 * trigger - we never write the count here.
 *
 * Body: { body (1..600), media_url? }
 */

const AUTHOR =
  'author:profiles!wire_posts_author_id_fkey(id,username,display_name,avatar_url,is_verified)';
const REPLY_SELECT = `*, ${AUTHOR}`;

const Body = z.object({
  body: z.string().trim().min(1, 'Body required').max(600, 'Max 600 characters'),
  media_url: z.string().trim().url().max(2048).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload' },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();

  // Parent must exist and be live. Replies to a reply are not supported (single
  // level) - reject if the target is itself a reply to keep threads honest.
  const { data: parent } = await sb
    .from('wire_posts')
    .select('id, deleted_at, reply_to')
    .eq('id', id)
    .maybeSingle();
  if (!parent || parent.deleted_at) {
    return NextResponse.json({ error: 'Wire not found' }, { status: 404 });
  }
  if (parent.reply_to) {
    return NextResponse.json({ error: 'Cannot reply to a reply' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('wire_posts')
    .insert({
      author_id: user.id, // session-derived, never from the client
      body: parsed.data.body,
      media_url: parsed.data.media_url ?? null,
      reply_to: id,
    })
    .select(REPLY_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: { ...data, liked: false, reposted: false } });
}
