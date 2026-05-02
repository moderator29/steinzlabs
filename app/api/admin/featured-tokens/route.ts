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
      .from('featured_tokens')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[admin/featured-tokens GET] Query error:', error);
      return NextResponse.json({ tokens: [] });
    }

    return NextResponse.json({ tokens: data || [] });
  } catch (err) {
    console.error('[admin/featured-tokens GET] Failed:', err);
    return NextResponse.json({ tokens: [] });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('featured_tokens')
      .insert([{
        symbol: body.symbol,
        name: body.name,
        chain: body.chain,
        address: body.address,
        display_order: body.display_order ?? body.displayOrder ?? 0,
        active: body.active !== false,
        badge: body.badge || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('[admin/featured-tokens POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ token: data });
  } catch (err) {
    console.error('[admin/featured-tokens POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to create featured token' }, { status: 500 });
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
    // Whitelist updatable fields. Never trust raw body — would let an
    // attacker (or compromised admin UI) overwrite arbitrary columns.
    const updates: Record<string, unknown> = {};
    if (typeof body.symbol === 'string') updates.symbol = body.symbol.slice(0, 32);
    if (typeof body.name === 'string') updates.name = body.name.slice(0, 200);
    if (typeof body.chain === 'string') updates.chain = body.chain.slice(0, 32);
    if (typeof body.address === 'string') updates.address = body.address.slice(0, 64);
    const order = body.display_order ?? body.displayOrder;
    if (typeof order === 'number') updates.display_order = order;
    if (typeof body.active === 'boolean') updates.active = body.active;
    if (body.badge === null || typeof body.badge === 'string') updates.badge = body.badge;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('featured_tokens')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[admin/featured-tokens PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/featured-tokens PATCH] Failed:', err);
    return NextResponse.json({ error: 'Failed to update featured token' }, { status: 500 });
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
    const { error } = await supabase.from('featured_tokens').delete().eq('id', id);

    if (error) {
      console.error('[admin/featured-tokens DELETE] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/featured-tokens DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete featured token' }, { status: 500 });
  }
}
