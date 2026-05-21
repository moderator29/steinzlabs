import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { buildCancelTx, buildSpeedupTx } from '@/lib/trading/cancelReplace';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-D.3 — POST /api/trading/cancel-tx
 *
 * body { tx_hash, chain, action: 'cancel'|'speedup', gas_multiplier? }
 * Returns the unsigned tx body the client should sign + broadcast.
 *
 * After the client broadcasts, it should POST again with
 * { tx_hash, replacement_tx, chain, action } so we log into
 * tx_replacements (best-effort — we use the existence of replacement_tx
 * as the "record" intent).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    tx_hash?: string; chain?: string; action?: string;
    gas_multiplier?: number; replacement_tx?: string;
  };
  if (!body.tx_hash || !body.chain || !body.action) {
    return NextResponse.json({ error: 'tx_hash, chain, action required' }, { status: 400 });
  }
  if (!['cancel', 'speedup'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be cancel | speedup' }, { status: 400 });
  }

  // If the client is reporting a completed replacement, log it.
  if (body.replacement_tx) {
    const admin = getSupabaseAdmin();
    await admin.from('tx_replacements').insert({
      user_id: user.id,
      chain: body.chain.toLowerCase(),
      original_tx: body.tx_hash,
      replacement_tx: body.replacement_tx,
      nonce: 0,   // filled by reconciliation if needed
      action: body.action,
      status: 'pending',
    });
    return NextResponse.json({ ok: true });
  }

  const built = body.action === 'cancel'
    ? await buildCancelTx(body.tx_hash, body.chain, body.gas_multiplier)
    : await buildSpeedupTx(body.tx_hash, body.chain, body.gas_multiplier);
  if (!built) return NextResponse.json({ error: 'original tx not found' }, { status: 404 });

  return NextResponse.json({ tx: built });
}
