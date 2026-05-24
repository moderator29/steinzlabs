import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

// §13 audit fix: was using a custom verifyAdmin() that ONLY accepted
// the env bearer token, locking out admins who authenticate via Supabase
// JWT. Switched to the canonical verifyAdminRequest helper used by
// every other /api/admin/** route — accepts both auth modes.

// ─── GET: list all posts (including unpublished) ──────────────────────────────

export async function GET(request: NextRequest) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) {
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
  const adminId = await verifyAdminRequest(request);
  if (!adminId) {
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
    void logAdminAction({
      adminId,
      action: body.published ? 'research_publish' : 'research_upload',
      details: { id: (data as { id?: string })?.id, slug, title: body.title.trim(), category: body.category ?? 'General', published: Boolean(body.published) },
    });
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create post' }, { status: 500 });
  }
}

// ─── PATCH: update a post ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) {
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
    let action: 'research_publish' | 'research_unpublish' | 'research_upload' = 'research_upload';
    if (body.published === true) action = 'research_publish';
    else if (body.published === false) action = 'research_unpublish';
    void logAdminAction({ adminId, action, details: { id: body.id, fields: Object.keys(updates) } });
    return NextResponse.json({ post: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update post' }, { status: 500 });
  }
}

// ─── DELETE: delete a post ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) {
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
    void logAdminAction({ adminId, action: 'research_delete', details: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete post' }, { status: 500 });
  }
}
