import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin/announcements GET] Query error:', error);
      return NextResponse.json({ announcements: [] });
    }

    return NextResponse.json({ announcements: data || [] });
  } catch (err) {
    console.error('[admin/announcements GET] Failed:', err);
    return NextResponse.json({ announcements: [] });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .insert([{
        title: body.title,
        body: body.body,
        type: body.type || 'info',
        active: body.active !== false,
        target_audience: body.target_audience || 'All',
        expires_at: body.expires_at || null,
        created_by: adminId,
      }])
      .select()
      .single();

    if (error) {
      console.error('[admin/announcements POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ announcement: data });
  } catch (err) {
    console.error('[admin/announcements POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('announcements')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[admin/announcements PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/announcements PATCH] Failed:', err);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('announcements').delete().eq('id', id);

    if (error) {
      console.error('[admin/announcements DELETE] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/announcements DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}
