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
      .from('flagged_tokens')
      .select('*')
      .order('flagged_at', { ascending: false });

    if (error) {
      console.error('[admin/flagged-tokens GET] Query error:', error);
      return NextResponse.json({ tokens: [] });
    }

    return NextResponse.json({ tokens: data || [] });
  } catch (err) {
    console.error('[admin/flagged-tokens GET] Failed:', err);
    return NextResponse.json({ tokens: [] });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { address, symbol, chain, reason, severity } = body;

    if (!address || !symbol) {
      return NextResponse.json({ error: 'address and symbol are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('flagged_tokens')
      .insert([{
        address,
        symbol,
        chain: chain ?? 'ETH',
        reason: reason ?? '',
        severity: severity ?? 'high',
        flagged_by: adminId,
        active: true,
      }])
      .select()
      .single();

    if (error) {
      console.error('[admin/flagged-tokens POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ token: data });
  } catch (err) {
    console.error('[admin/flagged-tokens POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to flag token' }, { status: 500 });
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

    // Hard delete — caller can switch to soft delete (set active=false) if preferred
    const { error } = await supabase
      .from('flagged_tokens')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admin/flagged-tokens DELETE] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/flagged-tokens DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete flagged token' }, { status: 500 });
  }
}

// PATCH for toggling active status
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
      .from('flagged_tokens')
      .update({ active: body.active })
      .eq('id', id);

    if (error) {
      console.error('[admin/flagged-tokens PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/flagged-tokens PATCH] Failed:', err);
    return NextResponse.json({ error: 'Failed to update flagged token' }, { status: 500 });
  }
}
