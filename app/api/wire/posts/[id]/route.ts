import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * DELETE /api/wire/posts/[id]
 * Soft-delete a wire by setting deleted_at. Owner-scoped: the update is
 * filtered by author_id = session user, so a non-author's request affects
 * zero rows (IDOR-safe) and returns 404.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('wire_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id) // ownership enforced here, never from the client
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
