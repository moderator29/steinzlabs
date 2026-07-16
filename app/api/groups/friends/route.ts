import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { groupAuthUser, friendsAllowingInvites } from '@/lib/groups/server';

/**
 * Friends (mutual follows) who currently allow group invites — for the create
 * flow and the group invite picker.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await groupAuthUser();
  if (!user) return NextResponse.json({ friends: [] });
  const ids = await friendsAllowingInvites(user.id);
  if (ids.length === 0) return NextResponse.json({ friends: [] });
  const db = getSupabaseAdmin();
  const { data } = await db.from('profiles').select('id, username, display_name, avatar_url, tier').in('id', ids).limit(200);
  return NextResponse.json({ friends: data ?? [] });
}
