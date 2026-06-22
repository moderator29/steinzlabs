import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getTrendingTokens } from '@/lib/services/coingecko';
import { resolveAssetPrice } from '@/lib/cult/convictionPrice';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Opens a new "Ape or Nope" round. Picks the first trending token we can price
 * on a DEX (memecoin-friendly), captures an entry price + pair via the shared
 * conviction resolver, and gives the cult a 24h window to call it. One active
 * round at a time. Real data only — if nothing is priceable, no round opens.
 *
 * Schedule: daily (paired with cult-ape-resolve). Owner action: add to
 * vercel.json crons (done in this branch).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ROUND_HOURS = 24;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('cult-ape-open', startedAt, async () => {
    const admin = getSupabaseAdmin();

    // One active round at a time.
    const { data: open } = await admin
      .from('cult_ape_rounds')
      .select('id')
      .eq('status', 'open')
      .gt('resolves_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (open) {
      await logCronExecution('cult-ape-open', 'success', Date.now() - startedAt, undefined, 0);
      return cronResponse('cult-ape-open', startedAt, { skipped: 'round_active' });
    }

    const trending = await getTrendingTokens().catch(() => []);
    let picked: { symbol: string; name: string; thumb: string; pairRef: string; pairChain: string; price: number } | null = null;
    for (const t of trending) {
      const resolved = await resolveAssetPrice(t.symbol);
      if (resolved) {
        picked = { symbol: t.symbol.toUpperCase(), name: t.name, thumb: t.thumb, pairRef: resolved.pairRef, pairChain: resolved.pairChain, price: resolved.priceUsd };
        break;
      }
    }
    if (!picked) {
      await logCronExecution('cult-ape-open', 'success', Date.now() - startedAt, undefined, 0);
      return cronResponse('cult-ape-open', startedAt, { skipped: 'no_priceable_token' });
    }

    const { error } = await admin.from('cult_ape_rounds').insert({
      symbol: picked.symbol,
      name: picked.name,
      image_url: picked.thumb,
      pair_ref: picked.pairRef,
      pair_chain: picked.pairChain,
      entry_price_usd: picked.price,
      resolves_at: new Date(Date.now() + ROUND_HOURS * 3_600_000).toISOString(),
    });
    if (error) throw error;

    await logCronExecution('cult-ape-open', 'success', Date.now() - startedAt, undefined, 1);
    return cronResponse('cult-ape-open', startedAt, { opened: picked.symbol });
  });
}
