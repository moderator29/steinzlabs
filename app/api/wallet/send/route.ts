import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
  if (!url.includes('undefined') === false && !url) return { ok: false, error: 'RPC not configured' };

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
