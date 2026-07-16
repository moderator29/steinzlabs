import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin, tokenKeyFor } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/**
 * Armed "limit buy" intents for one coin. Owner-scoped: every read and write is
 * bound to the authenticated user id, so the service-role client never crosses
 * a user boundary. Non-custodial: an intent never executes on its own. The
 * coin-intent-monitor cron pings the user to sign the instant a trigger hits.
 */

const TRIGGER_KINDS = ['price_below', 'price_above', 'mcap_below', 'mcap_above'] as const;
type TriggerKind = (typeof TRIGGER_KINDS)[number];

function isKind(v: unknown): v is TriggerKind {
  return typeof v === 'string' && (TRIGGER_KINDS as readonly string[]).includes(v);
}

const SELECT_COLS = 'id, chain, token_key, token_address, symbol, trigger_kind, threshold, amount_usd, active, created_at, triggered_at';

/** GET my armed intents for this coin. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenKey = tokenKeyFor(chain, decodeURIComponent(address));

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_trade_intents')
    .select(SELECT_COLS)
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load intents' }, { status: 500 });

  return NextResponse.json({ intents: data ?? [] });
}

/** POST arm an intent: body { trigger_kind, threshold, amount_usd }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenAddress = decodeURIComponent(address);

  let body: { trigger_kind?: unknown; threshold?: unknown; amount_usd?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!isKind(body.trigger_kind)) return NextResponse.json({ error: 'Invalid trigger kind' }, { status: 400 });
  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return NextResponse.json({ error: 'Threshold must be a positive number' }, { status: 400 });
  }
  const amountUsd = Number(body.amount_usd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
  }

  // Resolve the coin so we store a real symbol / token_key and only arm intents
  // on a coin that actually exists on this chain. Real data only.
  const coin = await resolveCoin(chain, tokenAddress);
  if (!coin) return NextResponse.json({ error: 'Coin not found on this chain' }, { status: 404 });

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_trade_intents')
    .insert({
      user_id: user.id,
      chain,
      token_key: coin.tokenKey,
      token_address: coin.tokenAddress,
      symbol: coin.symbol || null,
      trigger_kind: body.trigger_kind,
      threshold,
      amount_usd: amountUsd,
      active: true,
    })
    .select(SELECT_COLS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not arm intent' }, { status: 500 });

  return NextResponse.json({ intent: data });
}

/** DELETE an intent: ?id=<uuid> (owner-scoped). */
export async function DELETE(req: NextRequest, _ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing intent id' }, { status: 400 });

  const db = getSupabaseAdmin();
  const { error } = await db
    .from('coin_trade_intents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not remove intent' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
