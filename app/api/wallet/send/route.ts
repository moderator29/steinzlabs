import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { guardRoute } from '@/lib/api/guardRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// Broadcast a client-signed transaction. The wallet key never leaves the
// browser; the client signs locally and posts the raw signed hex (EVM) or
// base58 payload (Solana) here. We relay to Alchemy / Helius, log the
// attempt, and bump the swaps_protected counter if the send succeeds.

const ALCHEMY_URL: Record<string, string> = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  base:     `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  polygon:  `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  optimism: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
};

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ''}`;

const BNB_RPC = 'https://bsc-dataseed.binance.org';
const AVAX_RPC = 'https://api.avax.network/ext/bc/C/rpc';

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

async function broadcastEvm(chain: string, signedHex: string): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  let url: string;
  if (chain === 'bnb' || chain === 'bsc')     url = BNB_RPC;
  else if (chain === 'avalanche')              url = AVAX_RPC;
  else if (ALCHEMY_URL[chain])                 url = ALCHEMY_URL[chain];
  else return { ok: false, error: 'Unsupported EVM chain' };
  // Guard against a missing/mis-templated RPC URL. A blank env var leaves
  // `undefined` baked into the Alchemy URL; the old condition (`!url.includes(
  // 'undefined') === false && !url`) reduced to `url.includes('undefined') &&
  // !url`, which is unreachable for any non-empty string, so a missing
  // ALCHEMY_API_KEY silently broadcast to a bad URL instead of failing honestly.
  if (!url || url.includes('undefined')) return { ok: false, error: 'RPC not configured' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendRawTransaction',
        params: [signedHex],
      }),
    });
    const json = await res.json() as { result?: string; error?: { message?: string } };
    if (json.error) return { ok: false, error: json.error.message ?? 'RPC error' };
    return { ok: true, txHash: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Broadcast failed' };
  }
}

async function broadcastSolana(signedB64: string): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  if (!process.env.HELIUS_API_KEY) return { ok: false, error: 'Helius not configured' };
  try {
    const res = await fetch(HELIUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: [signedB64, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }],
      }),
    });
    const json = await res.json() as { result?: string; error?: { message?: string } };
    if (json.error) return { ok: false, error: json.error.message ?? 'RPC error' };
    return { ok: true, txHash: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Broadcast failed' };
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardRoute(req, { rate: 'high' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    chain?: string;
    signed?: string;
    to?: string;
    amount?: string;
    symbol?: string;
  };

  const chain = (body.chain ?? '').toLowerCase();
  const signed = body.signed ?? '';
  if (!chain || !signed) {
    return NextResponse.json({ error: 'chain and signed tx required' }, { status: 400 });
  }

  // NW2: pre-broadcast sender verification. A non-custodial relayer
  // must never broadcast a signed transaction whose sender doesn't
  // match the authenticated user's wallet — otherwise a stolen signed
  // payload (e.g. from a swapped React state attack) could be relayed
  // from a different user's session. We decode the signed payload
  // enough to extract the from-address and compare against the
  // authenticated user's known wallet.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .maybeSingle<{ wallet_address: string | null }>();
    const userWallet = (profile?.wallet_address ?? '').toLowerCase();

    if (chain === 'solana') {
      // Best-effort decode: VersionedTransaction.deserialize is the
      // safest path but ships ~200KB if statically imported here. We
      // dynamic-import behind try/catch so a parse failure logs the
      // attempt without blocking the broadcast (which the RPC will
      // reject anyway if the tx is malformed).
      try {
        const { VersionedTransaction } = await import('@solana/web3.js');
        const tx = VersionedTransaction.deserialize(Buffer.from(signed, 'base64'));
        const sender = tx.message.staticAccountKeys[0]?.toBase58();
        if (userWallet && sender && sender !== profile?.wallet_address) {
          return NextResponse.json({ error: 'Signed sender does not match authenticated wallet' }, { status: 403 });
        }
      } catch { /* parse failure → let the RPC reject */ }
    } else {
      try {
        const { Transaction } = await import('ethers');
        const tx = Transaction.from(signed);
        const sender = (tx.from ?? '').toLowerCase();
        if (userWallet && sender && sender !== userWallet) {
          return NextResponse.json({ error: 'Signed sender does not match authenticated wallet' }, { status: 403 });
        }
      } catch { /* parse failure → let the RPC reject */ }
    }
  } catch { /* profile lookup failure → fall through (RLS errors shouldn't gate the user's own send) */ }

  let result: { ok: boolean; txHash?: string; error?: string };
  if (chain === 'solana') {
    result = await broadcastSolana(signed);
  } else {
    result = await broadcastEvm(chain, signed);
  }

  // Log the attempt regardless of outcome (RLS: users can only see their own).
  try {
    await supabase.from('wallet_send_log').insert({
      user_id: user.id,
      chain,
      to_address: body.to ?? null,
      amount: body.amount ?? null,
      symbol: body.symbol ?? null,
      tx_hash: result.txHash ?? null,
      status: result.ok ? 'broadcast' : 'failed',
      error: result.error ?? null,
    });
  } catch {
    // Log-only failure — don't break the user flow.
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Broadcast failed' }, { status: 502 });
  }

  // Increment swaps_protected counter on successful broadcasts — this is a
  // rough proxy until we wire per-event triggers.
  try {
    const { incrementPlatformStat } = await import('@/lib/platformStats');
    await incrementPlatformStat('swaps_protected');
  } catch { /* non-fatal */ }

  return NextResponse.json({ txHash: result.txHash });
}
