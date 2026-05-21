import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Pump.fun velocity poller — reads recently-traded tokens from the public
 * Pump.fun REST list, computes a crude bonding-curve velocity score
 * (current usd_market_cap delta vs the row we last wrote for the same
 * mint), and upserts into social_discovery for the ContextFeed.
 *
 * Real upstream API (no mock data per CLAUDE.md). If Pump.fun is down the
 * cron just no-ops; ContextFeed shows the most recent good data.
 *
 * Scheduled via vercel.json — see crons entry.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PUMPFUN_LIST_URL = 'https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=last_trade_timestamp&order=DESC&includeNsfw=false';

interface PumpfunCoin {
  mint?: string;
  symbol?: string;
  name?: string;
  usd_market_cap?: number;
  market_cap?: number;
  last_trade_timestamp?: number;
  reply_count?: number;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  let coins: PumpfunCoin[] = [];
  try {
    const res = await fetch(PUMPFUN_LIST_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'NakaLabs/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return cronResponse('pumpfun-velocity-poll', startedAt, { skipped: `upstream_${res.status}` });
    }
    const json = await res.json();
    coins = Array.isArray(json) ? json : Array.isArray(json?.coins) ? json.coins : [];
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'pumpfun-velocity-poll' } });
    return cronResponse('pumpfun-velocity-poll', startedAt, { skipped: 'fetch_failed' });
  }

  if (coins.length === 0) return cronResponse('pumpfun-velocity-poll', startedAt, { rows: 0 });

  const admin = getSupabaseAdmin();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);

  // Pull the last row per mint we have so we can compute the market-cap
  // delta as a velocity proxy. Pump.fun doesn't expose curve-acceleration
  // directly; cap-over-time is the cleanest available signal.
  const mints = coins.map((c) => c.mint).filter((m): m is string => !!m);
  const { data: prior } = await admin
    .from('social_discovery')
    .select('token_address, velocity_score, metadata, window_end')
    .eq('source', 'pumpfun')
    .in('token_address', mints)
    .order('window_end', { ascending: false })
    .limit(mints.length * 3);

  const priorByMint = new Map<string, { cap: number; ts: string } | null>();
  for (const r of prior ?? []) {
    if (!r.token_address || priorByMint.has(r.token_address)) continue;
    const md = (r.metadata as { usd_market_cap?: number } | null) ?? null;
    if (md && typeof md.usd_market_cap === 'number') {
      priorByMint.set(r.token_address, { cap: md.usd_market_cap, ts: r.window_end });
    }
  }

  const rows = coins
    .filter((c) => c.mint && (c.usd_market_cap ?? c.market_cap))
    .map((c) => {
      const cap = c.usd_market_cap ?? c.market_cap ?? 0;
      const prev = priorByMint.get(c.mint!);
      // % cap change per minute, normalized — proxy for bonding-curve velocity.
      let velocity_score = 0;
      if (prev && prev.cap > 0) {
        const minutes = Math.max(1, (now.getTime() - new Date(prev.ts).getTime()) / 60_000);
        velocity_score = ((cap - prev.cap) / prev.cap) * 100 / minutes;
      }
      return {
        source: 'pumpfun' as const,
        symbol: c.symbol ?? null,
        token_address: c.mint!,
        chain: 'solana',
        mention_count: c.reply_count ?? 0,
        thread_count: 0,
        velocity_score,
        window_start: windowStart.toISOString(),
        window_end: now.toISOString(),
        metadata: { usd_market_cap: cap, name: c.name },
      };
    });

  if (rows.length === 0) return cronResponse('pumpfun-velocity-poll', startedAt, { rows: 0 });

  const { error } = await admin.from('social_discovery').insert(rows);
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'pumpfun-velocity-poll' } });
    return cronResponse('pumpfun-velocity-poll', startedAt, { error: error.message });
  }
  return cronResponse('pumpfun-velocity-poll', startedAt, { rows: rows.length });
}
