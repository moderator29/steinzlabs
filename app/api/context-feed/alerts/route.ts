import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Per-user Context Feed alerts.
 *   GET    -> list the caller's alerts
 *   POST   -> create one  { label, chain?, kind?, min_volume_usd?, min_price_change_pct? }
 *   PATCH  -> update one   { id, active?, label?, min_volume_usd?, min_price_change_pct? }
 *   DELETE ?id=<uuid> -> remove one
 *
 * The feed-alert-monitor cron matches active alerts against new feed events and
 * writes a notifications row (real-time via the notifications publication).
 */

const MAX_ALERTS = 25;

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('feed_alerts')
    .select('id, label, chain, kind, min_volume_usd, min_price_change_pct, active, last_triggered_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

const PostBody = z.object({
  label: z.string().min(1).max(80),
  chain: z.enum(['ethereum', 'base', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche', 'solana']).optional(),
  kind: z.enum(['any', 'new_coin', 'volume', 'trending', 'rug', 'smart_money']).default('any'),
  min_volume_usd: z.number().nonnegative().max(1e12).optional(),
  min_price_change_pct: z.number().min(-100).max(100000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { count } = await sb.from('feed_alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= MAX_ALERTS) {
    return NextResponse.json({ error: `Alert limit reached (${MAX_ALERTS}).` }, { status: 409 });
  }

  const { data, error } = await sb
    .from('feed_alerts')
    .insert({
      user_id: user.id,
      label: parsed.data.label,
      chain: parsed.data.chain ?? null,
      kind: parsed.data.kind,
      min_volume_usd: parsed.data.min_volume_usd ?? null,
      min_price_change_pct: parsed.data.min_price_change_pct ?? null,
    })
    .select('id, label, chain, kind, min_volume_usd, min_price_change_pct, active, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

const PatchBody = z.object({
  id: z.string().uuid(),
  active: z.boolean().optional(),
  label: z.string().min(1).max(80).optional(),
  min_volume_usd: z.number().nonnegative().max(1e12).nullable().optional(),
  min_price_change_pct: z.number().min(-100).max(100000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { id, ...rest } = parsed.data;
  const updates = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Ownership-scoped: the .eq('user_id', ...) is the actual control (admin
  // client bypasses RLS), so user A can never patch user B's alert.
  const { data, error } = await sb
    .from('feed_alerts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, label, chain, kind, min_volume_usd, min_price_change_pct, active, last_triggered_at, created_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ alert: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('feed_alerts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
