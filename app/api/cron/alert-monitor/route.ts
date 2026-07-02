/**
 * Alert monitor — evaluates user price alerts against the live price cache.
 *
 * Source: price_alerts (one row per user-set target).
 *   - direction = 'above' | 'below'
 *   - price     = numeric target
 *   - token_id  = canonical coingecko id (the price-cache-refresh cron keys by this)
 *
 * The cron walks every alert with triggered=false, looks up the live price in
 * Redis (price:cg:<id> or price:sym:<symbol>), evaluates the direction
 * predicate, and on fire it (a) sets triggered=true/triggered_at, (b) inserts
 * one row into notifications so the in-app bell + provider light up.
 *
 * Real-API rule: when the price cache is cold for a token, the row is
 * skipped. Never fire on a fabricated price. The cache stays warm via the
 * price-cache-refresh cron (top 100 tokens, 5-min TTL, refreshed every 30 min).
 *
 * Cadence: every 5 minutes in vercel.json so the user sees an alert within
 * minutes of the target being hit. The cache itself is the latency floor.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheGet } from '@/lib/cache/redis';
import { evaluateExpression } from '@/lib/alerts/evaluateComposite';
import { fanOutNotification } from '@/lib/notifications/channels';
import { getDexPrice } from '@/lib/services/dexscreener';
import {
  evaluatePrice, evaluateWallet, evaluateLaunch, resetLaunchCache,
  ALERT_CHAINS,
  type AlertChain, type AlertCursor, type PriceCondition, type WhaleCondition,
  type WalletActivityCondition, type LaunchCondition,
} from '@/lib/alerts/smartAlerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAME = 'alert-monitor';

interface PriceAlertRow {
  id: string;
  user_id: string;
  token_id: string | null;
  token_symbol: string | null;
  direction: 'above' | 'below' | string;
  price: number;
  chain: string | null;
}

const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

interface CachedPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
  fetchedAt: number;
}

async function priceFor(tokenId: string | null, symbol: string | null): Promise<number | null> {
  // Sniper memecoin alerts store token_id = EVM contract address (not a
  // CoinGecko id), so they're never in the CG/symbol cache. Resolve those by
  // contract via DexScreener so address-keyed alerts can actually fire.
  if (tokenId && isEvmAddress(tokenId)) {
    try {
      const p = await getDexPrice(tokenId);
      if (typeof p === 'number' && p > 0) return p;
    } catch { /* fall through */ }
    return null;
  }
  if (tokenId) {
    const v = await cacheGet<CachedPrice>(`price:cg:${tokenId}`);
    if (v && typeof v.price === 'number') return v.price;
  }
  if (symbol) {
    const v = await cacheGet<CachedPrice>(`price:sym:${symbol.toLowerCase()}`);
    if (v && typeof v.price === 'number') return v.price;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  const { data: rows, error: fetchErr } = await admin
    .from('price_alerts')
    .select('id,user_id,token_id,token_symbol,direction,price,chain')
    .eq('triggered', false)
    .limit(1000);

  if (fetchErr) {
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, fetchErr.message, 0);
    return cronResponse(NAME, startedAt, { error: fetchErr.message });
  }

  const alerts = (rows ?? []) as PriceAlertRow[];
  if (alerts.length === 0) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse(NAME, startedAt, { scanned: 0, fired: 0, skipped_no_price: 0 });
  }

  let fired = 0;
  let skippedNoPrice = 0;
  const nowIso = new Date().toISOString();

  for (const a of alerts) {
    const live = await priceFor(a.token_id, a.token_symbol);
    if (live == null) {
      skippedNoPrice++;
      continue;
    }
    const hits =
      a.direction === 'above'
        ? live >= Number(a.price)
        : a.direction === 'below'
          ? live <= Number(a.price)
          : false;
    if (!hits) continue;

    // Atomic-ish flip — re-check triggered=false on the WHERE so a parallel
    // tick can't double-fire. supabase-js doesn't surface affected-row count
    // here, but the conditional update means at most one row transitions.
    const { error: updErr } = await admin
      .from('price_alerts')
      .update({ triggered: true, triggered_at: nowIso })
      .eq('id', a.id)
      .eq('triggered', false);
    if (updErr) continue;

    const symbol = (a.token_symbol ?? a.token_id ?? 'token').toUpperCase();
    const dirArrow = a.direction === 'above' ? '↑' : '↓';
    // Deliver over every channel the user configured (Telegram / web-push /
    // email / Discord / SMS), not just the in-app bell. fanOutNotification
    // writes the durable in-app row itself, so we do NOT also insert here.
    // Tag metadata.source='smart_alert' so price alerts finally surface in
    // /api/alerts/history (they never did while inserted untagged).
    await fanOutNotification({
      user_id: a.user_id,
      title: `${symbol} ${dirArrow} ${a.price}`,
      message: `${symbol} is now $${live.toLocaleString(undefined, { maximumFractionDigits: 6 })} · target $${a.price} ${a.direction === 'above' ? 'breached' : 'reached'}.`,
      type: 'price',
      url: a.token_id ? `/dashboard/intelligence/${a.token_id}` : '/dashboard/alerts',
      metadata: { source: 'smart_alert', price_alert_id: a.id },
    });
    fired++;
  }

  // ALERT2: composite alert evaluation. Pulls active rows whose cooldown
  // has elapsed, evaluates the JSON expression tree against live price
  // cache, fires via fanOutNotification, and stamps last_triggered_at on
  // success. Cold-data evaluations (null) skip without stamping so the
  // alert re-attempts on the next tick.
  let compositeFired = 0;
  let compositeColdSkipped = 0;
  const { data: composites } = await admin
    .from('composite_alerts')
    .select('id, user_id, name, expression, cooldown_seconds, last_triggered_at')
    .eq('active', true)
    .limit(500);
  for (const c of (composites ?? []) as Array<{
    id: string; user_id: string; name: string;
    expression: unknown; cooldown_seconds: number; last_triggered_at: string | null;
  }>) {
    if (c.last_triggered_at) {
      const ageMs = Date.now() - new Date(c.last_triggered_at).getTime();
      if (ageMs < c.cooldown_seconds * 1000) continue;
    }
    let result: boolean | null;
    try {
      result = await evaluateExpression(c.expression);
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, composite_id: c.id } });
      continue;
    }
    if (result === null) { compositeColdSkipped++; continue; }
    if (result !== true) continue;

    const { error: stampErr } = await admin
      .from('composite_alerts')
      .update({ last_triggered_at: nowIso })
      .eq('id', c.id)
      // Guard against a concurrent tick firing the same alert twice.
      .or(`last_triggered_at.is.null,last_triggered_at.lt.${new Date(Date.now() - c.cooldown_seconds * 1000).toISOString()}`);
    if (stampErr) continue;

    try {
      await fanOutNotification({
        user_id: c.user_id,
        title: c.name,
        message: 'Composite alert condition met.',
        type: 'composite_alert',
        metadata: { composite_alert_id: c.id },
      });
      compositeFired++;
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, composite_id: c.id } });
    }
  }

  // Smart Alerts (public.alerts): the four alert types created on
  // /dashboard/alerts — price, whale, wallet_activity, launch. These used to
  // run client-side off localStorage (died on tab close, never synced). Now
  // they're server-evaluated here against real free sources. Each evaluator
  // returns a fire message (or null), an advanced cursor, and a `cold` flag;
  // cold rows are skipped WITHOUT stamping so they re-attempt next tick and we
  // never persist a decision made on missing data.
  resetLaunchCache();
  const smartResult = await evaluateSmartAlerts(admin);

  // Wallet-Intelligence alerts (user_wallet_alerts). These rows were written by
  // /api/wallet-intelligence/alerts but NO cron ever evaluated them, so they
  // never fired. Evaluate them here against the same real on-chain sources the
  // Smart Alert wallet evaluator uses, and dispatch via fanOutNotification.
  const walletIntelResult = await evaluateWalletIntelAlerts(admin);

  try {
    await logCronExecution(
      NAME, 'success', Date.now() - startedAt, undefined,
      fired + compositeFired + smartResult.fired + walletIntelResult.fired,
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
  }
  return cronResponse(NAME, startedAt, {
    scanned: alerts.length,
    fired,
    skipped_no_price: skippedNoPrice,
    composite_scanned: composites?.length ?? 0,
    composite_fired: compositeFired,
    composite_cold_skipped: compositeColdSkipped,
    smart_scanned: smartResult.scanned,
    smart_fired: smartResult.fired,
    smart_cold_skipped: smartResult.cold,
    wallet_intel_scanned: walletIntelResult.scanned,
    wallet_intel_fired: walletIntelResult.fired,
    wallet_intel_cold_skipped: walletIntelResult.cold,
  });
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

interface SmartAlertRow {
  id: string;
  user_id: string;
  alert_type: string;
  label: string;
  condition: Record<string, unknown>;
  active: boolean;
}

/**
 * Evaluate every active Smart Alert and fire real notifications. Returns the
 * scan/fire/cold tallies for the cron response. A fired alert (a) writes a
 * notifications row tagged metadata.source='smart_alert' so the in-app bell +
 * /api/alerts/history light up, (b) persists the advanced cursor (trigger
 * count, lastChecked, lastTxHash) back into condition, and (c) deactivates
 * one-shot price alerts. Per-row failures are isolated so one bad row can't
 * abort the whole sweep.
 */
async function evaluateSmartAlerts(admin: Admin): Promise<{ scanned: number; fired: number; cold: number }> {
  const { data: rows, error } = await admin
    .from('alerts')
    .select('id, user_id, alert_type, label, condition, active')
    .in('alert_type', ['price', 'whale', 'wallet_activity', 'launch'])
    .eq('active', true)
    .limit(1000);

  if (error || !rows) return { scanned: 0, fired: 0, cold: 0 };

  let fired = 0;
  let cold = 0;
  const nowIso = new Date().toISOString();

  for (const raw of rows as SmartAlertRow[]) {
    const condition = (raw.condition ?? {}) as Record<string, unknown>;
    const cursor = (condition.cursor ?? { lastChecked: 0, triggerCount: 0 }) as AlertCursor;

    try {
      let result;
      switch (raw.alert_type) {
        case 'price':
          result = await evaluatePrice({ ...(condition as unknown as PriceCondition), cursor });
          break;
        case 'whale':
          result = await evaluateWallet({ ...(condition as unknown as WhaleCondition), cursor }, 'whale');
          break;
        case 'wallet_activity':
          result = await evaluateWallet({ ...(condition as unknown as WalletActivityCondition), cursor }, 'wallet_activity');
          break;
        case 'launch':
          result = await evaluateLaunch({ ...(condition as unknown as LaunchCondition), cursor });
          break;
        default:
          continue;
      }

      if (result.cold) { cold++; continue; }

      const nextCondition = { ...condition, cursor: result.cursor };
      const update: Record<string, unknown> = { condition: nextCondition };

      if (result.fire) {
        if (result.fire.oneShot) {
          update.active = false;
          update.triggered = true;
          update.triggered_at = nowIso;
        }
        // Fan out to the user's configured channels (Telegram / web-push /
        // email / Discord / SMS). fanOutNotification writes the durable in-app
        // row itself — do NOT also insert, or the bell double-fires.
        await fanOutNotification({
          user_id: raw.user_id,
          title: raw.label,
          message: result.fire.message,
          type: raw.alert_type === 'price' ? 'price'
            : raw.alert_type === 'launch' ? 'new_launch'
              : raw.alert_type === 'whale' ? 'whale' : 'wallet_activity',
          url: '/dashboard/alerts',
          metadata: { source: 'smart_alert', smart_alert_id: raw.id, smart_alert_type: raw.alert_type },
        });
        fired++;
      }

      await admin.from('alerts').update(update).eq('id', raw.id).eq('user_id', raw.user_id);
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, smart_alert_id: raw.id } });
    }
  }

  return { scanned: rows.length, fired, cold };
}

