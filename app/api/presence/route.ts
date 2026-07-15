import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyCameOnline } from '@/lib/social/subscriberNotify';

/**
 * Presence. The client heartbeats POST here every ~60s while the app is open;
 * we stamp last_seen_at. "Online" is derived as last_seen within ONLINE_WINDOW.
 *   POST            → heartbeat (upsert my last_seen_at = now)
 *   GET ?ids=a,b,c  → { online: { id: bool } } for the requested users
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ONLINE_WINDOW_MS = 3 * 60 * 1000; // seen within 3 min ⇒ online

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

const ONLINE_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // don't re-alert within 30 min

export async function POST() {
  const user = await authUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getSupabaseAdmin();
  const now = Date.now();

  // Read the prior heartbeat to detect an offline → online transition.
  const { data: prev } = await db
    .from('user_presence')
    .select('last_seen_at, online_notified_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const wasOffline = !prev || (now - new Date(prev.last_seen_at as string).getTime()) > ONLINE_WINDOW_MS;
  const cooledDown = !prev?.online_notified_at || (now - new Date(prev.online_notified_at as string).getTime()) > ONLINE_NOTIFY_COOLDOWN_MS;
  const cameOnline = wasOffline && cooledDown;

  await db.from('user_presence').upsert(
    { user_id: user.id, last_seen_at: new Date(now).toISOString(), ...(cameOnline ? { online_notified_at: new Date(now).toISOString() } : {}) },
    { onConflict: 'user_id' },
  );

  // On a genuine come-online, ping subscribers who asked. Fire-and-forget.
  if (cameOnline) {
    const { data: prof } = await db.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle();
    void notifyCameOnline({ userId: user.id, name: prof?.display_name || prof?.username || 'Someone', username: prof?.username ?? null });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ online: {} });
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ online: {} });
  const db = getSupabaseAdmin();
  const { data } = await db.from('user_presence').select('user_id, last_seen_at').in('user_id', ids);
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const online: Record<string, boolean> = {};
  for (const r of data ?? []) online[r.user_id as string] = new Date(r.last_seen_at as string).getTime() >= cutoff;
  return NextResponse.json({ online });
}
