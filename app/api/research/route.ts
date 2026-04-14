import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ---------- types ----------
interface ResearchPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
  source?: string;
  url?: string;
}


// ---------- GET — Only admin-published posts from Supabase ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
  const category = searchParams.get('category') || null;

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    let query = admin
      .from('research_posts')
      .select('id, title, summary, content, category, image_url, tags, published_at, created_at, view_count')
      .eq('published', true)
      .order('published_at', { ascending: false });

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);

    if (error) {
      return NextResponse.json({ posts: [], total: 0, page, limit });
    }

    return NextResponse.json({
      posts: data || [],
      total: count || (data || []).length,
      page,
      limit,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ posts: [], total: 0, page: 1, limit: 10 });
  }
}

// ---------- POST (admin creates manual post) ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, title, summary, content, category, image_url, tags, published } = body;

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
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
      return NextResponse.json({ error: 'Failed to save post: ' + error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, post: data });
  } catch (err) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------- DELETE (admin) ----------
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const password = searchParams.get('password');

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('research_posts').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {

    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
