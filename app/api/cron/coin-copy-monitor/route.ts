import 'server-only';
import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createUserNotification } from '@/lib/social/subscriberNotify';

/**
 * Coin copy-trading monitor. For each active coin-scoped copy rule (a follower
 * copying a leader's on-platform coin buys), find the leader's new buys since
 * the rule's cursor and ping the follower to sign a matching buy in their own
 * wallet. Non-custodial and notify-to-sign, exactly like limit-buy / DCA: we
 * never move the follower's funds; we surface a one-tap prefilled buy. The rule
 * cursor (coin_last_seen_at) advances so each leader buy is copied once.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PER_RULE_CAP = 5; // most copy pings per rule per run, so a burst can't flood.

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();

  const { data: rulesRaw, error } = await db
    .from('user_copy_rules')
    .select('id, user_id, leader_user_id, max_per_trade_usd, coin_last_seen_at, enabled, paused')
    .not('leader_user_id', 'is', null)
    .eq('enabled', true)
    .limit(2000);
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'coin-copy-monitor' } });
    return cronResponse('coin-copy-monitor', startedAt, { error: error.message });
  }
  const rules = ((rulesRaw as Array<{
    id: string; user_id: string; leader_user_id: string; max_per_trade_usd: number | null; coin_last_seen_at: string | null; paused: boolean | null;
  }>) ?? []).filter((r) => r.paused !== true && r.user_id !== r.leader_user_id);
  if (rules.length === 0) return cronResponse('coin-copy-monitor', startedAt, { rules: 0 });

  // Leader display names, fetched once.
  const leaderIds = [...new Set(rules.map((r) => r.leader_user_id))];
  const nameById = new Map<string, string>();
  const { data: profs } = await db.from('profiles').select('id, username, display_name').in('id', leaderIds);
  for (const p of (profs as Array<{ id: string; username: string | null; display_name: string | null }>) ?? []) {
    nameById.set(p.id, p.display_name || p.username || 'A trader');
  }

  let pinged = 0;
  for (const rule of rules) {
    const since = rule.coin_last_seen_at ?? new Date(Date.now() - 3600_000).toISOString();
    const { data: buysRaw } = await db
      .from('coin_trades')
      .select('chain, token_address, symbol, usd_amount, created_at')
      .eq('user_id', rule.leader_user_id)
      .eq('side', 'buy')
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(PER_RULE_CAP);
    const buys = (buysRaw as Array<{ chain: string; token_address: string; symbol: string | null; usd_amount: number; created_at: string }>) ?? [];
    if (buys.length === 0) continue;

    const cap = Number(rule.max_per_trade_usd) > 0 ? Number(rule.max_per_trade_usd) : 25;
    const leaderName = nameById.get(rule.leader_user_id) ?? 'A trader';

    for (const b of buys) {
      const copyUsd = Math.max(1, Math.min(cap, Math.round(Number(b.usd_amount) || cap)));
      const sym = b.symbol ? `$${b.symbol}` : 'a coin';
      const url = `/dashboard/coins/${b.chain}/${encodeURIComponent(b.token_address)}?buy=${copyUsd}`;
      try {
        await createUserNotification({
          userId: rule.user_id,
          type: 'coins.copy_buy',
          title: `${leaderName} just bought ${sym}`,
          body: `Tap to copy with a $${copyUsd} buy. You sign it in your own wallet.`,
          url,
          metadata: { kind: 'copy_buy', leaderUserId: rule.leader_user_id },
        });
        pinged += 1;
      } catch { /* best-effort; cursor still advances so we do not re-ping */ }
    }

    // Advance the cursor past the newest buy we just handled.
    const newest = buys[buys.length - 1].created_at;
    await db.from('user_copy_rules').update({ coin_last_seen_at: newest }).eq('id', rule.id);
  }

  return cronResponse('coin-copy-monitor', startedAt, { rules: rules.length, pinged });
}
