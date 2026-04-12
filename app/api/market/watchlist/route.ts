import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ watchlist: [] });
  const db = getSupabaseAdmin();
  const { data } = await db.from('watchlist').select('token_id, added_at').eq('user_id', userId);
  return NextResponse.json({ watchlist: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, tokenId } = await req.json() as { userId: string; tokenId: string };
    if (!userId || !tokenId) return NextResponse.json({ error: 'userId and tokenId required' }, { status: 400 });

    const db = getSupabaseAdmin();
    const { error } = await db.from('watchlist').upsert({ user_id: userId, token_id: tokenId });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const tokenId = req.nextUrl.searchParams.get('tokenId');
  if (!userId || !tokenId) return NextResponse.json({ error: 'userId and tokenId required' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('watchlist').delete().eq('user_id', userId).eq('token_id', tokenId);
  return NextResponse.json({ success: true });
}
