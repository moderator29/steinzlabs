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
      .select(
        'id, first_name, last_name, username, email, created_at, tier, tier_expires_at, tier_granted_reason, status, role',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      );
    }

    const { data: profiles, count, error } = await query;
    if (error) return NextResponse.json({ users: [], total: 0, page, limit });

    // Bug §9.1: the page rendered `last_active`/`is_banned`/`subscription` but the
    // GET only selected name+email+created_at, so every user looked anonymous and
    // never-banned. Now we also pull `auth.users.last_sign_in_at` for the rows
    // we're about to return (bounded by `limit`, so no N+1 against the full
    // table) and stitch it onto each profile.
    const ids = (profiles ?? []).map(p => p.id).filter(Boolean) as string[];
    const lastSignInById = new Map<string, string | null>();
    if (ids.length > 0) {
      const lookups = await Promise.all(
        ids.map(id =>
          supabase.auth.admin
            .getUserById(id)
            .then(r => [id, r.data.user?.last_sign_in_at ?? null] as const)
            .catch(() => [id, null] as const),
        ),
      );
      for (const [id, ts] of lookups) lastSignInById.set(id, ts);
    }

    const users = (profiles ?? []).map(p => ({
      ...p,
      last_active: lastSignInById.get(p.id) ?? null,
    }));

    return NextResponse.json({
      users,
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
    // Bug §2.18: the old handler called `request.json()` once for action+userId
    // and then again inside set_tier / set_role to read their extra fields.
    // The second call throws "body already used" so tier/months/role were
    // always undefined — which is why admins could click "Set to Max" and
    // nothing actually changed in Supabase. Read the body exactly once here.
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body.action === 'string' ? body.action : '';
    const userId = typeof body.userId === 'string' ? body.userId : '';
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
      const role = typeof body.role === 'string' ? body.role : null;
      if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 });
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
      const tier = typeof body.tier === 'string' ? body.tier : undefined;
      const months = typeof body.months === 'number' ? body.months : undefined;
      const reason = typeof body.reason === 'string' ? body.reason : undefined;
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
