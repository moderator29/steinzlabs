import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getLivePrice } from '@/lib/coins/coinService';
import { createUserNotification } from '@/lib/social/subscriberNotify';
import { compactUsd, coinPrice } from '@/lib/coins/format';
import { verifyCron } from '../_shared';

/**
 * Limit-buy intent poller. Pulls every armed intent, resolves the live price +
 * market cap once per distinct coin, and for each intent that crossed its
 * trigger it (1) claims the row atomically, (2) pings the user to sign the buy
 * through the shared notification pipeline (deep link prefills the buy on the
 * coin page), and (3) stamps triggered_at + deactivates. Non-custodial: this
 * never executes a trade, it only notifies. Real data only: an intent never
 * fires without a live figure to compare against.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface IntentRow {
  id: string;
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  trigger_kind: 'price_below' | 'price_above' | 'mcap_below' | 'mcap_above';
  threshold: number;
  amount_usd: number;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const { data: intents } = await db
    .from('coin_trade_intents')
    .select('id, user_id, chain, token_key, token_address, symbol, trigger_kind, threshold, amount_usd')
    .eq('active', true)
    .is('triggered_at', null)
    .limit(500);

  const list = (intents ?? []) as IntentRow[];
  if (list.length === 0) return NextResponse.json({ ok: true, checked: 0, fired: 0 });

  // One live lookup per distinct coin, shared across that coin's intents.
  const byCoin = new Map<string, { chain: string; address: string }>();
  for (const i of list) {
    byCoin.set(`${i.chain}:${i.token_key}`, { chain: i.chain, address: i.token_address });
  }
  const liveByCoin = new Map<string, { priceUsd: number | null; marketCapUsd: number | null }>();
  await Promise.all(
    Array.from(byCoin.entries()).map(async ([key, c]) => {
      const live = await getLivePrice(c.chain, c.address).catch(() => null);
      if (live) liveByCoin.set(key, { priceUsd: live.priceUsd, marketCapUsd: live.marketCapUsd });
    }),
  );

  let fired = 0;
  for (const i of list) {
    const live = liveByCoin.get(`${i.chain}:${i.token_key}`);
    if (!live) continue;

    const isPrice = i.trigger_kind === 'price_above' || i.trigger_kind === 'price_below';
    const value = isPrice ? live.priceUsd : live.marketCapUsd;
    if (value == null || !Number.isFinite(value)) continue;

    const threshold = Number(i.threshold);
    const above = i.trigger_kind === 'price_above' || i.trigger_kind === 'mcap_above';
    const crossed = above ? value >= threshold : value <= threshold;
    if (!crossed) continue;

    // Claim the row first, conditional on it still being armed, so overlapping
    // runs never double-notify.
    const { data: claimed } = await db
      .from('coin_trade_intents')
      .update({ triggered_at: new Date().toISOString(), active: false })
      .eq('id', i.id)
      .eq('active', true)
      .is('triggered_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const shown = isPrice ? coinPrice(value) : compactUsd(value);
    const target = isPrice ? coinPrice(threshold) : compactUsd(threshold);
    const metric = isPrice ? 'price' : 'market cap';
    const dir = above ? 'above' : 'below';
    const coinName = i.symbol || (i.token_address.length > 12
      ? `${i.token_address.slice(0, 6)}...${i.token_address.slice(-4)}`
      : i.token_address);
    const spend = compactUsd(i.amount_usd);

    await createUserNotification({
      userId: i.user_id,
      type: 'coin_limit_buy',
      title: 'Limit buy ready',
      body: `${coinName} ${metric} is ${dir} ${target} (at ${shown}). Tap to sign your ${spend} buy.`,
      url: `/dashboard/coins/${i.chain}/${encodeURIComponent(i.token_address)}?buy=${i.amount_usd}`,
      metadata: {
        chain: i.chain,
        token_address: i.token_address,
        trigger_kind: i.trigger_kind,
        threshold,
        value,
        amount_usd: i.amount_usd,
        symbol: i.symbol,
      },
    });
    fired++;
  }

  return NextResponse.json({ ok: true, checked: list.length, fired });
}
