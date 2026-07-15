import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { profileId }: count a real profile view via the bump_profile_view RPC.
 * Self-views (the owner opening their own profile) are not counted. When a
 * signed-in viewer is present we mark them as a distinct viewer.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!UUID_RE.test(profileId)) {
    return NextResponse.json({ error: 'Invalid profileId' }, { status: 400 });
  }

  // Do not inflate a user's own view count when they open their own profile.
  const viewer = await getAuthenticatedUser(req);
  if (viewer && viewer.id === profileId) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('bump_profile_view', {
    p_profile: profileId,
    p_new_viewer: !!viewer,
  });
  if (error) return NextResponse.json({ error: 'Could not record view' }, { status: 500 });

  return NextResponse.json({ ok: true, counted: true });
}
