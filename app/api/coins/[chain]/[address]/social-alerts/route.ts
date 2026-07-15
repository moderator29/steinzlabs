import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { tokenKeyFor, resolveCoin } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/**
 * Social buy alerts for one coin. Owner-scoped: every read and write binds to
 * the authenticated user id, so the service-role client never crosses a user
 * boundary. Two scopes: 'following' (people the owner follows) and 'proven'
 * (the Proven trader set). The coin-social-buy-monitor cron fires them.
 */

const SCOPES = ['following', 'proven'] as const;
type Scope = (typeof SCOPES)[number];

function isScope(v: unknown): v is Scope {
  return typeof v === 'string' && (SCOPES as readonly string[]).includes(v);
}

/** GET my social alerts for this coin. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenKey = tokenKeyFor(chain, decodeURIComponent(address));

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_social_alerts')
    .select('id, scope, active, last_seen_at, created_at')
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load alerts' }, { status: 500 });

  return NextResponse.json({ alerts: data ?? [] });
}

/** POST create (or re-arm) an alert: body { scope }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenAddress = decodeURIComponent(address);

  let body: { scope?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!isScope(body.scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  // Resolve the coin so the row carries a real symbol and we never arm an alert
  // on a coin that is not a tradable, graduated token.
  const coin = await resolveCoin(chain, tokenAddress).catch(() => null);
  if (!coin) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_social_alerts')
    .upsert(
      {
        user_id: user.id,
        chain,
        token_key: coin.tokenKey,
        token_address: tokenAddress,
        symbol: coin.symbol,
        scope: body.scope,
        active: true,
        // Only watch from now on: never notify on trades that predate arming.
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chain,token_key,scope' },
    )
    .select('id, scope, active, last_seen_at, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not create alert' }, { status: 500 });

  return NextResponse.json({ alert: data });
}

/** DELETE an alert for this coin: ?scope=following|proven (owner-scoped). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = req.nextUrl.searchParams.get('scope');
  if (!isScope(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  const { chain, address } = await ctx.params;
  const tokenKey = tokenKeyFor(chain, decodeURIComponent(address));

  const db = getSupabaseAdmin();
  const { error } = await db
    .from('coin_social_alerts')
    .delete()
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .eq('scope', scope);
  if (error) return NextResponse.json({ error: 'Could not remove alert' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
