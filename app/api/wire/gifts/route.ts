import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/wire/gifts?recipient=<uuid>&cursor=<iso>
 *
 * Read-only list of gifts RECEIVED by a user, for the profile Gifts sub-tab.
 * Gifts are server-recorded elsewhere; this route only reads them. Only
 * confirmed gifts are surfaced. Cursor-paginated by created_at, newest first.
 */

const PAGE_SIZE = 20;

const SENDER = 'sender:profiles!wire_gifts_sender_id_fkey(id,username,display_name,avatar_url,is_verified)';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const recipient = params.get('recipient');
  const cursor = params.get('cursor');

  if (!recipient || !z.string().uuid().safeParse(recipient).success) {
    return NextResponse.json({ error: 'Invalid recipient id' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  let q = sb
    .from('wire_gifts')
    .select(`id, post_id, chain, token_symbol, amount, amount_usd, status, created_at, ${SENDER}`)
    .eq('recipient_id', recipient)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) q = q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gifts = Array.isArray(data) ? data : [];
  const nextCursor = gifts.length === PAGE_SIZE ? gifts[gifts.length - 1]?.created_at ?? null : null;
  return NextResponse.json({ gifts, nextCursor });
}
