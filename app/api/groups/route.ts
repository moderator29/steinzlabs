import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { groupAuthUser, slugifyBase, randomCode } from '@/lib/groups/server';

/**
 * Groups list + create.
 *   GET            → { mine: [...], discover: [...] } (my groups + public groups)
 *   POST { name, description?, privacy, avatar_url? } → create a group (creator
 *          becomes owner + first active member)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVACY = ['public', 'invite', 'request'] as const;

export async function GET() {
  const user = await groupAuthUser();
  const db = getSupabaseAdmin();

  let mine: unknown[] = [];
  if (user) {
    const { data: memberships } = await db
      .from('group_members')
      .select('group_id, role, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'invited', 'pending']);
    const ids = (memberships ?? []).map((m) => m.group_id as string);
    if (ids.length) {
      const { data: groups } = await db.from('groups').select('id, name, slug, description, avatar_url, privacy, member_count').in('id', ids);
      const byId = new Map((groups ?? []).map((g) => [g.id, g]));
      mine = (memberships ?? [])
        .map((m) => { const g = byId.get(m.group_id); return g ? { ...g, myRole: m.role, myStatus: m.status } : null; })
        .filter(Boolean);
    }
  }

  const { data: discover } = await db
    .from('groups')
    .select('id, name, slug, description, avatar_url, privacy, member_count')
    .eq('privacy', 'public')
    .order('member_count', { ascending: false })
    .limit(30);

  return NextResponse.json({ mine, discover: discover ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const name = typeof b?.name === 'string' ? b.name.trim().slice(0, 60) : '';
  const description = typeof b?.description === 'string' ? b.description.trim().slice(0, 300) : null;
  const avatar_url = typeof b?.avatar_url === 'string' ? b.avatar_url.slice(0, 500) : null;
  const privacy = PRIVACY.includes(b?.privacy) ? b.privacy : 'public';
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getSupabaseAdmin();
  const rnd = randomBytes(16);
  const slug = `${slugifyBase(name)}-${randomCode(rnd, 5)}`;
  const invite_code = randomCode(randomBytes(16), 10);

  const { data: group, error } = await db
    .from('groups')
    .insert({ owner_id: user.id, name, slug, description, avatar_url, privacy, invite_code })
    .select('id, name, slug, description, avatar_url, privacy, invite_code, member_count')
    .single();
  if (error || !group) return NextResponse.json({ error: error?.message ?? 'Could not create group' }, { status: 500 });

  await db.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'owner', status: 'active' });

  // Optional: invite mutual-follow friends passed by the create flow.
  const inviteIds = Array.isArray(b?.invite) ? (b.invite as unknown[]).filter((x) => typeof x === 'string').slice(0, 50) as string[] : [];
  if (inviteIds.length) {
    const rows = inviteIds.filter((id) => id !== user.id).map((uid) => ({ group_id: group.id, user_id: uid, role: 'member', status: 'invited', invited_by: user.id }));
    if (rows.length) await db.from('group_members').upsert(rows, { onConflict: 'group_id,user_id' });
  }

  return NextResponse.json({ group });
}
