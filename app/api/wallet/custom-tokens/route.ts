import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';

// Server-side persistence + cross-device sync for the wallet "Add Custom Token"
// feature (was localStorage-only, so a cache clear lost every addition). Tokens
// are stored in user_custom_tokens keyed by (user_id, chain, contract) and
// surfaced to the client as "<chain>:<contract>" keys — the exact format the
// wallet-page hydrator splits on.

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {}, remove() {},
      },
    },
  );
}

/** Parse a "<chain>:<contract>" key into its parts, chain-aware normalized. */
function parseKey(key: string): { chain: string; contract: string } | null {
  const sep = key.indexOf(':');
  if (sep <= 0) return null;
  const chain = key.slice(0, sep).trim();
  const contract = key.slice(sep + 1).trim();
  if (!chain || !contract) return null;
  return { chain, contract: normalizeAddress(contract, chain) };
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tokens: [] }, { status: 401 });

  const { data, error } = await supabase
    .from('user_custom_tokens')
    .select('chain, contract')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tokens = (data ?? []).map((r) => `${r.chain}:${r.contract}`);
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { key?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  const parsed = body.key ? parseKey(body.key) : null;
  if (!parsed) return NextResponse.json({ error: 'Invalid token key (expected "<chain>:<contract>")' }, { status: 400 });

  // RLS (user_id = auth.uid()) enforces ownership; the upsert is idempotent on
  // (user_id, chain, contract).
  const { error } = await supabase
    .from('user_custom_tokens')
    .upsert({ user_id: user.id, chain: parsed.chain, contract: parsed.contract }, { onConflict: 'user_id,chain,contract' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseKey(request.nextUrl.searchParams.get('key') ?? '');
  if (!parsed) return NextResponse.json({ error: 'Invalid token key' }, { status: 400 });

  const { error } = await supabase
    .from('user_custom_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('chain', parsed.chain)
    .eq('contract', parsed.contract);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
