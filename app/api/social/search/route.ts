import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/social/search?q=...&limit=10
 *
 * Live autocomplete over username + display_name. Hides users blocked
 * by the caller. Returns top N by relevance (currently simple
 * case-insensitive prefix match — upgrade to pg_trgm similarity when
 * the user table exceeds a few thousand rows).
 */

const Schema = z.object({
  q: z.string().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function GET(req: NextRequest) {
  const parsed = Schema.safeParse({
    q: req.nextUrl.searchParams.get('q'),
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ users: [] });
  const caller = await getAuthenticatedUser(req);
  const sb = getSupabaseAdmin();

  const escaped = parsed.data.q.replace(/[%_]/g, (m) => `\\${m}`);
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url, tier, verified_badge, is_chosen')
    .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
    .limit(parsed.data.limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let users = data ?? [];
  if (caller && users.length) {
    const ids = users.map((u) => u.id);
    const { data: blocks } = await sb
      .from('social_blocks')
      .select('blocked_id, blocker_id')
      .or(`and(blocker_id.eq.${caller.id},blocked_id.in.(${ids.join(',')})),and(blocked_id.eq.${caller.id},blocker_id.in.(${ids.join(',')}))`);
    const hidden = new Set((blocks ?? []).map((b) => (b.blocker_id === caller.id ? b.blocked_id : b.blocker_id)));
    users = users.filter((u) => !hidden.has(u.id));
  }
  return NextResponse.json({ users });
}
