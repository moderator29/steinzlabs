import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  notify_new_follower:    z.boolean().optional(),
  notify_dm_received:     z.boolean().optional(),
  notify_mentioned:       z.boolean().optional(),
  notify_follow_request:  z.boolean().optional(),
  email_notifications:    z.boolean().optional(),
  push_notifications:     z.boolean().optional(),
  telegram_notifications: z.boolean().optional(),
  news_email_enabled:     z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('social_notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ prefs: data ?? null });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('social_notification_preferences')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
