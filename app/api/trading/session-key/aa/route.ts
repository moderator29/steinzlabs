import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateSessionKey, getZeroDevRpc, aaChainFor } from '@/lib/wallet/sessionKeyAA';
import { encryptServerSecret, vaultConfigured } from '@/lib/wallet/serverKeyVault';

/**
 * AA session-key lifecycle (#41), two steps:
 *
 *   step:'init'    → server generates a fresh session keypair, encrypts the
 *                    private key at rest, and stores a PENDING row (no approval
 *                    yet). Returns the session ADDRESS + validUntil for the
 *                    client to authorize. The private key never leaves the
 *                    server, and is a LIMITED session key (never a main key).
 *   step:'approve' → client posts back the owner-signed serialized permission
 *                    approval + kernel address; the row becomes active and the
 *                    background sniper cron can execute capped, expiring buys.
 *
 * Dormant unless the owner has set SESSION_KEY_ENCRYPTION_SECRET and a ZeroDev
 * RPC for the chain — otherwise returns 503 and the UI falls back to one-tap.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AA_CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'];

/**
 * Config self-check (#41). GET → which prerequisites for background (AA)
 * sniping are wired, without leaking any secret value. Lets the owner confirm
 * SESSION_KEY_ENCRYPTION_SECRET + a ZeroDev RPC are set after deploying.
 *   curl https://<host>/api/trading/session-key/aa
 */
export function GET() {
  const chains: Record<string, boolean> = {};
  for (const c of AA_CHAINS) chains[c] = !!getZeroDevRpc(c);
  const anyChain = Object.values(chains).some(Boolean);
  const vault = vaultConfigured();
  return NextResponse.json({
    ready: vault && anyChain,
    vaultConfigured: vault,
    chains,
    note: vault && anyChain
      ? 'Background sniping is configured.'
      : 'Set SESSION_KEY_ENCRYPTION_SECRET and at least one ZERODEV_RPC[_CHAIN], then redeploy.',
  });
}

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

interface Body {
  step?: 'init' | 'approve';
  chain?: string;
  main_address?: string;
  max_per_trade_usd?: number;
  daily_cap_usd?: number;
  max_trades_per_day?: number;
  hours?: number;
  // approve step:
  id?: string;
  approval?: string;
  kernel_address?: string;
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const admin = getSupabaseAdmin();

  if (body.step === 'approve') {
    if (!body.id || !body.approval || !body.kernel_address) {
      return NextResponse.json({ error: 'id, approval, kernel_address required' }, { status: 400 });
    }
    const { error } = await admin
      .from('user_session_keys')
      .update({ approval: body.approval, kernel_address: body.kernel_address })
      .eq('id', body.id)
      .eq('user_id', user.id)
      .is('revoked_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // step: 'init' (default)
  const chain = (body.chain ?? '').toLowerCase();
  if (!aaChainFor(chain)) {
    return NextResponse.json({ error: `AA session keys are EVM-only; unsupported chain: ${chain}` }, { status: 400 });
  }
  if (!vaultConfigured() || !getZeroDevRpc(chain)) {
    return NextResponse.json(
      { error: 'Background (AA) sniping is not configured on this deployment.' },
      { status: 503 },
    );
  }
  if (!body.main_address) return NextResponse.json({ error: 'main_address required' }, { status: 400 });
  const maxPerTrade = Number(body.max_per_trade_usd);
  const dailyCap = Number(body.daily_cap_usd);
  if (!(maxPerTrade > 0) || !(dailyCap > 0)) {
    return NextResponse.json({ error: 'max_per_trade_usd and daily_cap_usd must be positive' }, { status: 400 });
  }
  const hours = Math.max(1, Math.min(168, body.hours ?? 24));
  const validUntil = Math.floor(Date.now() / 1000) + hours * 3600;
  const maxTradesPerDay = Math.max(1, Math.min(500, Math.floor(body.max_trades_per_day ?? 20)));

  const session = generateSessionKey();
  let encrypted: string;
  try {
    encrypted = encryptServerSecret(session.privateKey);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'vault error' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('user_session_keys')
    .insert({
      user_id: user.id,
      session_address: session.address,
      main_address: body.main_address,
      chain,
      max_per_trade_usd: maxPerTrade,
      daily_cap_usd: dailyCap,
      encrypted_session_key: encrypted,
      key_version: 1,
      expires_at: new Date(validUntil * 1000).toISOString(),
    })
    .select('id, session_address')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id: data.id,
    session_address: data.session_address,
    valid_until: validUntil,
    max_trades_per_day: maxTradesPerDay,
  });
}
