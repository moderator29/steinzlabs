import { NextRequest, NextResponse } from 'next/server';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    .select('id, user_id, label, chain, kind, min_volume_usd, min_price_change_pct, last_token')
    .eq('active', true)
    .limit(2000);
  if (!alerts || alerts.length === 0) {
    await logCronExecution('feed-alert-monitor', 'success', Date.now() - startedAt, undefined, 0);
    return NextResponse.json({ ok: true, alerts: 0, notified: 0 });
  }

  // Pull the live feed once (all chains) and reuse for every alert.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? process.env.VERCEL_URL ?? '';
  let events: FeedEvent[] = [];
  try {
    const r = await fetch(`${proto}://${host}/api/context-feed?limit=120&chain=all`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) { const j = await r.json(); events = (j.events ?? []) as FeedEvent[]; }
  } catch { /* feed unavailable this tick — try again next run */ }

  let notified = 0;
  for (const a of alerts as FeedAlert[]) {
    // Match candidate events for this alert.
    const matches = events.filter((e) => {
      if (a.chain && (e.chain ?? '') !== a.chain) return false;
      if (!kindMatches(a.kind, e.type ?? '')) return false;
      if (a.min_volume_usd != null && (e.tokenVolume24h ?? 0) < a.min_volume_usd) return false;
      if (a.min_price_change_pct != null && Math.abs(e.tokenPriceChange24h ?? 0) < a.min_price_change_pct) return false;
      if (a.kind === 'volume' && (e.tokenVolume24h ?? 0) <= 0) return false;
      return !!(e.tokenAddress || e.tokenSymbol);
    });
    if (matches.length === 0) continue;

    // Best match: highest 24h volume.
    matches.sort((x, y) => (y.tokenVolume24h ?? 0) - (x.tokenVolume24h ?? 0));
    const top = matches[0];
    // Chain-aware dedupe key (CLAUDE.md): lowercasing collapsed two distinct
    // case-sensitive Solana mints into one key (false dedupe → missed alerts).
    const tokenKey = top.tokenAddress
      ? normalizeAddress(top.tokenAddress, top.chain ?? undefined)
      : (top.tokenSymbol || '').toUpperCase();
    if (!tokenKey || tokenKey === (a.last_token ?? '')) continue; // already notified

    const sym = top.tokenSymbol ? `$${top.tokenSymbol}` : 'A token';
    const chainTxt = top.chain ? ` on ${top.chain}` : '';
    const volTxt = top.tokenVolume24h ? ` · ${top.tokenVolume24h >= 1e6 ? `$${(top.tokenVolume24h / 1e6).toFixed(1)}M` : `$${Math.round(top.tokenVolume24h / 1e3)}K`} vol` : '';
    const url = top.tokenAddress && top.chain
      ? `/dashboard/market/${top.chain}/${top.tokenAddress}`
      : '/dashboard?subtab=context';

    await sb.from('notifications').insert({
      user_id: a.user_id,
      type: 'feed.alert',
      title: `Feed alert: ${a.label}`,
      body: `${sym}${chainTxt} matched your "${a.label}" alert${volTxt}.`,
      url,
      metadata: { alert_id: a.id, token: tokenKey, chain: top.chain, symbol: top.tokenSymbol },
      read: false,
    });
    await sb.from('feed_alerts').update({ last_token: tokenKey, last_triggered_at: new Date().toISOString() }).eq('id', a.id);
    notified++;
  }

  await logCronExecution('feed-alert-monitor', 'success', Date.now() - startedAt, undefined, notified);
  return NextResponse.json({ ok: true, alerts: alerts.length, notified });
}
