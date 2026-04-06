import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '195656';

// GET - fetch published research posts (public)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');

    const admin = getSupabaseAdmin();
    let query = admin
      .from('research_posts')
      .select('id, title, summary, content, category, image_url, tags, published_at, created_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category) query = query.eq('category', category);

    const { data, error, count } = await query;

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ posts: [], total: 0, page, limit });
      }
      throw error;
    }

    return NextResponse.json({ posts: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error('Research fetch error:', err);
    return NextResponse.json({ posts: [], total: 0, page: 1, limit: 10 });
  }
}

// POST - admin creates/uploads research post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, title, summary, content, category, image_url, tags, published } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Try to create table if it doesn't exist (via upsert pattern)
    const { data, error } = await admin
      .from('research_posts')
      .insert({
        title: title.trim(),
        summary: summary?.trim() || '',
        content: content.trim(),
        category: category?.trim() || 'General',
        image_url: image_url?.trim() || null,
        tags: Array.isArray(tags) ? tags : [],
        published: published !== false,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Research post error:', error);
      return NextResponse.json({ error: 'Failed to save post: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: data });
  } catch (err) {
    console.error('Research post error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - admin deletes research post
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const password = searchParams.get('password');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('research_posts').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Research delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
