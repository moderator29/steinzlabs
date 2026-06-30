import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isEvmAddress, isSolanaAddress } from '@/lib/utils/addressNormalize';

/**
 * #68 Market-Maker strategy CRUD.
 *  GET   → caller's strategies (+ recent fills summary).
 *  POST  → create a strategy (defaults to paused — nothing trades until the
 *          user explicitly activates and funds the kernel account).
 *  PATCH → update status (active|paused|stopped) or editable config.
 * Non-custodial: execution is the AA session-key path; this route only persists
 * intent. RLS already scopes rows to the owner; we double-bind user_id in WHERE.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value; }, set() {}, remove() {} } },
  );
}

const CHAINS = ['solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'avalanche'];

function validAddressForChain(chain: string, addr: string): boolean {
  return chain === 'solana' ? isSolanaAddress(addr) : isEvmAddress(addr);
}

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: strategies } = await sb
    .from('mm_strategies')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ strategies: strategies ?? [] });
}

interface CreateBody {
  chain?: string;
  token_address?: string;
  token_symbol?: string;
  quote_token_address?: string;
  strategy_type?: 'grid' | 'range' | 'presence';
  reference_price_mode?: 'market' | 'manual';
  manual_reference_price?: number;
  spread_bps?: number;
  num_levels?: number;
  order_size_usd?: number;
  budget_usd?: number;
  max_inventory_usd?: number;
  max_slippage_bps?: number;
  band_pct?: number;
  range_lower_pct?: number;
  range_upper_pct?: number;
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as CreateBody;

  const chain = (b.chain || '').toLowerCase();
  if (!CHAINS.includes(chain)) return NextResponse.json({ error: 'unsupported chain' }, { status: 400 });
  if (!b.token_address || !validAddressForChain(chain, b.token_address)) {
    return NextResponse.json({ error: 'invalid token_address for chain' }, { status: 400 });
  }
  // M2: a sub-gas order size is a guaranteed loss every fill. Enforce a floor.
  const MIN_ORDER_USD = 5;
  if (!b.order_size_usd || b.order_size_usd < MIN_ORDER_USD) return NextResponse.json({ error: `order_size_usd must be at least $${MIN_ORDER_USD}` }, { status: 400 });
  if (!b.budget_usd || b.budget_usd <= 0) return NextResponse.json({ error: 'budget_usd must be positive' }, { status: 400 });
  if (b.order_size_usd > b.budget_usd) return NextResponse.json({ error: 'order size cannot exceed budget' }, { status: 400 });
  // M1/L1: numeric bounds so engine math can't be fed degenerate config.
  if (b.max_inventory_usd != null && b.max_inventory_usd <= 0) return NextResponse.json({ error: 'max_inventory_usd must be positive' }, { status: 400 });
  if (b.band_pct != null && b.band_pct <= 0) return NextResponse.json({ error: 'band_pct must be positive' }, { status: 400 });
  if (b.reference_price_mode === 'manual' && (!b.manual_reference_price || b.manual_reference_price <= 0)) {
    return NextResponse.json({ error: 'manual reference price required' }, { status: 400 });
  }
  const stratType = b.strategy_type ?? 'grid';
  if (!['grid', 'range'].includes(stratType)) {
    return NextResponse.json({ error: 'only grid and range strategies are available' }, { status: 400 });
  }
  if (stratType === 'range') {
    const lo = b.range_lower_pct, hi = b.range_upper_pct;
    if (lo == null || hi == null || lo >= hi) {
      return NextResponse.json({ error: 'range requires lower_pct < upper_pct' }, { status: 400 });
    }
    if (lo <= -100) {
      return NextResponse.json({ error: 'range lower_pct must be greater than -100' }, { status: 400 });
    }
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('mm_strategies')
    .insert({
      user_id: user.id,
      chain,
      token_address: b.token_address,
      token_symbol: b.token_symbol ?? null,
      quote_token_address: b.quote_token_address ?? null,
      strategy_type: stratType,
      reference_price_mode: b.reference_price_mode ?? 'market',
      manual_reference_price: b.manual_reference_price ?? null,
      range_lower_pct: stratType === 'range' ? b.range_lower_pct : null,
      range_upper_pct: stratType === 'range' ? b.range_upper_pct : null,
      spread_bps: Math.max(10, Math.min(b.spread_bps ?? 100, 5000)),
      num_levels: Math.max(1, Math.min(b.num_levels ?? 3, 10)),
      order_size_usd: b.order_size_usd,
      budget_usd: b.budget_usd,
      max_inventory_usd: b.max_inventory_usd ?? null,
      max_slippage_bps: Math.max(10, Math.min(b.max_slippage_bps ?? 200, 1000)),
      band_pct: b.band_pct ?? 10,
      status: 'paused', // never auto-trades on create
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, strategy: data });
}

export async function PATCH(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (b.status && !['active', 'paused', 'stopped'].includes(b.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('mm_strategies')
    .update({ status: b.status, updated_at: new Date().toISOString() })
    .eq('id', b.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
