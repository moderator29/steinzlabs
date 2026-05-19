import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/social/keypair   body: { public_key, encrypted_private_key }
 *
 * Called once on first DM-feature use to publish the user's libsodium
 * box public key and a wallet-derived-secret-encrypted private key.
 * Private key is wrapped client-side via lib/social/encryption.ts —
 * the server stores ciphertext only.
 *
 * GET /api/social/keypair?user_id=<uuid>  -> returns just public_key
 *   for the named user. Used by the client when initializing a new
 *   conversation to seal the symmetric key to the recipient.
 *
 * GET /api/social/keypair (no params) -> returns the caller's own
 *   public_key + encrypted_private_key so the client can unwrap on
 *   login.
 */

const Body = z.object({
  public_key: z.string().min(32).max(128),
  encrypted_private_key: z.string().min(32).max(512),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({
      public_key: parsed.data.public_key,
      encrypted_private_key: parsed.data.encrypted_private_key,
    })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const targetId = req.nextUrl.searchParams.get('user_id');

  if (targetId) {
    if (!z.string().uuid().safeParse(targetId).success) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, public_key')
      .eq('id', targetId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.public_key) return NextResponse.json({ error: 'No published key' }, { status: 404 });
    return NextResponse.json({ user_id: data.id, public_key: data.public_key });
  }

  // Caller fetching own wrapped private key
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('public_key, encrypted_private_key')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    public_key: data?.public_key ?? null,
    encrypted_private_key: data?.encrypted_private_key ?? null,
  });
}
