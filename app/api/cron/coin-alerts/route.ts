import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getLivePrice } from '@/lib/coins/coinService';
import { createUserNotification } from '@/lib/social/subscriberNotify';
import { compactUsd, coinPrice } from '@/lib/coins/format';
import { verifyCron } from '../_shared';

/**
 * Coin price / market-cap alert poller. Pulls every armed coin alert, resolves
 * the live price + market cap once per distinct coin, and for each alert that
 * crossed its threshold it (1) claims the row atomically, (2) sends an in-app
 * (+ Telegram) notification through the shared pipeline, and (3) stamps
 * triggered_at + deactivates. Real data only: an alert never fires without a
 * live figure to compare against.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AlertRow {
  id: string;
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string;
  kind: 'price_above' | 'price_below' | 'mcap_above' | 'mcap_below';
  threshold: number;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const { data: alerts } = await db
    .from('coin_alerts')
    .select('id, user_id, chain, token_key, token_address, kind, threshold')
    .eq('active', true)
    .is('triggered_at', null)
    .limit(500);

  const list = (alerts ?? []) as AlertRow[];
  if (list.length === 0) return NextResponse.json({ ok: true, checked: 0, fired: 0 });

  // One live lookup per distinct coin, shared across that coin's alerts.
  const byCoin = new Map<string, { chain: string; address: string }>();
  for (const a of list) {
    byCoin.set(`${a.chain}:${a.token_key}`, { chain: a.chain, address: a.token_address });
  }
  const liveByCoin = new Map<string, { priceUsd: number | null; marketCapUsd: number | null }>();
  await Promise.all(
    Array.from(byCoin.entries()).map(async ([key, c]) => {
      const live = await getLivePrice(c.chain, c.address).catch(() => null);
      if (live) liveByCoin.set(key, { priceUsd: live.priceUsd, marketCapUsd: live.marketCapUsd });
    }),
  );

  let fired = 0;
  for (const a of list) {
    const live = liveByCoin.get(`${a.chain}:${a.token_key}`);
    if (!live) continue;

    const isPrice = a.kind === 'price_above' || a.kind === 'price_below';
    const value = isPrice ? live.priceUsd : live.marketCapUsd;
    if (value == null || !Number.isFinite(value)) continue;

    const threshold = Number(a.threshold);
    const above = a.kind === 'price_above' || a.kind === 'mcap_above';
    const crossed = above ? value >= threshold : value <= threshold;
    if (!crossed) continue;

    // Claim the row first, conditional on it still being armed, so overlapping
    // runs never double-notify.
    const { data: claimed } = await db
      .from('coin_alerts')
      .update({ triggered_at: new Date().toISOString(), active: false })
      .eq('id', a.id)
      .eq('active', true)
      .is('triggered_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const shown = isPrice ? coinPrice(value) : compactUsd(value);
    const target = isPrice ? coinPrice(threshold) : compactUsd(threshold);
    const metric = isPrice ? 'Price' : 'Market cap';
    const dir = above ? 'above' : 'below';
    const label = a.token_address.length > 12
      ? `${a.token_address.slice(0, 6)}...${a.token_address.slice(-4)}`
      : a.token_address;

    await createUserNotification({
      userId: a.user_id,
      type: 'coin_alert',
      title: `${metric} alert hit`,
      body: `${metric} is now ${dir} ${target} (at ${shown}).`,
      url: `/dashboard/coins/${a.chain}/${encodeURIComponent(a.token_address)}`,
      metadata: { chain: a.chain, token_address: a.token_address, kind: a.kind, threshold, value, label },
    });
    fired++;
  }

  return NextResponse.json({ ok: true, checked: list.length, fired });
}
