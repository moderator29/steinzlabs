import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * Smart-money (moneyRadar) follow — rebuilt on the canonical user_whale_follows
 * table (the same store the whale tracker uses), replacing the retired,
 * Arkham-backed followed_entities path. A smart-money entity IS a whale row, so
 * following one persists a whale follow; the existing whale-alert-dispatcher
 * then monitors it — no separate moneyRadar monitor needed.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ followed: [] });
  const { data } = await sb
    .from('user_whale_follows')
    .select('whale_id, whale_address, chain')
    .eq('user_id', user.id);
  // The /smart-money page keys its followed set by address; also return whale_id
  // for callers that track the entity id.
  const followed = (data ?? []).map((r) => ({
    entity_id: (r as { whale_id: string | null }).whale_id,
    address: (r as { whale_address: string }).whale_address,
    chain: (r as { chain: string }).chain,
  }));
  return NextResponse.json({ followed });
}

export async function POST(request: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    entityId?: string; entityName?: string; entityType?: string; address?: string; chain?: string;
  };
  const address = (body.address ?? '').trim();
  const chain = (body.chain ?? '').trim().toLowerCase();
  if (!address || !chain) {
    return NextResponse.json({ error: 'address and chain required' }, { status: 400 });
  }
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
  const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (!isEvm && !isSol) return NextResponse.json({ error: 'invalid address' }, { status: 400 });

  const { error } = await sb.from('user_whale_follows').upsert({
    user_id: user.id,
    whale_id: body.entityId && UUID_RE.test(body.entityId) ? body.entityId : null,
    whale_address: normalizeAddress(address, chain),
    chain,
    label: body.entityName ?? null,
    alert_enabled: true,
    alert_channels: ['push'],
  }, { onConflict: 'user_id,whale_address,chain' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
