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

  // Only signed-in viewers count, and only once per profile per day, so the
  // number cannot be inflated by anonymous or repeated requests.
  const viewer = await getAuthenticatedUser(req);
  if (!viewer || viewer.id === profileId) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  // Claim a (profile, viewer, day) slot; a conflict means already counted today.
  const { data: claim } = await sb
    .from('profile_view_log')
    .upsert({ profile_id: profileId, viewer_id: viewer.id, day: today }, { onConflict: 'profile_id,viewer_id,day', ignoreDuplicates: true })
    .select('profile_id');
  const isNewToday = Array.isArray(claim) && claim.length > 0;
  if (!isNewToday) return NextResponse.json({ ok: true, counted: false });

  const { error } = await sb.rpc('bump_profile_view', { p_profile: profileId, p_new_viewer: true });
  if (error) return NextResponse.json({ error: 'Could not record view' }, { status: 500 });
  return NextResponse.json({ ok: true, counted: true });
}
