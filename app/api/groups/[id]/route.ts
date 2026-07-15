import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { groupAuthUser, membershipOf, isManager } from '@/lib/groups/server';

/** Group detail (by id OR slug), settings update, delete. */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PRIVACY = ['public', 'invite', 'request'];

async function resolveGroup(idOrSlug: string) {
  const db = getSupabaseAdmin();
  const q = db.from('groups').select('id, owner_id, name, slug, description, avatar_url, privacy, invite_code, member_count, created_at');
  const { data } = UUID_RE.test(idOrSlug) ? await q.eq('id', idOrSlug).maybeSingle() : await q.eq('slug', idOrSlug).maybeSingle();
  return data;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  const group = await resolveGroup(id);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = getSupabaseAdmin();
  const membership = user ? await membershipOf(group.id, user.id) : null;
  const { data: owner } = await db.from('profiles').select('id, username, display_name, avatar_url').eq('id', group.owner_id).maybeSingle();
  // Never leak the invite code to non-managers.
  const canManage = isManager(membership);
  const safe = { ...group, invite_code: canManage ? group.invite_code : undefined };
  return NextResponse.json({ group: safe, membership, owner: owner ?? null });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const group = await resolveGroup(id);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const m = await membershipOf(group.id, user.id);
  if (!isManager(m)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof b?.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 60);
  if (typeof b?.description === 'string') patch.description = b.description.trim().slice(0, 300);
  if (typeof b?.avatar_url === 'string') patch.avatar_url = b.avatar_url.slice(0, 500);
  if (PRIVACY.includes(b?.privacy)) patch.privacy = b.privacy;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('groups').update(patch).eq('id', group.id).select('id, name, slug, description, avatar_url, privacy, member_count').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const group = await resolveGroup(id);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (group.owner_id !== user.id) return NextResponse.json({ error: 'Only the owner can delete' }, { status: 403 });
  const db = getSupabaseAdmin();
  await db.from('groups').delete().eq('id', group.id);
  return NextResponse.json({ ok: true });
}
