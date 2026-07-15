import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin, tokenKeyFor } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/**
 * One-tap DCA plans for one coin. Owner-scoped: every read and write is bound to
 * the authenticated user id, so the service-role client never crosses a user
 * boundary. Non-custodial: no session key exists, so a plan never auto-signs. It
 * is a scheduled reminder. The coin-dca cron pings the user with a one-tap
 * prefilled buy deep link on each due date; the user signs each buy themselves.
 */

const SELECT_COLS =
  'id, chain, token_key, token_address, symbol, usd_per_buy, interval_hours, remaining_count, next_run_at, active, created_at';

/** GET my DCA plans for this coin. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenKey = tokenKeyFor(chain, decodeURIComponent(address));

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_dca_plans')
    .select(SELECT_COLS)
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load plans' }, { status: 500 });

  return NextResponse.json({ plans: data ?? [] });
}

/** POST set up a plan: body { usdPerBuy, intervalHours (default 24), count }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenAddress = decodeURIComponent(address);

  let body: { usdPerBuy?: unknown; intervalHours?: unknown; count?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const usdPerBuy = Number(body.usdPerBuy);
  if (!Number.isFinite(usdPerBuy) || usdPerBuy <= 0) {
    return NextResponse.json({ error: 'Amount per buy must be a positive number' }, { status: 400 });
  }
  const intervalHours = body.intervalHours == null ? 24 : Number(body.intervalHours);
  if (!Number.isInteger(intervalHours) || intervalHours < 1) {
    return NextResponse.json({ error: 'Interval must be a whole number of hours' }, { status: 400 });
  }
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 90) {
    return NextResponse.json({ error: 'Count must be between 1 and 90' }, { status: 400 });
  }

  // Resolve the coin so we store a real symbol / token_key and only set up a
  // plan on a coin that actually exists on this chain. Real data only.
  const coin = await resolveCoin(chain, tokenAddress);
  if (!coin) return NextResponse.json({ error: 'Coin not found on this chain' }, { status: 404 });

  const nextRunAt = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_dca_plans')
    .insert({
      user_id: user.id,
      chain,
      token_key: coin.tokenKey,
      token_address: coin.tokenAddress,
      symbol: coin.symbol || null,
      usd_per_buy: usdPerBuy,
      interval_hours: intervalHours,
      remaining_count: count,
      next_run_at: nextRunAt,
      active: true,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not set up plan' }, { status: 500 });

  return NextResponse.json({ plan: data });
}

/** DELETE a plan: ?id=<uuid> (owner-scoped). */
export async function DELETE(req: NextRequest, _ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing plan id' }, { status: 400 });

  const db = getSupabaseAdmin();
  const { error } = await db
    .from('coin_dca_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not remove plan' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
