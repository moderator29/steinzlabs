import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

const MAX_LIMIT = 200;
const AUTH_PAGE_SIZE = 1000; // Supabase admin listUsers max

/**
 * §13b — partial-mask an email for PII-aware list views.
 * "phantom@gmail.com" → "ph****m@gm***l.com". Full email is still
 * returned only when the admin opens a single user's drawer with an
 * explicit `?reveal=1&id=<uuid>` query, so support flows still work
 * but a leaked admin token doesn't spill the entire user table.
 */
function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const at = email.indexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const maskPart = (s: string) => s.length <= 2 ? s : `${s[0]}${'*'.repeat(Math.min(4, s.length - 2))}${s[s.length - 1]}`;
  const maskedLocal = maskPart(local);
  const maskedDomain = dot > 0 ? `${maskPart(domain.slice(0, dot))}${domain.slice(dot)}` : maskPart(domain);
  return `${maskedLocal}@${maskedDomain}`;
}

interface AuthUserSlim {
  email: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

/**
 * Pull a Map of `auth.users` rows we care about. Single bulk call —
 * replaces the previous N+1 `getUserById()` fan-out, and incidentally
 * surfaces `email` and `banned_until`, neither of which exist on the
 * `profiles` table.
 *
 * One call covers up to 1000 users; if the user base grows past that
 * we'll need to paginate or switch to a server-side index. That's a
 * §13-class concern, not a release blocker.
 */
async function loadAuthIndex(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<Map<string, AuthUserSlim>> {
  const map = new Map<string, AuthUserSlim>();
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: AUTH_PAGE_SIZE });
    if (error) {
      console.error('[admin/users] listUsers failed', error.message);
      return map;
    }
    for (const u of data?.users ?? []) {
      map.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        // banned_until is ISO timestamp or 'none' (Supabase) or null
        banned_until: typeof u.banned_until === 'string' && u.banned_until !== 'none' ? u.banned_until : null,
      });
    }
  } catch (e) {
    console.error('[admin/users] listUsers threw', e instanceof Error ? e.message : e);
  }
  return map;
}