// On a follow's first evaluation (no watermark yet) only look back this far so
// enabling an alert never dumps the wallet's entire history. Mirrors the
// whale-alert-dispatcher's COLD_START_LOOKBACK_MS.
const WALLET_INTEL_COLD_START_LOOKBACK_MS = 15 * 60 * 1000;

interface WalletIntelAlertRow {
  id: string;
  user_id: string;
  wallet_address: string;
  chain: string;
  alert_on: unknown;
  min_trade_usd: number | null;
  last_alerted_at: string | null;
  last_seen_tx: string | null;
}

/**
 * Evaluate active user_wallet_alerts against real on-chain activity and fan out
 * over the owner's channels. Reuses smartAlerts.evaluateWallet (Etherscan-family
 * explorers + public Solana RPC + live CoinGecko native price — no fabricated
 * data). Dedup is a forward-only watermark (last_alerted_at / last_seen_tx),
 * claimed with a CAS before dispatch so overlapping ticks can't double-fire —
 * the same pattern the whale-alert-dispatcher uses. Requires the watermark
 * columns from migration 2026_wallet_intel_alert_watermark.sql; if they're
 * absent the row fetch errors and we no-op safely without crashing the cron.
 */
async function evaluateWalletIntelAlerts(admin: Admin): Promise<{ scanned: number; fired: number; cold: number }> {
  const { data: rows, error } = await admin
    .from('user_wallet_alerts')
    .select('id, user_id, wallet_address, chain, alert_on, min_trade_usd, last_alerted_at, last_seen_tx')
    .eq('enabled', true)
    .limit(1000);

  if (error || !rows) return { scanned: 0, fired: 0, cold: 0 };

  let fired = 0;
  let cold = 0;
  const nowIso = new Date().toISOString();

  for (const row of rows as WalletIntelAlertRow[]) {
    try {
      // Only chains the wallet evaluator can actually resolve. Anything else is
      // skipped rather than valued against the wrong explorer.
      const chain = String(row.chain).toLowerCase();
      if (!ALERT_CHAINS.includes(chain as AlertChain)) continue;
      const alertChain = chain as AlertChain;

      const alertOn = Array.isArray(row.alert_on) ? (row.alert_on as string[]) : [];
      const minUsd = row.min_trade_usd != null ? Number(row.min_trade_usd) : 0;
      // 'large_trade' with a USD floor → whale-style USD-thresholded eval;
      // otherwise fire on any fresh on-chain activity (covers 'new_token').
      const kind: 'whale' | 'wallet_activity' =
        alertOn.includes('large_trade') && minUsd > 0 ? 'whale' : 'wallet_activity';

      const sinceMs = row.last_alerted_at
        ? new Date(row.last_alerted_at).getTime()
        : Date.now() - WALLET_INTEL_COLD_START_LOOKBACK_MS;
      const cursor: AlertCursor = {
        lastChecked: sinceMs,
        triggerCount: 0,
        lastTxHash: row.last_seen_tx ?? undefined,
      };

      const condition = kind === 'whale'
        ? ({ walletAddress: row.wallet_address, threshold: minUsd, chain: alertChain, cursor } as WhaleCondition)
        : ({ walletAddress: row.wallet_address, chain: alertChain, cursor } as WalletActivityCondition);

      const result = await evaluateWallet(condition, kind);

      // Cold source (RPC/explorer/price unavailable): skip without stamping so
      // we re-attempt next tick and never persist a decision on missing data.
      if (result.cold) { cold++; continue; }

      if (!result.fire) {
        // No fresh qualifying activity — advance the watermark forward so the
        // next tick scans only newer transactions.
        await admin.from('user_wallet_alerts').update({ last_alerted_at: nowIso }).eq('id', row.id);
        continue;
      }

      const newHash = result.cursor.lastTxHash;
      if (!newHash) continue;

      // Forward-only CAS claim BEFORE dispatch: only the tick that flips
      // last_seen_tx to this hash notifies, so two overlapping ticks reading the
      // same watermark can't both fire the same transaction.
      const { data: claimed } = await admin
        .from('user_wallet_alerts')
        .update({ last_alerted_at: nowIso, last_seen_tx: newHash })
        .eq('id', row.id)
        .or(`last_seen_tx.is.null,last_seen_tx.neq.${newHash}`)
        .select('id');
      if (!claimed || claimed.length === 0) continue;

      const short = `${row.wallet_address.slice(0, 6)}…${row.wallet_address.slice(-4)}`;
      await fanOutNotification({
        user_id: row.user_id,
        title: `Wallet activity · ${short}`,
        message: result.fire.message,
        type: 'wallet_activity',
        url: '/dashboard/wallet-intelligence',
        metadata: {
          source: 'wallet_intel_alert',
          wallet_alert_id: row.id,
          chain: alertChain,
          tx_hash: newHash,
        },
      });
      fired++;
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, wallet_alert_id: row.id } });
    }
  }

  return { scanned: rows.length, fired, cold };
}
