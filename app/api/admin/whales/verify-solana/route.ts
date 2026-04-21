/**
 * Solana-side companion to /api/admin/whales/verify (which handles EVM).
 * Checks every active Solana whale via Helius RPC getAccountInfo — if
 * the account doesn't exist on-chain (value === null), soft-deletes the
 * row. Complements the earlier EVM sweeps which already removed
 * ascending-hex / repeating-pattern fabrications on Ethereum etc.
 *
 * Soft-delete only (is_active=false). Preserves FKs against
 * user_whale_follows / whale_activity / whale_ai_summaries.
 *
 * Auth: admin-only — ADMIN_MIGRATION_SECRET header OR profiles.role='admin'.
 *
 *   POST /api/admin/whales/verify-solana?dryRun=1&limit=50   (preview)
 *   POST /api/admin/whales/verify-solana                     (commit)
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface WhaleRow { id: string; address: string; label: string | null; }

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
  const a = process.env.ALCHEMY_API_KEY;
  if (a) return `https://solana-mainnet.g.alchemy.com/v2/${a}`;
  return process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC || '';
}

async function checkAccount(rpc: string, address: string): Promise<{ alive: boolean; reason: string }> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
        params: [address, { encoding: 'base64' }],
      }),
    });
    if (!res.ok) return { alive: true, reason: `rpc http ${res.status}` };
    const data = await res.json();
    if (data.error) return { alive: true, reason: `rpc err: ${data.error.message}` };
    const value = data?.result?.value;
    return value === null
      ? { alive: false, reason: 'account does not exist on-chain' }
      : { alive: true, reason: 'account exists' };
  } catch (err: any) {
    return { alive: true, reason: `fetch err: ${err?.message || 'unknown'}` };
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rpc = getRpc();
  if (!rpc) return NextResponse.json({ error: 'No Solana RPC configured (HELIUS_API_KEY or ALCHEMY_API_KEY)' }, { status: 500 });

  const url = req.nextUrl;
  const dryRun = url.searchParams.get('dryRun') === '1';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 300);

  const supabase = getSupabaseAdmin();
  const { data: whales, error } = await supabase
    .from('whales')
    .select('id, address, label')
    .eq('is_active', true)
    .eq('chain', 'solana')
    .order('first_seen_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!whales || whales.length === 0) return NextResponse.json({ checked: 0, alive: 0, dead: 0 });

  // Parallel chunks of 10 — Helius free tier allows ~50 rps.
  const CHUNK = 10;
  const results: Array<{ id: string; address: string; label: string | null; alive: boolean; reason: string }> = [];
  for (let i = 0; i < whales.length; i += CHUNK) {
    const slice = whales.slice(i, i + CHUNK) as WhaleRow[];
    const checks = await Promise.all(slice.map((w) => checkAccount(rpc, w.address).then((r) => ({ ...w, ...r }))));
    results.push(...checks);
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
    deadAddresses: results.filter((r) => !r.alive).map((r) => ({ address: r.address, label: r.label, reason: r.reason })),
  });
}
