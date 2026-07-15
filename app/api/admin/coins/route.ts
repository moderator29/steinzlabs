import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

/**
 * Admin controls for the Coins trading feature. Reads and curates rows in
 * coin_registry: verify / feature / hide toggles that drive what shows in the
 * public Coins listing. Every mutation is audited.
 */

type CoinFilter = 'all' | 'verified' | 'featured' | 'hidden' | 'flagged';

const COIN_COLUMNS =
  'chain, token_key, token_address, symbol, name, logo_url, verified, featured, hidden, is_graduated, price_usd, market_cap_usd, liquidity_usd, volume_24h_usd, change_24h, holders_count, dex, refreshed_at';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const filterParam = (url.searchParams.get('filter') ?? 'all') as CoinFilter;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('coin_registry')
      .select(COIN_COLUMNS)
      .order('volume_24h_usd', { ascending: false, nullsFirst: false });

    // Filters map onto real coin_registry booleans only. "flagged" surfaces
    // graduated coins that are listed but not yet verified, i.e. the ones that
    // still need an admin to vet them. Nothing here is invented.
    switch (filterParam) {
      case 'verified':
        query = query.eq('verified', true);
        break;
      case 'featured':
        query = query.eq('featured', true);
        break;
      case 'hidden':
        query = query.eq('hidden', true);
        break;
      case 'flagged':
        query = query.eq('verified', false).eq('hidden', false);
        break;
      case 'all':
      default:
        break;
    }

    const { data, error } = await query.limit(500);
    if (error) {
      console.error('[admin/coins GET] Query error:', error);
      return NextResponse.json({ coins: [] });
    }
    return NextResponse.json({ coins: data ?? [] });
  } catch (err) {
    console.error('[admin/coins GET] Failed:', err);
    return NextResponse.json({ coins: [] });
  }
}

const ACTION_TO_UPDATE: Record<string, Record<string, boolean>> = {
  verify: { verified: true },
  unverify: { verified: false },
  feature: { featured: true },
  unfeature: { featured: false },
  hide: { hidden: true },
  unhide: { hidden: false },
};

const ActionBody = z.object({
  chain: z.string().min(2).max(32),
  tokenKey: z.string().min(1).max(200),
  action: z.enum(['verify', 'unverify', 'feature', 'unfeature', 'hide', 'unhide']),
});

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const parsed = ActionBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
    }
    const { chain, tokenKey, action } = parsed.data;
    const updates = ACTION_TO_UPDATE[action];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('coin_registry')
      .update(updates)
      .eq('chain', chain)
      .eq('token_key', tokenKey)
      .select('chain, token_key, symbol, verified, featured, hidden')
      .maybeSingle();

    if (error) {
      console.error('[admin/coins POST] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Coin not found' }, { status: 404 });
    }

    void logAdminAction({
      adminId,
      action: 'other',
      details: { area: 'coins', action, chain, tokenKey, result: data },
    });
    return NextResponse.json({ coin: data });
  } catch (err) {
    console.error('[admin/coins POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to update coin' }, { status: 500 });
  }
}
