import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Single research post by id, for the public detail page ("Read more"). Returns
 * only published posts and best-effort increments the view counter. The select
 * pulls both schema variants (summary/excerpt, image_url/cover_image) so a post
 * authored through any path renders fully.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Post id required' }, { status: 400 });

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('research_posts')
      .select('id, slug, title, summary, excerpt, content, category, image_url, cover_image, author, tags, read_time, published, published_at, created_at, view_count')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Best-effort view increment (never blocks the read).
    admin
      .from('research_posts')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', id)
      .then(() => {}, () => {});

    const post = {
      id: data.id,
      slug: data.slug,
      title: data.title,
      summary: data.summary || data.excerpt || '',
      content: data.content || '',
      category: data.category || 'Research',
      image_url: data.image_url || data.cover_image || null,
      author: data.author || 'Naka Labs Research',
      tags: data.tags ?? [],
      read_time: data.read_time ?? null,
      published_at: data.published_at,
      view_count: (data.view_count ?? 0) + 1,
    };
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
}
