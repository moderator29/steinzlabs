import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { groupAuthUser, membershipOf, isActive } from '@/lib/groups/server';

/**
 * Group messages / posts. [id] is the group UUID. Active members only.
 *   GET ?cursor= → latest messages (newest first) with author profiles
 *   POST { body, media_urls? } → send a message
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAGE = 30;
const WIRE_MEDIA_MARKER = '/storage/v1/object/public/wire-media/';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ messages: [], reason: 'auth' });
  const me = await membershipOf(id, user.id);
  if (!isActive(me)) return NextResponse.json({ messages: [], reason: 'not_member' });

  const db = getSupabaseAdmin();
  const cursor = req.nextUrl.searchParams.get('cursor');
  let q = db.from('group_messages').select('id, author_id, body, media_urls, reply_to, created_at').eq('group_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(PAGE + 1);
  if (cursor) q = q.lt('created_at', cursor);
  const { data: rows } = await q;
  const list = (rows ?? []).slice(0, PAGE);
  const nextCursor = (rows ?? []).length > PAGE ? list[list.length - 1]?.created_at : null;
  const ids = Array.from(new Set(list.map((r) => r.author_id as string)));
  const { data: profs } = ids.length ? await db.from('profiles').select('id, username, display_name, avatar_url, tier').in('id', ids) : { data: [] };
  const pById = new Map((profs ?? []).map((p) => [p.id, p]));
  const messages = list.map((r) => ({ ...r, author: pById.get(r.author_id) ?? null })).reverse(); // oldest-first for chat render
  return NextResponse.json({ messages, nextCursor });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await membershipOf(id, user.id);
  if (!isActive(me)) return NextResponse.json({ error: 'Join the group to post' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const body = typeof b?.body === 'string' ? b.body.trim().slice(0, 4000) : '';
  const media = Array.isArray(b?.media_urls)
    ? (b.media_urls as unknown[]).filter((u): u is string => typeof u === 'string' && u.includes(WIRE_MEDIA_MARKER)).slice(0, 4)
    : [];
  if (!body && media.length === 0) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('group_messages').insert({ group_id: id, author_id: user.id, body, media_urls: media }).select('id, author_id, body, media_urls, reply_to, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: prof } = await db.from('profiles').select('id, username, display_name, avatar_url, tier').eq('id', user.id).maybeSingle();
  return NextResponse.json({ message: { ...data, author: prof ?? null } });
}
