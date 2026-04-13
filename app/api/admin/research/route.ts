import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function verifyAdmin(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.ADMIN_BEARER_TOKEN;
  return !!(expected && token && token === expected);
}

// ─── GET: list all posts (including unpublished) ──────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('research_posts')
      .select('id, title, slug, summary, content, category, image_url, tags, published, published_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch posts' }, { status: 500 });
  }
}

// ─── POST: create a new post ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      title?: string;
      slug?: string;
      summary?: string;
      content?: string;
      category?: string;
      image_url?: string | null;
      tags?: string[];
      published?: boolean;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const slug = body.slug?.trim() || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('research_posts')
      .insert({
        title: body.title.trim(),
        slug,
        summary: body.summary?.trim() || '',
        content: body.content?.trim() || '',
        category: body.category || 'General',
        image_url: body.image_url || null,
        tags: body.tags || [],
        published: body.published ?? false,
        published_at: body.published ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create post' }, { status: 500 });
  }
}

// ─── PATCH: update a post ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      id?: string;
      title?: string;
      slug?: string;
      summary?: string;
      content?: string;
      category?: string;
      image_url?: string | null;
      tags?: string[];
      published?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined)     updates.title = body.title.trim();
    if (body.slug !== undefined)      updates.slug = body.slug.trim();
    if (body.summary !== undefined)   updates.summary = body.summary.trim();
    if (body.content !== undefined)   updates.content = body.content.trim();
    if (body.category !== undefined)  updates.category = body.category;
    if (body.image_url !== undefined) updates.image_url = body.image_url;
    if (body.tags !== undefined)      updates.tags = body.tags;
    if (body.published !== undefined) {
      updates.published = body.published;
      if (body.published) updates.published_at = new Date().toISOString();
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('research_posts')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update post' }, { status: 500 });
  }
}

// ─── DELETE: delete a post ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('research_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete post' }, { status: 500 });
  }
}
