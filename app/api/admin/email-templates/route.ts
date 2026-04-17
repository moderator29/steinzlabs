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
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[admin/email-templates GET] Query error:', error);
      return NextResponse.json({ templates: [] });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (err) {
    console.error('[admin/email-templates GET] Failed:', err);
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_templates')
      .insert([{
        name: body.name,
        subject: body.subject || '',
        body: body.body || '',
        type: body.type || 'transactional',
        active: body.active !== false,
        variables: Array.isArray(body.variables) ? body.variables : [],
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[admin/email-templates POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (err) {
    console.error('[admin/email-templates POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
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

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') update.name = body.name;
    if (typeof body.subject === 'string') update.subject = body.subject;
    if (typeof body.body === 'string') update.body = body.body;
    if (typeof body.type === 'string') update.type = body.type;
    if (typeof body.active === 'boolean') update.active = body.active;
    if (Array.isArray(body.variables)) update.variables = body.variables;

    const { error } = await supabase
      .from('email_templates')
      .update(update)
      .eq('id', id);

    if (error) {
      console.error('[admin/email-templates PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/email-templates PATCH] Failed:', err);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
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
    const { error } = await supabase.from('email_templates').delete().eq('id', id);

    if (error) {
      console.error('[admin/email-templates DELETE] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/email-templates DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
