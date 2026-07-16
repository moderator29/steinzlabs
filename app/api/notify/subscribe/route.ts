import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Per-user notify subscription (the profile "bell"). A user opts into another
 * user's activity: notify_posts (their new wires) and/or notify_online (a ping
 * when they come online). Owner-scoped: subscriber_id is always the session user.
 *   GET    ?target=<id>  → { subscribed, notify_posts, notify_online }
 *   POST   { target_id, notify_posts?, notify_online? } → upsert
 *   DELETE ?target=<id>  → remove
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authUser() {
  const store = await cookies();
  const c = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => store.get(n)?.value, set() {}, remove() {} } },
  );
  const { data: { user } } = await c.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await authUser();
  const target = req.nextUrl.searchParams.get('target');
  if (!user || !target) return NextResponse.json({ subscribed: false, notify_posts: false, notify_online: false });
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('user_notify_subscriptions')
    .select('notify_posts, notify_online')
    .eq('subscriber_id', user.id)
    .eq('target_id', target)
    .maybeSingle();
  return NextResponse.json({
    subscribed: !!data,
    notify_posts: data?.notify_posts ?? false,
    notify_online: data?.notify_online ?? false,
  });
}

export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const target = typeof b?.target_id === 'string' ? b.target_id : '';
  if (!target || target === user.id) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  const notify_posts = b?.notify_posts !== false; // default on
  const notify_online = b?.notify_online === true;
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('user_notify_subscriptions')
    .upsert({ subscriber_id: user.id, target_id: target, notify_posts, notify_online }, { onConflict: 'subscriber_id,target_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscribed: true, notify_posts, notify_online });
}

export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const target = req.nextUrl.searchParams.get('target');
  if (!target) return NextResponse.json({ error: 'Missing target' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('user_notify_subscriptions').delete().eq('subscriber_id', user.id).eq('target_id', target);
  return NextResponse.json({ subscribed: false });
}
