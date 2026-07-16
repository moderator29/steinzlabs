import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { createThesis, deleteThesis, toggleThesisLike, getThesisFeed } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

const MAX_BODY = 500;

/** Thesis feed for a coin. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const thesis = await getThesisFeed(chain, decodeURIComponent(address), 50).catch(() => []);
  return NextResponse.json({ thesis });
}

/** Post a thesis, or like/unlike one. Body: { body } to create, { like: thesisId } to toggle. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const payload = (await req.json().catch(() => ({}))) as { body?: string; like?: string };
  if (payload.like) {
    const res = await toggleThesisLike(user.id, payload.like);
    return NextResponse.json(res);
  }
  const body = (payload.body ?? '').trim();
  if (!body) return NextResponse.json({ error: 'Empty thesis' }, { status: 400 });
  if (body.length > MAX_BODY) return NextResponse.json({ error: 'Thesis too long' }, { status: 400 });
  const created = await createThesis(user.id, chain, decodeURIComponent(address), body);
  if (!created) return NextResponse.json({ error: 'Could not post thesis' }, { status: 500 });
  return NextResponse.json({ id: created.id });
}

/** Soft-delete your own thesis. Body: { id }. */
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await deleteThesis(user.id, id);
  return NextResponse.json({ ok: true });
}
