import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { groupAuthUser, membershipOf, isActive, isManager } from '@/lib/groups/server';
import { createUserNotification } from '@/lib/social/subscriberNotify';

/**
 * Group membership actions. [id] is the group UUID.
 *   GET  → active members (managers also see pending/invited)
 *   POST { action, userId?, code? }
 *     join           self joins a public group (or via a valid invite code)
 *     request        self requests to join a 'request' group (pending)
 *     accept_invite  self accepts an invitation
 *     leave          self leaves
 *     invite [userIds]   manager invites friends
 *     approve userId manager approves a pending request
 *     remove  userId manager removes a member
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function loadGroup(id: string) {
  const db = getSupabaseAdmin();
  const { data } = await db.from('groups').select('id, name, slug, privacy, invite_code, owner_id').eq('id', id).maybeSingle();
  return data;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ members: [] });
  const me = await membershipOf(id, user.id);
  if (!isActive(me)) return NextResponse.json({ members: [] });
  const db = getSupabaseAdmin();
  const statuses = isManager(me) ? ['active', 'pending', 'invited'] : ['active'];
  const { data: rows } = await db.from('group_members').select('user_id, role, status, created_at').eq('group_id', id).in('status', statuses).order('created_at', { ascending: true }).limit(500);
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profs } = ids.length ? await db.from('profiles').select('id, username, display_name, avatar_url, tier').in('id', ids) : { data: [] };
  const pById = new Map((profs ?? []).map((p) => [p.id, p]));
  const members = (rows ?? []).map((r) => ({ ...r, profile: pById.get(r.user_id) ?? null }));
  return NextResponse.json({ members, canManage: isManager(me) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const group = await loadGroup(id);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => null);
  const action = b?.action as string;
  const db = getSupabaseAdmin();
  const me = await membershipOf(id, user.id);

  if (action === 'join') {
    const codeOk = typeof b?.code === 'string' && b.code === group.invite_code;
    if (group.privacy === 'request' && !codeOk) return NextResponse.json({ error: 'Requires approval' }, { status: 400 });
    if (group.privacy === 'invite' && !codeOk && me?.status !== 'invited') return NextResponse.json({ error: 'Invite only' }, { status: 403 });
    await db.from('group_members').upsert({ group_id: id, user_id: user.id, role: 'member', status: 'active' }, { onConflict: 'group_id,user_id' });
    return NextResponse.json({ status: 'active' });
  }
  if (action === 'request') {
    if (isActive(me)) return NextResponse.json({ status: 'active' });
    await db.from('group_members').upsert({ group_id: id, user_id: user.id, role: 'member', status: 'pending' }, { onConflict: 'group_id,user_id' });
    // Ping the owner that someone requested.
    void createUserNotification({ userId: group.owner_id, type: 'group.request', title: `Join request`, body: `Someone asked to join ${group.name}.`, url: `/dashboard/groups/${group.slug}/settings`, metadata: { group_id: id } });
    return NextResponse.json({ status: 'pending' });
  }
  if (action === 'accept_invite') {
    if (me?.status !== 'invited') return NextResponse.json({ error: 'No invite' }, { status: 400 });
    await db.from('group_members').update({ status: 'active' }).eq('group_id', id).eq('user_id', user.id);
    return NextResponse.json({ status: 'active' });
  }
  if (action === 'leave') {
    if (group.owner_id === user.id) return NextResponse.json({ error: 'Owner cannot leave; delete or transfer' }, { status: 400 });
    await db.from('group_members').delete().eq('group_id', id).eq('user_id', user.id);
    return NextResponse.json({ status: 'left' });
  }

  // Manager-only actions below.
  if (!isManager(me)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'invite') {
    const userIds = Array.isArray(b?.userIds) ? (b.userIds as unknown[]).filter((x) => typeof x === 'string').slice(0, 50) as string[] : [];
    const rows = userIds.filter((u) => u !== user.id).map((uid) => ({ group_id: id, user_id: uid, role: 'member', status: 'invited', invited_by: user.id }));
    if (rows.length) {
      await db.from('group_members').upsert(rows, { onConflict: 'group_id,user_id' });
      await Promise.allSettled(rows.map((r) => createUserNotification({ userId: r.user_id, type: 'group.invite', title: `Group invite`, body: `You were invited to ${group.name}.`, url: `/dashboard/groups/${group.slug}`, metadata: { group_id: id } })));
    }
    return NextResponse.json({ invited: rows.length });
  }
  if (action === 'approve') {
    const uid = b?.userId as string;
    if (uid) await db.from('group_members').update({ status: 'active' }).eq('group_id', id).eq('user_id', uid).eq('status', 'pending');
    return NextResponse.json({ ok: true });
  }
  if (action === 'remove') {
    const uid = b?.userId as string;
    if (uid && uid !== group.owner_id) await db.from('group_members').delete().eq('group_id', id).eq('user_id', uid);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
