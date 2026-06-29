import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ethers } from 'ethers';
import { encryptSessionKey, sessionKeyEncryptionAvailable } from '@/lib/trading/sessionKeyCrypto';
import { buildSolanaAuthMessage, verifySolanaAuthMessage, solanaSecretMatchesAddress, type SolanaAuthScope } from '@/lib/trading/solanaSessionAuth';

/**
 * §3 P2-D.1 — Session keys for auto_copy mode.
 *
 * Flow:
 *  1. Client generates a fresh ephemeral keypair (only the privkey is
 *     stored in localStorage; nothing leaves the browser).
 *  2. Client builds an EIP-712 typed payload describing the
 *     authorization scope (session_address, chain, max_per_trade_usd,
 *     daily_cap_usd, allowed_tokens, expiry) and gets the main wallet
 *     to sign it.
 *  3. Client POSTs the public session address + the signature here.
 *  4. We verify the signature recovers to main_address, then store
 *     the row. The copy-trade relayer reads this row to know which
 *     session key may sign txs on the user's behalf.
 *
 * GET   → caller's active session keys.
 * POST  → create one (body: { session_address, chain, max_per_trade_usd,
 *         daily_cap_usd, allowed_tokens?, hours, auth_signature,
 *         auth_payload, main_address }).
 * DELETE ?id=... → revoke.
 *
 * Server NEVER sees the private key.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPED_DATA_DOMAIN = {
  name: 'NakaLabs Session Key',
  version: '1',
};

const TYPED_DATA_TYPES = {
  Authorization: [
    { name: 'sessionAddress', type: 'address' },
    { name: 'chain', type: 'string' },
    { name: 'maxPerTradeUsd', type: 'uint256' },
    { name: 'dailyCapUsd', type: 'uint256' },
    { name: 'allowedTokens', type: 'string' },     // comma-joined
    { name: 'expiresAt', type: 'uint256' },
  ],
};

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

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await sb
    .from('user_session_keys')
    .select('id, session_address, main_address, chain, max_per_trade_usd, daily_cap_usd, allowed_tokens, expires_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ session_keys: data ?? [] });
}

interface CreateBody {
  session_address?: string;
  main_address?: string;
  chain?: string;
  max_per_trade_usd?: number;
  daily_cap_usd?: number;
  allowed_tokens?: string[];
  hours?: number;
  auth_signature?: string;
  auth_payload?: Record<string, unknown>;
  // Optional: the session EOA private key, for 24/7 server-side execution. When
  // present it is encrypted at rest (never stored plaintext). When absent the
  // row stays client-signing-only (legacy behavior). Only meaningful once the
  // Phase-2 signer is enabled.
  session_private_key?: string;
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as CreateBody;

  if (!body.session_address || !body.main_address || !body.chain || !body.auth_signature || !body.auth_payload) {
    return NextResponse.json({ error: 'session_address, main_address, chain, auth_signature, auth_payload required' }, { status: 400 });
  }
  if (!body.max_per_trade_usd || !body.daily_cap_usd || body.max_per_trade_usd <= 0 || body.daily_cap_usd <= 0) {
    return NextResponse.json({ error: 'caps must be positive' }, { status: 400 });
  }
  const hours = Math.max(1, Math.min(168, body.hours ?? 24));   // 1h-7d window

  // ── Solana branch — ed25519 signMessage instead of EIP-712. Self-contained:
  // verifies the main Solana wallet signed the canonical scope, then stores the
  // (optionally encrypted) session keypair. Solana addresses are CASE-SENSITIVE,
  // so scope comparisons are exact (never lower-cased).
  if ((body.chain || '').toLowerCase() === 'solana') {
    const signed = body.auth_payload as Record<string, unknown>;
    const scope: SolanaAuthScope = {
      sessionAddress: String(signed.sessionAddress ?? ''),
      chain: 'solana',
      maxPerTradeUsd: Number(signed.maxPerTradeUsd ?? NaN),
      dailyCapUsd: Number(signed.dailyCapUsd ?? NaN),
      allowedTokens: String(signed.allowedTokens ?? ''),
      expiresAt: Number(signed.expiresAt ?? NaN),
    };
    if (
      scope.sessionAddress !== body.session_address ||
      scope.chain !== (body.chain || '').toLowerCase() ||
      !Number.isFinite(scope.maxPerTradeUsd) || scope.maxPerTradeUsd <= 0 ||
      !Number.isFinite(scope.dailyCapUsd) || scope.dailyCapUsd <= 0 ||
      !Number.isFinite(scope.expiresAt)
    ) {
      return NextResponse.json({ error: 'auth_payload does not match the authorized scope' }, { status: 400 });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (scope.expiresAt <= nowSec || scope.expiresAt > nowSec + 168 * 3600) {
      return NextResponse.json({ error: 'expiry must be in the future and within 7 days' }, { status: 400 });
    }
    // The signature must cover the EXACT canonical message rebuilt from the scope.
    const message = buildSolanaAuthMessage(scope);
    if (!verifySolanaAuthMessage(message, body.auth_signature, body.main_address)) {
      return NextResponse.json({ error: 'signature does not match main_address' }, { status: 400 });
    }
    const allowedTokens = scope.allowedTokens.trim()
      ? scope.allowedTokens.split(',').map((t) => t.trim()).filter(Boolean)
      : null;
    let encryptedKey: string | null = null;
    if (body.session_private_key) {
      if (!sessionKeyEncryptionAvailable()) {
        return NextResponse.json({ error: '24/7 session keys are not enabled on this deployment' }, { status: 503 });
      }
      if (!solanaSecretMatchesAddress(body.session_private_key, scope.sessionAddress)) {
        return NextResponse.json({ error: 'session_private_key does not match session_address' }, { status: 400 });
      }
      encryptedKey = encryptSessionKey(body.session_private_key);
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_session_keys')
      .insert({
        user_id: user.id,
        session_address: scope.sessionAddress,
        main_address: body.main_address,
        chain: 'solana',
        max_per_trade_usd: scope.maxPerTradeUsd,
        daily_cap_usd: scope.dailyCapUsd,
        allowed_tokens: allowedTokens,
        auth_signature: body.auth_signature,
        auth_payload: body.auth_payload,
        expires_at: new Date(scope.expiresAt * 1000).toISOString(),
        encrypted_session_key: encryptedKey,
      })
      .select('id, session_address, expires_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session_key: data, mode: encryptedKey ? 'auto_24_7' : 'client_sign' });
  }

  // Verify EIP-712 signature recovers to main_address.
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
    return NextResponse.json({ error: `signature verification failed: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 400 });
  }

  // §audit scope-integrity: store the SIGNED scope from auth_payload, not the
  // separate body fields. Otherwise a client could sign cap=50 but POST
  // cap=99999 and the signature still verifies, letting a relayer over-spend.
  const signed = body.auth_payload as Record<string, unknown>;
  const signedSession = String(signed.sessionAddress ?? '');
  const signedChain = String(signed.chain ?? '');
  const signedMaxPerTrade = Number(signed.maxPerTradeUsd ?? NaN);
  const signedDailyCap = Number(signed.dailyCapUsd ?? NaN);
  const signedExpiresAt = Number(signed.expiresAt ?? NaN);
  if (
    signedSession.toLowerCase() !== body.session_address.toLowerCase() ||
    signedChain.toLowerCase() !== body.chain.toLowerCase() ||
    !Number.isFinite(signedMaxPerTrade) || signedMaxPerTrade <= 0 ||
    !Number.isFinite(signedDailyCap) || signedDailyCap <= 0 ||
    !Number.isFinite(signedExpiresAt)
  ) {
    return NextResponse.json({ error: 'auth_payload does not match the authorized scope' }, { status: 400 });
  }

  // Enforce the time-box server-side: the signed expiry must be in the future
  // and within the 7-day ceiling. Without this the `hours` clamp above is dead
  // for the stored value and a tampered client could mint a multi-year key.
  const nowSec = Math.floor(Date.now() / 1000);
  const MAX_WINDOW_SEC = 168 * 3600;
  if (signedExpiresAt <= nowSec || signedExpiresAt > nowSec + MAX_WINDOW_SEC) {
    return NextResponse.json({ error: 'expiry must be in the future and within 7 days' }, { status: 400 });
  }

  // Token allowlist is part of the SIGNED scope — derive it from the signed
  // comma-joined `allowedTokens`, not the unsigned body, so it can't be forged.
  const signedAllowedRaw = String(signed.allowedTokens ?? '').trim();
  const allowedTokens = signedAllowedRaw
    ? signedAllowedRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  // For 24/7 mode the client sends the session EOA private key; encrypt it at
  // rest (AES-256-GCM, secret not in DB). Verify it actually corresponds to the
  // authorized session_address so we never store a key that can't act for it.
  let encryptedKey: string | null = null;
  if (body.session_private_key) {
    if (!sessionKeyEncryptionAvailable()) {
      return NextResponse.json({ error: '24/7 session keys are not enabled on this deployment' }, { status: 503 });
    }
    try {
      const derived = new ethers.Wallet(body.session_private_key).address;
      if (derived.toLowerCase() !== signedSession.toLowerCase()) {
        return NextResponse.json({ error: 'session_private_key does not match session_address' }, { status: 400 });
      }
      encryptedKey = encryptSessionKey(body.session_private_key);
    } catch (e) {
      return NextResponse.json({ error: `invalid session_private_key: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 400 });
    }
  }

  const admin = getSupabaseAdmin();
  // Expiry comes from the SIGNED payload (seconds → ISO), falling back to the
  // requested window only if the signed value is somehow absent.
  const expiresAt = Number.isFinite(signedExpiresAt)
    ? new Date(signedExpiresAt * 1000).toISOString()
    : new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from('user_session_keys')
    .insert({
      user_id: user.id,
      session_address: signedSession,
      main_address: body.main_address,
      chain: signedChain.toLowerCase(),
      max_per_trade_usd: signedMaxPerTrade,
      daily_cap_usd: signedDailyCap,
      allowed_tokens: allowedTokens,
      auth_signature: body.auth_signature,
      auth_payload: body.auth_payload,
      expires_at: expiresAt,
      encrypted_session_key: encryptedKey,
    })
    .select('id, session_address, expires_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session_key: data, mode: encryptedKey ? 'auto_24_7' : 'client_sign' });
}

export async function DELETE(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await sb
    .from('user_session_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
