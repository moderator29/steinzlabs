import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { tokenKeyFor } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/**
 * Price / market-cap alert bells for one coin. Owner-scoped: every read and
 * write is bound to the authenticated user id, so the service-role client never
 * crosses a user boundary. The coin-alerts cron fires them.
 */

const ALERT_KINDS = ['price_above', 'price_below', 'mcap_above', 'mcap_below'] as const;
type AlertKind = (typeof ALERT_KINDS)[number];

function isKind(v: unknown): v is AlertKind {
  return typeof v === 'string' && (ALERT_KINDS as readonly string[]).includes(v);
}

/** GET my alerts for this coin. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenKey = tokenKeyFor(chain, decodeURIComponent(address));

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_alerts')
    .select('id, kind, threshold, active, created_at, triggered_at')
    .eq('user_id', user.id)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load alerts' }, { status: 500 });

  return NextResponse.json({ alerts: data ?? [] });
}

/** POST create an alert: body { kind, threshold }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chain, address } = await ctx.params;
  const tokenAddress = decodeURIComponent(address);

  let body: { kind?: unknown; threshold?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!isKind(body.kind)) return NextResponse.json({ error: 'Invalid alert kind' }, { status: 400 });
  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return NextResponse.json({ error: 'Threshold must be a positive number' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('coin_alerts')
    .insert({
      user_id: user.id,
      chain,
      token_key: tokenKeyFor(chain, tokenAddress),
      token_address: tokenAddress,
      kind: body.kind,
      threshold,
      active: true,
    })
    .select('id, kind, threshold, active, created_at, triggered_at')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not create alert' }, { status: 500 });

  return NextResponse.json({ alert: data });
}

/** DELETE an alert: ?id=<uuid> (owner-scoped). */
export async function DELETE(req: NextRequest, _ctx: { params: Promise<{ chain: string; address: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing alert id' }, { status: 400 });

  const db = getSupabaseAdmin();
  const { error } = await db
    .from('coin_alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not remove alert' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
