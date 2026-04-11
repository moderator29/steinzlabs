import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_PASSWORD = '195656';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, username, email, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data: profiles, count, error } = await query;

    if (error) {

      return NextResponse.json({ users: [], total: 0, page, limit });
    }

    return NextResponse.json({
      users: profiles || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {

    return NextResponse.json({ users: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const { password, action, userId } = await request.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    if (action === 'delete') {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      await supabase.from('profiles').delete().eq('id', userId);
      return NextResponse.json({ success: true, message: 'User deleted' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {

    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
