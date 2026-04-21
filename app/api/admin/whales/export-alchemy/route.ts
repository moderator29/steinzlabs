/**
 * Export trader-only address lists per chain, ready to paste into
 * Alchemy webhook Addresses field. Solves the cost-control problem:
 * Address Activity webhooks charge per-event, and exchange/institutional
 * hot wallets fire thousands of tx/day (retail noise, not alpha). This
 * endpoint returns only the high-signal addresses.
 *
 * Ethereum addresses are returned in their stored (EIP-55 checksummed)
 * case because Alchemy's ETH UI validates checksum; other chains return
 * lowercase since they don't.
 *
 *   GET /api/admin/whales/export-alchemy?chain=ethereum
 *   GET /api/admin/whales/export-alchemy?chain=ethereum&format=json
 *
 * Default format is plain text (newline-separated), so piping into
 * pbcopy / clip / Alchemy field just works. JSON form returns
 * { chain, count, addresses[] } for programmatic use.
 *
 * Auth: admin-only (ADMIN_MIGRATION_SECRET header OR profiles.role='admin').
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Alchemy accepts these networks on free + pay-as-you-go
const EVM_CHAINS = new Set(['ethereum', 'base', 'bsc', 'polygon', 'arbitrum', 'optimism']);

// High-signal entity types — individual traders who DECIDE to swap.
// Exchanges, institutions, funds and VCs all generate cost-heavy retail
// noise or rebalance moves that aren't useful in Live Feed.
const SIGNAL_ENTITIES = ['trader', 'influencer', 'dev', 'unknown'];

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

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl;
  const chain = (url.searchParams.get('chain') || '').toLowerCase();
  const format = (url.searchParams.get('format') || 'text').toLowerCase();

  if (!chain || !EVM_CHAINS.has(chain)) {
    return NextResponse.json({
      error: 'chain required, one of: ' + Array.from(EVM_CHAINS).join(', '),
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('whales')
    .select('address, label, entity_type, portfolio_value_usd, trade_count_30d')
    .eq('is_active', true)
    .eq('chain', chain)
    .in('entity_type', SIGNAL_ENTITIES)
    .order('portfolio_value_usd', { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ chain, count: 0, addresses: [] });
  }

  // Ethereum keeps EIP-55 case (Alchemy ETH UI validates it); others
  // lowercase for consistency (other chain UIs don't care).
  const addresses = data.map((w) => chain === 'ethereum' ? w.address : w.address.toLowerCase());

  if (format === 'json') {
    return NextResponse.json({
      chain,
      count: addresses.length,
      addresses,
      sample: data.slice(0, 5).map((w) => ({
        address: w.address, label: w.label, entity_type: w.entity_type,
        portfolio_usd: w.portfolio_value_usd,
      })),
    });
  }

  // Plain text — newline-separated, easy paste into Alchemy
  return new Response(addresses.join('\n') + '\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
