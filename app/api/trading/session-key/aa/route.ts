import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ethers } from 'ethers';
import { privateKeyToAccount } from 'viem/accounts';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateSessionKey, getZeroDevRpc, aaChainFor } from '@/lib/wallet/sessionKeyAA';
import { encryptServerSecret, decryptServerSecret, vaultConfigured } from '@/lib/wallet/serverKeyVault';

/**
 * AA session-key lifecycle (#41), two steps:
 *
 *   step:'init'    → server generates a fresh session keypair and returns the
 *                    session ADDRESS + the ENCRYPTED private key (AES-256-GCM,
 *                    only the server secret can produce/read it) + the scope to
 *                    sign. NOTHING is persisted yet — the plaintext key never
 *                    leaves the server, and the ciphertext is opaque to the
 *                    client. No DB row is created without owner authorization.
 *   step:'approve' → client posts back the encrypted key, the owner-built kernel
 *                    permission approval + kernel address, AND an EIP-712
 *                    signature from the main wallet over the scope. The server
 *                    verifies the signature recovers to main_address, binds the
 *                    stored scope to the SIGNED payload (not loose body fields),
 *                    confirms the ciphertext decrypts to the signed session
 *                    address, then inserts the active row. The background sniper
 *                    cron can then execute capped, expiring buys.
 *
 * Security (audit #47 C1/C2): the AA grant is only stored after the same
 * EIP-712 owner-authorization the legacy session-key route requires, so a
 * client cannot forge a grant or store caps it never signed. auth_signature /
 * auth_payload are populated (their NOT NULL constraint is the on-record proof
 * and must never be relaxed).
 *
 * Dormant unless the owner has set SESSION_KEY_ENCRYPTION_SECRET and a ZeroDev
 * RPC for the chain — otherwise returns 503 and the UI falls back to one-tap.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AA_CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'];

/** EIP-712 owner authorization of an AA session grant. Mirrors the legacy
 *  session-key route but binds the kernel address too, since AA execution acts
 *  through that specific kernel account. */
const TYPED_DATA_DOMAIN = { name: 'NakaLabs AA Session Key', version: '1' };
const TYPED_DATA_TYPES = {
  Authorization: [
    { name: 'sessionAddress', type: 'address' },
    { name: 'kernelAddress', type: 'address' },
    { name: 'chain', type: 'string' },
    { name: 'maxPerTradeUsd', type: 'uint256' },
    { name: 'dailyCapUsd', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

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
  session_address?: string;
  encrypted_session_key?: string;
  approval?: string;
  kernel_address?: string;
  auth_signature?: string;
  auth_payload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const admin = getSupabaseAdmin();

  if (body.step === 'approve') {
    return handleApprove(body, user.id, admin);
  }

  // step: 'init' (default) — stateless: mint a keypair + encrypt it, return the
  // ciphertext for the client to round-trip back at approve. No DB write.
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
  if (!body.main_address || !ethers.isAddress(body.main_address)) {
    return NextResponse.json({ error: 'valid main_address required' }, { status: 400 });
  }
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

  return NextResponse.json({
    ok: true,
    session_address: session.address,
    encrypted_session_key: encrypted,
    valid_until: validUntil,
    max_trades_per_day: maxTradesPerDay,
    // Echo back the caps so the client signs exactly what the server will store.
    max_per_trade_usd: maxPerTrade,
    daily_cap_usd: dailyCap,
  });
}

/**
 * Approve step: verify the owner authorized this exact session grant, then
 * insert the active row with the authorization proof. Returns 400 on any
 * signature / scope mismatch so a client can never store an unauthorized grant.
 */
async function handleApprove(
  body: Body,
  userId: string,
  admin: ReturnType<typeof getSupabaseAdmin>,
): Promise<NextResponse> {
  if (
    !body.session_address || !body.encrypted_session_key || !body.approval ||
    !body.kernel_address || !body.main_address || !body.auth_signature || !body.auth_payload
  ) {
    return NextResponse.json(
      { error: 'session_address, encrypted_session_key, approval, kernel_address, main_address, auth_signature, auth_payload required' },
      { status: 400 },
    );
  }
  const chain = (body.chain ?? '').toLowerCase();
  if (!aaChainFor(chain)) {
    return NextResponse.json({ error: `unsupported chain: ${chain}` }, { status: 400 });
  }

  // 1. Verify the EIP-712 signature recovers to main_address (owner control).
  try {
    const recovered = ethers.verifyTypedData(
      TYPED_DATA_DOMAIN,
      TYPED_DATA_TYPES,
      body.auth_payload,
      body.auth_signature,
    );
    if (recovered.toLowerCase() !== body.main_address.toLowerCase()) {
      return NextResponse.json({ error: 'signature does not match main_address' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: `signature verification failed: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 400 },
    );
  }

  // 2. Bind the stored scope to the SIGNED payload, not the loose body fields —
  //    a client must not sign cap=50 then store cap=99999.
  const signed = body.auth_payload as Record<string, unknown>;
  const signedSession = String(signed.sessionAddress ?? '');
  const signedKernel = String(signed.kernelAddress ?? '');
  const signedChain = String(signed.chain ?? '');
  const signedMaxPerTrade = Number(signed.maxPerTradeUsd ?? NaN);
  const signedDailyCap = Number(signed.dailyCapUsd ?? NaN);
  const signedExpiresAt = Number(signed.expiresAt ?? NaN);
  if (
    signedSession.toLowerCase() !== body.session_address.toLowerCase() ||
    signedKernel.toLowerCase() !== body.kernel_address.toLowerCase() ||
    signedChain.toLowerCase() !== chain ||
    !Number.isFinite(signedMaxPerTrade) || signedMaxPerTrade <= 0 ||
    !Number.isFinite(signedDailyCap) || signedDailyCap <= 0 ||
    !Number.isFinite(signedExpiresAt) || signedExpiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return NextResponse.json({ error: 'auth_payload does not match the authorized scope' }, { status: 400 });
  }

  // 3. Confirm the round-tripped ciphertext is a key the SERVER minted AND that
  //    it corresponds to the signed session address (ties the key to the grant).
  try {
    const pk = decryptServerSecret(body.encrypted_session_key) as `0x${string}`;
    const addr = privateKeyToAccount(pk).address;
    if (addr.toLowerCase() !== signedSession.toLowerCase()) {
      return NextResponse.json({ error: 'session key does not match the authorized session address' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'invalid session key blob' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('user_session_keys')
    .insert({
      user_id: userId,
      session_address: signedSession,
      main_address: body.main_address,
      chain: signedChain.toLowerCase(),
      max_per_trade_usd: signedMaxPerTrade,
      daily_cap_usd: signedDailyCap,
      encrypted_session_key: body.encrypted_session_key,
      key_version: 1,
      approval: body.approval,
      kernel_address: body.kernel_address,
      auth_signature: body.auth_signature,
      auth_payload: body.auth_payload,
      expires_at: new Date(signedExpiresAt * 1000).toISOString(),
    })
    .select('id, session_address, kernel_address, expires_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, kernel_address: data.kernel_address });
}
