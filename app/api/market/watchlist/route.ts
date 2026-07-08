import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

// The watchlist belongs to a single user. Every method derives the owner from
// the authenticated session, never from a client-supplied id, so no caller can
// read, add, or delete another user's rows. A missing/invalid session fails
// closed with 401 (previously GET fell open for anonymous callers and POST /
// DELETE trusted the body/query id with no auth at all).
export async function GET(req: NextRequest) {
  const authedUser = await getAuthenticatedUser(req).catch(() => null);
  if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data } = await db.from('watchlist').select('token_id, added_at').eq('user_id', authedUser.id);
  return NextResponse.json({ watchlist: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthenticatedUser(req).catch(() => null);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tokenId } = await req.json() as { tokenId: string };
    if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 });

    const db = getSupabaseAdmin();
    const { error } = await db.from('watchlist').upsert({ user_id: authedUser.id, token_id: tokenId });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authedUser = await getAuthenticatedUser(req).catch(() => null);
  if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tokenId = req.nextUrl.searchParams.get('tokenId');
  if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('watchlist').delete().eq('user_id', authedUser.id).eq('token_id', tokenId);
  return NextResponse.json({ success: true });
}
