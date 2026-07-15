import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createUserNotification } from '@/lib/social/subscriberNotify';
import { compactUsd } from '@/lib/coins/format';
import { verifyCron } from '../_shared';

/**
 * One-tap DCA reminder poller. Pulls every active plan that is due (next_run_at
 * <= now and remaining_count > 0) and, for each, (1) claims the fire atomically
 * conditional on the row still being due so overlapping runs never double-notify,
 * (2) pings the user through the shared notification pipeline with a one-tap
 * prefilled buy deep link, and (3) advances next_run_at by interval_hours,
 * decrements remaining_count, and deactivates the plan when it reaches zero.
 *
 * Non-custodial: no session key exists, so this never executes a buy, it only
 * reminds. The user signs each buy themselves from the deep link. Real data
 * only: a plan is a user-owned row, never invented.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PlanRow {
  id: string;
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  usd_per_buy: number;
  interval_hours: number;
  remaining_count: number;
  next_run_at: string;
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: plans } = await db
    .from('coin_dca_plans')
    .select('id, user_id, chain, token_key, token_address, symbol, usd_per_buy, interval_hours, remaining_count, next_run_at')
    .eq('active', true)
    .gt('remaining_count', 0)
    .lte('next_run_at', nowIso)
    .limit(500);

  const list = (plans ?? []) as PlanRow[];
  if (list.length === 0) return NextResponse.json({ ok: true, checked: 0, fired: 0 });

  let fired = 0;
  for (const p of list) {
    const remaining = Number(p.remaining_count);
    const newRemaining = remaining - 1;
    const nextRunAt = new Date(new Date(p.next_run_at).getTime() + p.interval_hours * 3600 * 1000).toISOString();
    const stillActive = newRemaining > 0;

    // Claim the fire first, conditional on the row still being due with the same
    // next_run_at we read, so overlapping runs never double-notify.
    const { data: claimed } = await db
      .from('coin_dca_plans')
      .update({ remaining_count: newRemaining, next_run_at: nextRunAt, active: stillActive })
      .eq('id', p.id)
      .eq('active', true)
      .eq('next_run_at', p.next_run_at)
      .gt('remaining_count', 0)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const coinName = p.symbol || (p.token_address.length > 12
      ? `${p.token_address.slice(0, 6)}...${p.token_address.slice(-4)}`
      : p.token_address);
    const spend = compactUsd(p.usd_per_buy);
    const left = stillActive ? ` ${newRemaining} buy${newRemaining === 1 ? '' : 's'} left after this.` : ' This is your last scheduled buy.';

    await createUserNotification({
      userId: p.user_id,
      type: 'coin_dca',
      title: 'Time for your DCA buy',
      body: `Tap to sign your ${spend} buy of ${coinName}.${left}`,
      url: `/dashboard/coins/${p.chain}/${encodeURIComponent(p.token_address)}?buy=${p.usd_per_buy}`,
      metadata: {
        chain: p.chain,
        token_address: p.token_address,
        usd_per_buy: p.usd_per_buy,
        remaining_count: newRemaining,
        symbol: p.symbol,
      },
    });
    fired++;
  }

  return NextResponse.json({ ok: true, checked: list.length, fired });
}
