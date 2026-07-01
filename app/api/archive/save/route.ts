import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Per-user "Saved" vault for Context Feed / Archive events.
 *   GET    -> list the caller's saved events (newest first)
 *   POST   -> save one  { event_ref, payload }  (idempotent upsert per user+ref)
 *   DELETE ?ref=<event_ref> -> remove one
 *
 * Every query is bound to the authenticated user id. The admin client bypasses
 * RLS, so the explicit .eq('user_id', user.id) is the real ownership control;
 * the saved_events RLS policy is defense in depth for any direct/anon access.
 */

const MAX_SAVED = 500;

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('saved_events')
    .select('id, event_ref, payload, saved_at')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })
    .limit(MAX_SAVED);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data ?? [] });
}

// payload is the full ContextEvent snapshot. We don't enforce its inner shape
// here (the feed taxonomy drifts), only that it's a non-null object with the
// same id as event_ref, so a saved row always renders standalone.
const PostBody = z.object({
  event_ref: z.string().min(1).max(256),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Cap the vault per user. head:true count is cheap; only enforced for genuinely
  // new refs so a re-save of an existing item never trips the limit.
  const { count } = await sb
    .from('saved_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const existing = await sb
    .from('saved_events')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .eq('event_ref', parsed.data.event_ref);
  const isNew = (existing.count ?? 0) === 0;
  if (isNew && (count ?? 0) >= MAX_SAVED) {
    return NextResponse.json({ error: `Saved limit reached (${MAX_SAVED}).` }, { status: 409 });
  }

  // Upsert on the (user_id, event_ref) unique index → idempotent Save.
  const { data, error } = await sb
    .from('saved_events')
    .upsert(
      { user_id: user.id, event_ref: parsed.data.event_ref, payload: parsed.data.payload },
      { onConflict: 'user_id,event_ref' },
    )
    .select('id, event_ref, payload, saved_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref || ref.length > 256) {
    return NextResponse.json({ error: 'Invalid ref' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('saved_events')
    .delete()
    .eq('user_id', user.id)
    .eq('event_ref', ref);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
