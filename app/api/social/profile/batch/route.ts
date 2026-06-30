import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/social/profile/batch  body: { ids: string[] }
 *
 * Resolves a batch of user ids to their minimal public profile fields in a
 * single query. Replaces the inbox's per-conversation N+1 of
 * GET /api/social/profile/{id}. Rows where the TARGET has blocked the caller
 * are omitted (mirrors the single-profile 404 visibility rule); the caller's
 * own blocks are NOT redacted here — the inbox still needs the name to render a
 * blocked-conversation row.
 */

const BatchBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

interface BatchProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  // De-dupe ids so a noisy client can't blow past the query.
  const ids = Array.from(new Set(parsed.data.ids));
  const sb = getSupabaseAdmin();

  const { data: rows, error } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drop any profile that has blocked the caller — they shouldn't surface.
  const { data: blocks } = await sb
    .from('social_blocks')
    .select('blocker_id')
    .in('blocker_id', ids)
    .eq('blocked_id', caller.id);
  const blockedByIds = new Set((blocks ?? []).map((b: { blocker_id: string }) => b.blocker_id));

  const profiles: Record<string, BatchProfile> = {};
  for (const r of (rows ?? []) as BatchProfile[]) {
    if (blockedByIds.has(r.id)) continue;
    profiles[r.id] = {
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
    };
  }

  return NextResponse.json({ profiles });
}