// Postgrest .or() parses commas as separator. A search containing a
// comma would let an attacker inject arbitrary filter clauses
// (e.g. `?search=x,id.eq.<id>`). Strip them. Also drop `()` and `:`
// for the same reason — they're meaningful in the filter grammar.
function sanitizeSearchTerm(s: string): string {
  return s.replace(/[,():%]/g, '').slice(0, 100);
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = sanitizeSearchTerm(searchParams.get('search') || '');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    // Load auth index in parallel with the profiles page query — both
    // are needed before we can shape the response, and the auth call
    // is the slower of the two.
    const profilesQueryPromise = (async () => {
      let query = supabase
        .from('profiles')
        .select(
          'id, first_name, last_name, username, display_name, avatar_url, created_at, tier, tier_expires_at, role, is_verified',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        // Comma already stripped above so the OR clause is single-segment safe.
        query = query.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`,
        );
      }
      return query;
    })();

    const [profilesResult, authIndex] = await Promise.all([profilesQueryPromise, loadAuthIndex(supabase)]);

    if (profilesResult.error) {
      console.error('[admin/users] profiles select failed', profilesResult.error.message);
      return NextResponse.json({
        users: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        error: profilesResult.error.message,
      }, { status: 500 });
    }

    const profiles = profilesResult.data ?? [];
    const count = profilesResult.count ?? 0;

    // If the search term looked like an email, also surface auth-only
    // matches (auth listUsers doesn't filter server-side, so we filter
    // the loaded slice client-side and synthesise minimal profile rows
    // for matches outside the profiles search hit).
    const profileIds = new Set(profiles.map(p => p.id));
    const extraUsers: typeof profiles = [];
    if (search && search.includes('@')) {
      for (const [authId, slim] of authIndex.entries()) {
        if (profileIds.has(authId)) continue;
        if (slim.email && slim.email.toLowerCase().includes(search.toLowerCase())) {
          extraUsers.push({
            id: authId,
            first_name: null,
            last_name: null,
            username: null,
            display_name: null,
            avatar_url: null,
            created_at: new Date(0).toISOString(),
            tier: 'free',
            tier_expires_at: null,
            role: 'user',
            is_verified: false,
          });
        }
      }
    }

    // §13b PII masking. Default: list response returns masked emails
    // ("ph****m@gm***l.com") so an exfiltrated admin token doesn't
    // hand attackers a phishing-ready user list. Admins acting on a
    // specific user can opt in to the full email by passing
    // `?reveal=1&id=<userId>` (matches one row). The full email is
    // also visible in the drawer's separate fetch path if needed.
    const reveal = searchParams.get('reveal') === '1';
    const revealId = searchParams.get('id');
    const merged = [...profiles, ...extraUsers].map(p => {
      const auth = authIndex.get(p.id);
      const rawEmail = auth?.email ?? null;
      const showFull = reveal && revealId === p.id;
      return {
        ...p,
        email: showFull ? rawEmail : maskEmail(rawEmail),
        last_active: auth?.last_sign_in_at ?? null,
        // banned_until is the source of truth; the old `profiles.status`
        // column doesn't exist, so the UI must read this instead.
        banned_until: auth?.banned_until ?? null,
      };
    });

    return NextResponse.json({
      users: merged,
      total: count + extraUsers.length,
      page,
      limit,
      totalPages: Math.ceil((count + extraUsers.length) / limit),
    });
  } catch (e) {
    console.error('[admin/users] GET threw', e instanceof Error ? e.message : e);
    return NextResponse.json({
      users: [], total: 0, page: 1, limit: 50, totalPages: 0,
      error: e instanceof Error ? e.message : 'Failed',
    }, { status: 500 });
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
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const supabase = getSupabaseAdmin();

    // §13b — every admin write goes into admin_audit_log. Best-effort
    // (never fails the user-visible action), append-only, queryable
    // by target_user_id or admin_id.
    const audit = (action: string, details: Record<string, unknown> = {}) => {
      supabase.from('admin_audit_log').insert({
        admin_id: adminId,
        target_user_id: userId,
        action,
        details,
      }).then(({ error }) => {
        if (error) console.error('[admin/users] audit insert failed', error.message);
      });
    };

    if (action === 'delete') {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await supabase.from('profiles').delete().eq('id', userId);
      audit('delete');
      return NextResponse.json({ success: true, message: 'User deleted' });
    }

    // Ban/unban: use Supabase Auth's built-in `banned_until`. Setting
    // `ban_duration` to a long string ('876000h' = 100 years) is the
    // canonical Supabase pattern; 'none' clears the ban. Previous code
    // updated a non-existent `profiles.status` column and silently
    // failed — admins thought ban was working, it never was.
    if (action === 'ban' || action === 'unban') {
      const ban_duration = action === 'ban' ? '876000h' : 'none';
      // Supabase types are loose around ban_duration; cast at boundary only.
      const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration } as { ban_duration: string });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      audit(action);
      return NextResponse.json({ success: true, banned: action === 'ban' });
    }

    if (action === 'set_role') {
      const role = typeof body.role === 'string' ? body.role : null;
      if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 });
      const allowedRoles = ['user', 'admin', 'moderator'];
      if (!allowedRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      audit('set_role', { role });
      return NextResponse.json({ success: true });
    }

    // Admin tier override: upgrade, downgrade, comp (admin-granted free Max).
    // Sets tier + optional tier_expires_at on the profile. effectiveTier()
    // honours expiry so comps auto-revert when expiry passes.
    //
    // Note: `tier_granted_by` and `tier_granted_reason` columns don't
    // exist on profiles yet. The original code wrote to them and the
    // updates silently failed at the DB level. Keeping the admin-supplied
    // reason on the audit log here would require a migration; for now
    // we just record what we can and log the reason for trace.
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
        .update({ tier, tier_expires_at: expires })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      audit('set_tier', { tier, expires, months, reason: reason ?? null });
      return NextResponse.json({ success: true, tier, tier_expires_at: expires });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/users] POST threw', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
