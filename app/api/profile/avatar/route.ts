import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Profile avatar / cover upload — SERVER-SIDE so it can never fail on a client
 * storage-RLS/session edge (the direct browser upload was returning 400s on
 * iOS). The browser sends the already-downscaled image as a base64 data URL;
 * we authenticate via the session cookie, then upload with the service-role
 * client (RLS-exempt) into avatars/<uid>/<kind>-<ts>.<ext> and mirror the URL
 * onto the profiles row so it shows everywhere. Only the signed-in user's own
 * <uid> folder is ever written, so a user can never overwrite another's image.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024; // mirrors the avatars bucket cap

export async function POST(req: NextRequest) {
  // 1) Authenticate the caller from the session cookie.
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2) Parse + validate the payload.
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const dataUrl: string | undefined = body?.dataUrl;
  if (kind !== 'avatar' && kind !== 'cover') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }
  const m = typeof dataUrl === 'string' ? dataUrl.match(/^data:([^;]+);base64,(.+)$/) : null;
  if (!m) return NextResponse.json({ error: 'Invalid image payload' }, { status: 400 });

  const mime = m[1];
  const ext = MIME_EXT[mime];
  if (!ext) return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });

  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.byteLength === 0) return NextResponse.json({ error: 'Empty image' }, { status: 400 });
  if (buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 });

  // 3) Upload with the service-role client (RLS-exempt). A timestamped name
  //    both cache-busts and sidesteps any upsert edge case.
  const admin = getSupabaseAdmin();
  const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, buffer, { contentType: mime, cacheControl: '3600', upsert: true });
  if (upErr) {
    return NextResponse.json({ error: upErr.message || 'Upload failed' }, { status: 500 });
  }

  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl;

  // 4) Mirror onto the profiles row so it persists + shows on every surface.
  const metaKey = kind === 'avatar' ? 'avatar_url' : 'cover_url';
  await admin.from('profiles').update({ [metaKey]: url }).eq('id', user.id);

  return NextResponse.json({ url });
}
