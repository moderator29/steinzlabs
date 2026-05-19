import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ target_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  if (parsed.data.target_id === user.id) return NextResponse.json({ error: 'Cannot mute yourself' }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from('social_mutes')
    .upsert({ muter_id: user.id, muted_id: parsed.data.target_id }, { onConflict: 'muter_id,muted_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const targetId = req.nextUrl.searchParams.get('target_id');
  if (!targetId || !z.string().uuid().safeParse(targetId).success) {
    return NextResponse.json({ error: 'Invalid target_id' }, { status: 400 });
  }
  const { error } = await getSupabaseAdmin()
    .from('social_mutes')
    .delete()
    .eq('muter_id', user.id)
    .eq('muted_id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
