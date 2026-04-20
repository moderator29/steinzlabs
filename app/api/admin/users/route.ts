import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, username, email, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    const { data: profiles, count, error } = await query;
    if (error) return NextResponse.json({ users: [], total: 0, page, limit });

    return NextResponse.json({
      users: profiles || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch {
    return NextResponse.json({ users: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const { action, userId } = await request.json();
    const supabase = getSupabaseAdmin();

    if (action === 'delete') {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await supabase.from('profiles').delete().eq('id', userId);
      return NextResponse.json({ success: true, message: 'User deleted' });
    }

    if (action === 'ban' || action === 'unban') {
      const { error } = await supabase
        .from('profiles')
        .update({ status: action === 'ban' ? 'banned' : 'active' })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'set_role') {
      const { role } = await request.json().catch(() => ({}));
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // Admin tier override: upgrade, downgrade, comp (admin-granted free Max).
    // Sets tier + optional tier_expires_at on the profile. effectiveTier()
    // honours expiry so comps auto-revert when expiry passes.
    if (action === 'set_tier') {
      const body = await request.json().catch(() => ({}));
      const { tier, months, reason } = body as { tier?: string; months?: number; reason?: string };
      const allowed = ['free', 'mini', 'pro', 'max'];
      if (!tier || !allowed.includes(tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }
      const expires = tier === 'free'
        ? null
        : new Date(Date.now() + Math.max(1, Math.min(60, Number(months) || 1)) * 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ tier, tier_expires_at: expires, tier_granted_by: adminId, tier_granted_reason: reason ?? null })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, tier, tier_expires_at: expires });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
