import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeAddress, addressesEqual } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Anti-spam floor: never notify the same alert more than once per window, even
// if the feed's top token alternates tick-to-tick. Caps a churny feed from
// re-pinging a user every 2 minutes.
const MIN_ALERT_INTERVAL_MS = 30 * 60 * 1000;

/**
 * feed-alert-monitor — matches active per-user Context Feed alerts against the
 * live feed and writes a notifications row per fresh match (real-time delivery
 * via the notifications publication). Dedupes via feed_alerts.last_token so a
 * user isn't re-pinged for the same token every tick. Exits instantly when no
 * alerts are configured.
 */

interface FeedEvent {
  type?: string;
  chain?: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  tokenVolume24h?: number;
  tokenPriceChange24h?: number;
  tokenMarketCap?: number;
}

interface FeedAlert {
  id: string;
  user_id: string;
  label: string;
  chain: string | null;
  kind: string;
  min_volume_usd: number | null;
  min_price_change_pct: number | null;
  last_token: string | null;
  last_triggered_at: string | null;
}

function kindMatches(kind: string, type: string): boolean {
  const t = (type || '').toLowerCase();
  switch (kind) {
    case 'any': return true;
    case 'new_coin': return t.includes('new_listing') || t.includes('token_launch');
    case 'trending': return t.includes('trending');
    case 'rug': return t.includes('rug');
    case 'smart_money': return t.includes('smart_money');
    case 'volume': return true; // volume is a threshold, not a type
    default: return true;
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  const sb = getSupabaseAdmin();

  // Exit instantly when nobody has alerts.
  const { data: alerts } = await sb
    .from('feed_alerts')
    .select('id, user_id, label, chain, kind, min_volume_usd, min_price_change_pct, last_token, last_triggered_at')
    .eq('active', true)
    .limit(2000);
  if (!alerts || alerts.length === 0) {
    await logCronExecution('feed-alert-monitor', 'success', Date.now() - startedAt, undefined, 0);
    return NextResponse.json({ ok: true, alerts: 0, notified: 0 });
  }

  // Pull the live feed once (all chains) and reuse for every alert. Build the
  // internal URL from trusted server config, NOT the inbound Host header (which
  // is client-controllable and would let a crafted request retarget this
  // server-side fetch). Fall back to the request host only if nothing is set.
  const configuredBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const base = configuredBase || `${proto}://${req.headers.get('host') ?? ''}`;
  let events: FeedEvent[] = [];
  let feedOk = false;
  try {
    const r = await fetch(`${base}/api/context-feed?limit=120&chain=all`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) { const j = await r.json(); events = (j.events ?? []) as FeedEvent[]; feedOk = true; }
  } catch { /* handled below */ }
  if (!feedOk) {
    // Surface the outage instead of logging success with notified:0 — a silently
    // broken feed would mask every alert going dark.
    Sentry.captureMessage('feed-alert-monitor: context-feed fetch failed; no alerts evaluated this tick', {
      level: 'warning',
      tags: { cron: 'feed-alert-monitor' },
    });
    await logCronExecution('feed-alert-monitor', 'failed', Date.now() - startedAt, 'context-feed fetch failed', 0);
    return NextResponse.json({ ok: false, error: 'feed_unavailable', alerts: alerts.length, notified: 0 }, { status: 200 });
  }

  let notified = 0;
  const nowMs = Date.now();
  for (const a of alerts as FeedAlert[]) {
    try {
      // Anti-spam: respect the per-alert minimum interval regardless of which
      // token is currently top, so an alternating-top feed can't re-ping.
      if (a.last_triggered_at && nowMs - new Date(a.last_triggered_at).getTime() < MIN_ALERT_INTERVAL_MS) continue;

      // Match candidate events for this alert. A threshold only filters when the
      // event actually carries that metric — a missing metric must not be
      // coerced to 0 and silently drop an otherwise-matching event.
      const matches = events.filter((e) => {
        if (a.chain && (e.chain ?? '') !== a.chain) return false;
        if (!kindMatches(a.kind, e.type ?? '')) return false;
        if (a.min_volume_usd != null && e.tokenVolume24h != null && e.tokenVolume24h < a.min_volume_usd) return false;
        if (a.min_price_change_pct != null && e.tokenPriceChange24h != null && Math.abs(e.tokenPriceChange24h) < a.min_price_change_pct) return false;
        if (a.kind === 'volume' && (e.tokenVolume24h ?? 0) <= 0) return false;
        return !!(e.tokenAddress || e.tokenSymbol);
      });
      if (matches.length === 0) continue;

      // Best match: highest 24h volume.
      matches.sort((x, y) => (y.tokenVolume24h ?? 0) - (x.tokenVolume24h ?? 0));
      const top = matches[0];
      // Preserve original casing — Solana mints are case-sensitive. Compare via
      // addressNormalize (chain-aware) so we never lowercase a base58 address.
      const tokenKey = top.tokenAddress || top.tokenSymbol || '';
      if (!tokenKey) continue;
      const sameAsLast = top.tokenAddress
        ? addressesEqual(top.tokenAddress, a.last_token ?? '', top.chain)
        : (top.tokenSymbol ?? '').toUpperCase() === (a.last_token ?? '').toUpperCase();
      if (sameAsLast) continue; // already notified for this token

      const sym = top.tokenSymbol ? `$${top.tokenSymbol}` : 'A token';
      const chainTxt = top.chain ? ` on ${top.chain}` : '';
      const volTxt = top.tokenVolume24h ? ` · ${top.tokenVolume24h >= 1e6 ? `$${(top.tokenVolume24h / 1e6).toFixed(1)}M` : `$${Math.round(top.tokenVolume24h / 1e3)}K`} vol` : '';
      const url = top.tokenAddress && top.chain
        ? `/dashboard/market/${top.chain}/${top.tokenAddress}`
        : '/dashboard?subtab=context';
      const storedToken = top.tokenAddress ? normalizeAddress(top.tokenAddress, top.chain) : tokenKey;

      await sb.from('notifications').insert({
        user_id: a.user_id,
        type: 'feed.alert',
        title: `Feed alert: ${a.label}`,
        body: `${sym}${chainTxt} matched your "${a.label}" alert${volTxt}.`,
        url,
        metadata: { alert_id: a.id, token: storedToken, chain: top.chain, symbol: top.tokenSymbol },
        read: false,
      });
      await sb.from('feed_alerts').update({ last_token: storedToken, last_triggered_at: new Date().toISOString() }).eq('id', a.id);
      notified++;
    } catch (err) {
      // Isolate per-alert failures so one bad row doesn't abort the whole tick.
      Sentry.captureException(err, { tags: { cron: 'feed-alert-monitor', alert_id: a.id } });
    }
  }

  await logCronExecution('feed-alert-monitor', 'success', Date.now() - startedAt, undefined, notified);
  return NextResponse.json({ ok: true, alerts: alerts.length, notified });
}
