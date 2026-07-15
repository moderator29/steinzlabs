import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createUserNotification } from '@/lib/social/subscriberNotify';
import { compactUsd } from '@/lib/coins/format';
import { verifyCron } from '../_shared';

/**
 * Coin moments detector. Scans real platform data for highlight events and
 * records each as a row in coin_moments, deduped by the unique
 * (kind, chain, token_key, headline) key so a given milestone fires once. This
 * job NEVER fabricates a post: every moment is a real detected event backed by
 * live registry figures or real coin_trades. Honest no-op when nothing
 * qualifies. Bounded and cheap: two small queries, capped fan-out.
 *
 *   - mcap_milestone: a registry coin whose current market cap has crossed a
 *     round band ($100k, $500k, $1M, $5M, $10M). We record the highest band it
 *     currently clears; the unique key stops it re-firing on later runs.
 *   - circle_buying: 3+ distinct users bought the same coin in the last 3h. The
 *     buyers become actor_user_ids, and each buyer's followers get an in-app
 *     notification that their circle is aping the coin.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MCAP_BANDS: Array<{ value: number; label: string }> = [
  { value: 10_000_000, label: '$10M' },
  { value: 5_000_000, label: '$5M' },
  { value: 1_000_000, label: '$1M' },
  { value: 500_000, label: '$500k' },
  { value: 100_000, label: '$100k' },
];

const CIRCLE_WINDOW_HOURS = 3;
const CIRCLE_MIN_BUYERS = 3;

interface RegistryRow {
  chain: string;
  token_key: string;
  token_address: string | null;
  symbol: string | null;
  market_cap_usd: number | string | null;
}

interface BuyRow {
  user_id: string;
  chain: string;
  token_key: string;
  token_address: string | null;
  symbol: string | null;
}

interface MomentInsert {
  kind: 'mcap_milestone' | 'circle_buying';
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  headline: string;
  detail: string | null;
  market_cap_usd: number | null;
  actor_user_ids: string[];
}

export async function GET(req: NextRequest) {
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const inserts: MomentInsert[] = [];

  // 1. Market-cap milestones from the live registry.
  const { data: reg } = await db
    .from('coin_registry')
    .select('chain, token_key, token_address, symbol, market_cap_usd')
    .not('market_cap_usd', 'is', null)
    .gte('market_cap_usd', MCAP_BANDS[MCAP_BANDS.length - 1].value)
    .or('hidden.is.null,hidden.eq.false')
    .limit(2000);

  for (const r of (reg as RegistryRow[]) ?? []) {
    const mcap = Number(r.market_cap_usd);
    if (!Number.isFinite(mcap) || !r.token_address) continue;
    const band = MCAP_BANDS.find((b) => mcap >= b.value);
    if (!band) continue;
    const sym = (r.symbol || '').trim();
    const tag = sym ? `$${sym}` : 'This coin';
    inserts.push({
      kind: 'mcap_milestone',
      chain: r.chain,
      token_key: r.token_key,
      token_address: r.token_address,
      symbol: sym || null,
      headline: `${tag} crossed ${band.label} market cap`,
      detail: `Now at ${compactUsd(mcap)}.`,
      market_cap_usd: mcap,
      actor_user_ids: [],
    });
  }

  // 2. Circle buying: 3+ distinct users buying the same coin in the last few hours.
  const since = new Date(Date.now() - CIRCLE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: buys } = await db
    .from('coin_trades')
    .select('user_id, chain, token_key, token_address, symbol')
    .eq('side', 'buy')
    .gte('created_at', since)
    .limit(5000);

  interface Agg {
    chain: string;
    token_key: string;
    token_address: string | null;
    symbol: string | null;
    buyers: Set<string>;
  }
  const byCoin = new Map<string, Agg>();
  for (const r of (buys as BuyRow[]) ?? []) {
    if (!r.user_id) continue;
    const key = `${r.chain}:${r.token_key}`;
    const a =
      byCoin.get(key) ??
      { chain: r.chain, token_key: r.token_key, token_address: r.token_address, symbol: r.symbol, buyers: new Set<string>() };
    a.buyers.add(r.user_id);
    if (r.symbol) a.symbol = r.symbol;
    if (!a.token_address && r.token_address) a.token_address = r.token_address;
    byCoin.set(key, a);
  }

  const circleMoments: Array<{ agg: Agg; sym: string }> = [];
  for (const a of byCoin.values()) {
    if (a.buyers.size < CIRCLE_MIN_BUYERS || !a.token_address) continue;
    const sym = (a.symbol || '').trim();
    const tag = sym ? `$${sym}` : 'a coin';
    const n = a.buyers.size;
    inserts.push({
      kind: 'circle_buying',
      chain: a.chain,
      token_key: a.token_key,
      token_address: a.token_address,
      symbol: sym || null,
      // Bucket the count into the headline so a growing burst can fire again as
      // it widens, while the unique key stops identical re-fires.
      headline: `${n} traders aped ${tag} in the last ${CIRCLE_WINDOW_HOURS}h`,
      detail: null,
      market_cap_usd: null,
      actor_user_ids: [...a.buyers],
    });
    circleMoments.push({ agg: a, sym });
  }

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, milestones: 0, circles: 0, inserted: 0 });
  }

  // Insert, ignoring duplicates via the unique key. Return the rows that were
  // actually new so we only notify on genuinely fresh circle moments.
  const { data: inserted } = await db
    .from('coin_moments')
    .upsert(inserts, { onConflict: 'kind,chain,token_key,headline', ignoreDuplicates: true })
    .select('kind, chain, token_key');

  const insertedKeys = new Set(
    ((inserted as Array<{ kind: string; chain: string; token_key: string }>) ?? []).map(
      (m) => `${m.kind}:${m.chain}:${m.token_key}`,
    ),
  );

  // Notify circles for the freshly-recorded circle_buying moments only. For each
  // buyer, fan out to their real followers.
  let notified = 0;
  for (const { agg, sym } of circleMoments) {
    if (!insertedKeys.has(`circle_buying:${agg.chain}:${agg.token_key}`)) continue;
    const tag = sym ? `$${sym}` : 'a coin';
    const url = `/dashboard/coins/${agg.chain}/${encodeURIComponent(agg.token_address!)}`;

    const { data: follows } = await db
      .from('social_follows')
      .select('follower_id')
      .in('following_id', [...agg.buyers])
      .eq('status', 'accepted')
      .limit(2000);

    const recipients = new Set(
      ((follows as Array<{ follower_id: string }>) ?? []).map((f) => f.follower_id),
    );
    // Don't notify the buyers themselves about their own aping.
    for (const b of agg.buyers) recipients.delete(b);

    for (const userId of recipients) {
      await createUserNotification({
        userId,
        type: 'coin_moment',
        title: 'Your circle is aping',
        body: `Your circle is aping ${tag}.`,
        url,
        metadata: { chain: agg.chain, token_key: agg.token_key, token_address: agg.token_address, kind: 'circle_buying' },
      });
      notified++;
    }
  }

  const milestones = inserts.filter((i) => i.kind === 'mcap_milestone').length;
  const circles = circleMoments.length;
  return NextResponse.json({
    ok: true,
    milestones,
    circles,
    inserted: insertedKeys.size,
    notified,
  });
}
