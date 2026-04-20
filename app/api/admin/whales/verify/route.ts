/**
 * Bug §2.1: Fake-whale verifier. Many seeded whale addresses (hundreds from
 * 2026_session5a1_whales_500.sql) don't actually exist on-chain. Users paste
 * them into Etherscan / Solscan and see nothing.
 *
 * This route iterates the whales table in batches, checks each address on
 * the chain it claims to live on, and marks confirmed-dead ones as
 * is_active=false. A "dead" EVM address is one that has zero balance AND
 * zero asset transfers in either direction (nothing was ever sent or
 * received). A "dead" Solana address is one whose getAccountInfo returns
 * null (the account literally does not exist on-chain).
 *
 * Deactivation is soft (is_active=false) not DELETE. This keeps referential
 * integrity (user_whale_follows, whale_activity) while hiding them from the
 * directory, and lets us recover if a verification false-positives.
 *
 * Auth: admin-only via ADMIN_MIGRATION_SECRET header OR a Supabase user with
 * profiles.role='admin'. Supports ?dryRun=1 to preview without writes.
 *
 * Usage:
 *   POST /api/admin/whales/verify?dryRun=1        (preview)
 *   POST /api/admin/whales/verify                 (commit)
 *   POST /api/admin/whales/verify?chain=ethereum  (one chain at a time)
 *   POST /api/admin/whales/verify?limit=100       (cap per-run for safety)
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// On-chain RPCs + small address sets means we can't hit Vercel's 10s edge
// default — give ourselves headroom.
export const maxDuration = 300;

interface WhaleRow {
  id: string;
  address: string;
  chain: string;
  label: string | null;
}

interface VerificationResult {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  alive: boolean;
  reason: string;
}

async function authorized(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-migration-secret');
  if (headerSecret && process.env.ADMIN_MIGRATION_SECRET && headerSecret === process.env.ADMIN_MIGRATION_SECRET) {
    return true;
  }
  const user = await getAuthenticatedUser(req);
  if (!user) return false;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin';
}

// ─── EVM check ─────────────────────────────────────────────────────────────
async function verifyEvm(address: string, chain: string): Promise<{ alive: boolean; reason: string }> {
  try {
    const { getEthBalance, getAssetTransfers } = await import('@/lib/services/alchemy');

    // Cheap check first — non-zero native balance is a slam-dunk "real".
    let hasBalance = false;
    try {
      const bal = await getEthBalance(address, chain);
      hasBalance = parseFloat(bal) > 0;
    } catch { /* Alchemy unsupported chain, fall through */ }

    if (hasBalance) return { alive: true, reason: 'positive native balance' };

    // Next: any transfer history in either direction? A real whale has moved
    // funds at some point. Fake generated addresses never have any.
    const [out, inc] = await Promise.all([
      getAssetTransfers(address, chain, 'from', 1).catch(() => []),
      getAssetTransfers(address, chain, 'to', 1).catch(() => []),
    ]);
    if (out.length > 0 || inc.length > 0) {
      return { alive: true, reason: 'has transfer history' };
    }

    return { alive: false, reason: 'no balance, no transfers' };
  } catch (err: any) {
    // On RPC error, don't deactivate — better to leave alive and retry next
    // run than to nuke a real whale because Alchemy burped.
    return { alive: true, reason: `rpc error: ${err?.message || 'unknown'}` };
  }
}

// ─── Solana check ──────────────────────────────────────────────────────────
async function verifySolana(address: string): Promise<{ alive: boolean; reason: string }> {
  const rpc =
    process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : '') ||
    `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

  if (!rpc) return { alive: true, reason: 'no solana rpc configured' };

  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [address, { encoding: 'base64' }],
      }),
    });
    if (!res.ok) return { alive: true, reason: `rpc http ${res.status}` };
    const data = await res.json();
    if (data.error) return { alive: true, reason: `rpc error: ${data.error.message}` };
    // value === null means "account does not exist on-chain"
    const value = data?.result?.value;
    return value === null
      ? { alive: false, reason: 'solana account does not exist' }
      : { alive: true, reason: 'solana account exists' };
  } catch (err: any) {
    return { alive: true, reason: `solana rpc error: ${err?.message || 'unknown'}` };
  }
}

async function verifyOne(row: WhaleRow): Promise<VerificationResult> {
  const chain = (row.chain || '').toLowerCase();
  let check: { alive: boolean; reason: string };
  if (chain === 'solana' || chain === 'sol') {
    check = await verifySolana(row.address);
  } else {
    check = await verifyEvm(row.address, chain);
  }
  return { id: row.id, address: row.address, chain: row.chain, label: row.label, ...check };
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl;
  const dryRun = url.searchParams.get('dryRun') === '1';
  const chainFilter = url.searchParams.get('chain');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('whales')
    .select('id, address, chain, label')
    .eq('is_active', true)
    .order('first_seen_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (chainFilter) query = query.eq('chain', chainFilter);

  const { data: whales, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!whales || whales.length === 0) {
    return NextResponse.json({ checked: 0, alive: 0, dead: 0, results: [] });
  }

  // Verify in small parallel chunks to respect RPC rate limits.
  const CHUNK = 8;
  const results: VerificationResult[] = [];
  for (let i = 0; i < whales.length; i += CHUNK) {
    const slice = whales.slice(i, i + CHUNK);
    const done = await Promise.all(slice.map((w) => verifyOne(w as WhaleRow)));
    results.push(...done);
  }

  const deadIds = results.filter((r) => !r.alive).map((r) => r.id);

  if (!dryRun && deadIds.length > 0) {
    const { error: updErr } = await supabase
      .from('whales')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', deadIds);
    if (updErr) {
      return NextResponse.json({ error: `update failed: ${updErr.message}`, results }, { status: 500 });
    }
  }

  return NextResponse.json({
    dryRun,
    checked: results.length,
    alive: results.filter((r) => r.alive).length,
    dead: deadIds.length,
    deactivated: dryRun ? 0 : deadIds.length,
    // First 50 results inline for inspection; full list would bloat responses.
    sample: results.slice(0, 50),
    deadAddresses: results.filter((r) => !r.alive).map((r) => ({ address: r.address, chain: r.chain, label: r.label, reason: r.reason })),
  });
}
