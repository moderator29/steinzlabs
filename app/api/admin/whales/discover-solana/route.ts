/**
 * Solana Jupiter-aggregator whale discovery. Counterpart of the EVM
 * discover route (/api/admin/whales/discover), but for Solana via
 * Helius instead of Alchemy.
 *
 * Approach: query Helius Enhanced Transactions for the Jupiter v6
 * aggregator program's recent signatures, extract the feePayer
 * (the swap initiator) of each SWAP tx, aggregate by count, filter
 * out program-owned accounts, rank by swap frequency, insert the top
 * EOAs as entity_type='trader'.
 *
 * Jupiter v6 aggregator program:
 *   JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4  (legacy)
 *   JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB  (current v6)
 *
 * Auth: admin-only — ADMIN_MIGRATION_SECRET header OR profiles.role='admin'.
 *
 *   POST /api/admin/whales/discover-solana?limit=30&dryRun=1
 *   POST /api/admin/whales/discover-solana?program=JUP6... (override)
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JUPITER_PROGRAMS: Record<string, string> = {
  jupiter_v6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  jupiter_v4: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
};

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

function getRpc(): string {
  const h = process.env.HELIUS_API_KEY;
  if (h) return `https://mainnet.helius-rpc.com/?api-key=${h}`;
  return process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC || '';
}

async function rpcCall<T = any>(rpc: string, method: string, params: any[]): Promise<T | null> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data.result as T;
  } catch {
    return null;
  }
}

/**
 * Helius Enhanced Transactions API. Faster than raw RPC getSignatures
 * + getTransaction loop because it returns parsed token-transfers +
 * feePayer in a single call. Free tier allows ~100 tx/request.
 */
async function fetchJupiterSwappers(program: string, limit: number): Promise<Array<{ feePayer: string; timestamp: number }>> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return [];
  try {
    // Get recent signatures involving the Jupiter program
    const url = `https://api.helius.xyz/v0/addresses/${program}/transactions?api-key=${key}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const txs = (await res.json()) as Array<{
      feePayer?: string;
      timestamp?: number;
      type?: string;
    }>;
    return txs
      .filter((t) => t.type === 'SWAP' && t.feePayer)
      .map((t) => ({ feePayer: t.feePayer!, timestamp: t.timestamp ?? 0 }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rpc = getRpc();
  if (!rpc) return NextResponse.json({ error: 'No Solana RPC configured (HELIUS_API_KEY preferred)' }, { status: 500 });
  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json({ error: 'Discovery requires HELIUS_API_KEY for the Enhanced Transactions API' }, { status: 500 });
  }

  const url = req.nextUrl;
  const programKey = url.searchParams.get('program') || 'jupiter_v6';
  const programAddress = JUPITER_PROGRAMS[programKey] ?? programKey;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100);
  const minSwaps = Math.max(parseInt(url.searchParams.get('minSwaps') || '2', 10) || 2, 1);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const txs = await fetchJupiterSwappers(programAddress, 500);
  if (txs.length === 0) {
    return NextResponse.json({ error: 'No Jupiter swap transactions returned from Helius', program: programAddress }, { status: 502 });
  }

  // Aggregate fee-payer counts
  const counts = new Map<string, { count: number; lastTs: number }>();
  for (const t of txs) {
    const prev = counts.get(t.feePayer);
    if (prev) {
      prev.count++;
      if (t.timestamp > prev.lastTs) prev.lastTs = t.timestamp;
    } else {
      counts.set(t.feePayer, { count: 1, lastTs: t.timestamp });
    }
  }

  // Top swappers — EOAs that initiate their own swaps (feePayer is
  // always the user for Jupiter, program accounts never appear).
  const candidates = Array.from(counts.entries())
    .filter(([, v]) => v.count >= minSwaps)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit * 2);

  const supabase = getSupabaseAdmin();

  // Skip addresses already in whales table
  const addrs = candidates.map(([a]) => a);
  const { data: existing } = await supabase.from('whales').select('address').in('address', addrs);
  const existingSet = new Set((existing || []).map((r) => r.address));

  const newRows = candidates
    .filter(([addr]) => !existingSet.has(addr))
    .slice(0, limit)
    .map(([addr, v]) => ({
      address: addr,
      chain: 'solana',
      label: 'Active Jupiter trader',
      entity_type: 'trader',
      archetype: 'active_swapper',
      whale_score: 75,
      trade_count_30d: v.count,
      follower_count: 0,
      verified: false,
      is_active: true,
      first_seen_at: new Date().toISOString(),
      last_active_at: v.lastTs ? new Date(v.lastTs * 1000).toISOString() : new Date().toISOString(),
    }));

  let inserted = 0;
  if (!dryRun && newRows.length > 0) {
    const { error } = await supabase.from('whales').insert(newRows);
    if (error) return NextResponse.json({ error: `insert failed: ${error.message}`, newRows }, { status: 500 });
    inserted = newRows.length;
  }

  return NextResponse.json({
    dryRun,
    program: programAddress,
    scannedTxs: txs.length,
    uniqueSwappers: counts.size,
    candidates: candidates.length,
    alreadyInDb: addrs.length - newRows.length,
    wouldInsert: newRows.length,
    inserted,
    sample: newRows.slice(0, 10),
  });
}
