import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * The Wire — mute another user.
 *
 * POST   /api/wire/mute   body { userId }   mute (idempotent)
 * DELETE /api/wire/mute   body { userId }   unmute
 * GET    /api/wire/mute                     list the caller's muted user ids
 *
 * Owner-scoped: muter_id is always the session user. Muting hides that user's
 * wires and reposts from the caller's feed (applied in /api/wire/posts). You
 * cannot mute yourself. Writes go through the service-role client with an
 * explicit user-id bind (never trust the client for muter_id).
 */

const Body = z.object({ userId: z.string().uuid() });

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('wire_mutes').select('muted_id').eq('muter_id', user.id);
  return NextResponse.json({ muted: (data ?? []).map((r: { muted_id: string }) => r.muted_id) });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const { userId } = parsed.data;
  if (userId === user.id) return NextResponse.json({ error: 'You cannot mute yourself' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('wire_mutes')
    .upsert({ muter_id: user.id, muted_id: userId }, { onConflict: 'muter_id,muted_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ muted: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const { userId } = parsed.data;

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('wire_mutes')
    .delete()
    .eq('muter_id', user.id)
    .eq('muted_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ muted: false });
}
