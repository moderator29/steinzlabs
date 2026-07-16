import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { addWatch, removeWatch, getWatchlistKeys } from '@/lib/coins/social';
import { isCoinChain } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

/** The caller's watchlisted coin keys (chain:token_key). */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ keys: [] });
  const keys = await getWatchlistKeys(user.id);
  return NextResponse.json({ keys: [...keys] });
}

/** Toggle a coin on the watchlist. Body: { chain, address, on }. */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { chain, address, on } = (await req.json().catch(() => ({}))) as { chain?: string; address?: string; on?: boolean };
  if (!chain || !isCoinChain(chain) || !address) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (on === false) await removeWatch(user.id, chain, address);
  else await addWatch(user.id, chain, address);
  return NextResponse.json({ ok: true, on: on !== false });
}
