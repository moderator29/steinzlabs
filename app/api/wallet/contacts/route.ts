import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Wallet address book.
 *   GET    -> caller's saved contacts
 *   POST   -> { label, address, chain? } save/upsert a contact
 *   DELETE ?id=<uuid>
 */

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('user_wallet_contacts')
    .select('id, label, address, chain, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

const PostBody = z.object({
  label: z.string().min(1).max(60),
  address: z.string().min(20).max(120),
  chain: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('user_wallet_contacts')
    .upsert({ user_id: user.id, label: parsed.data.label, address: parsed.data.address, chain: parsed.data.chain ?? null }, { onConflict: 'user_id,address,chain' })
    .select('id, label, address, chain, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('user_wallet_contacts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
