import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { getAssetTransfers } from '@/lib/services/alchemy';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Resolve `promise` but never let it hang the request: if it doesn't settle
// within `ms`, fall back to `fallback` so the whale always loads even when an
// external enrichment source (Arkham / Alchemy / Helius) is slow or down. This
// is the fix for "whale loads then fails after a few seconds" — an un-timed-out
// enrichment fetch was running past the function limit and 504-ing the route.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Phase 6 — whale detail endpoint.
// Returns DB record + Arkham-enriched entity label + activity feed.
// Activity comes from whale_activity table; when empty, falls back to a
// live Alchemy (EVM) / Helius (Solana) fetch so detail never looks hollow.

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ||
  `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

async function fetchArkhamLabel(address: string, chain?: string) {
  if (!process.env.ARKHAM_API_KEY) return null;
  try {
    const { arkhamAPI } = await import('@/lib/arkham/api');
    const intel = await arkhamAPI.getAddressIntel(address, chain);
    return {
      entity: intel.arkhamEntity?.name || null,
      type: intel.arkhamEntity?.type || null,
      verified: !!intel.arkhamEntity?.verified,
      logo: intel.arkhamEntity?.logo || null,
      website: intel.arkhamEntity?.website || null,
      twitter: intel.arkhamEntity?.twitter || null,
      labels: intel.labels || [],
    };
  } catch {
    return null;
  }
}

async function fetchLiveActivityEvm(address: string, chain: string) {
  try {
    // Pulls both outgoing and incoming transfers in parallel.
    const [outgoing, incoming] = await Promise.all([
      getAssetTransfers(address, chain, 'from', 25),
      getAssetTransfers(address, chain, 'to', 25),
    ]);
    const rows = [
      ...outgoing.map((t) => ({ ...t, direction: 'out' as const })),
      ...incoming.map((t) => ({ ...t, direction: 'in' as const })),
    ];
    rows.sort((a, b) => parseInt(b.blockNum || '0', 16) - parseInt(a.blockNum || '0', 16));
    // Deep-dive fix — frontend (whale-tracker/[address]/page.tsx) expects
    // { tx_hash, action, token_symbol, token_address, amount, value_usd,
    //   counterparty, counterparty_label, timestamp } from whale_activity.
    // Live Alchemy rows used to ship a different shape (from_address /
    // to_address / value / direction / source), which left WhaleActivityChart
    // filtering EVERY row out and downstream readers seeing undefined.
    // Normalise here so live + stored rows are indistinguishable downstream.
    return rows.slice(0, 50).map((t) => ({
      tx_hash: t.hash,
      action: t.direction === 'out' ? 'send' : 'receive',
      token_symbol: t.asset || 'ETH',
      token_address: null,
      amount: parseFloat(t.value || '0'),
      value_usd: null,
      counterparty: t.direction === 'out' ? t.to : t.from,
      counterparty_label: null,
      timestamp: new Date().toISOString(),
      chain,
      source: 'alchemy_live',
    }));
  } catch {
    return [];
  }
}

async function fetchLiveActivitySolana(address: string) {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 30 }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const sigs = (data.result || []) as Array<{ signature: string; slot: number; blockTime?: number }>;
    // Same schema normalisation as the EVM live branch above. Solana RPC
    // only gives us signatures + slots — no action/amount/counterparty,
    // but the frontend tolerates nulls in those fields. The CRITICAL
    // thing is that the SHAPE matches `whale_activity` rows so a downstream
    // `.value_usd` access doesn't read `undefined` and crash WhaleActivityChart.
    return sigs.map((s) => ({
      tx_hash: s.signature,
      action: 'tx',
      token_symbol: null,
      token_address: null,
      amount: null,
      value_usd: null,
      counterparty: null,
      counterparty_label: null,
      timestamp: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : new Date().toISOString(),
      chain: 'solana',
      source: 'helius_live',
    }));
  } catch {
    return [];
  }
}

export const GET = withTierGate('mini', async (
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) => {
  const { address } = await params;
  const chain = request.nextUrl.searchParams.get('chain') || undefined;
  const supabase = getSupabaseAdmin();

  try {
    // 1) DB whale row. EVM addresses are case-insensitive on-chain, so a
    //    checksummed-vs-lowercase mismatch between the link and the stored row
    //    must NOT 404 the whale; match EVM with ilike (no wildcards in a hex
    //    address) and Solana exactly (base58 is case-sensitive).
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
    let query = supabase.from('whales').select('*').eq('is_active', true);
    query = isEvm ? query.ilike('address', address) : query.eq('address', address);
    if (chain) query = query.eq('chain', chain);
    const { data: whale } = await query.limit(1).maybeSingle();

    if (!whale) {
      // Even if not in DB, try Arkham — users can submit addresses and we shouldn't 404.
      const arkham = await fetchArkhamLabel(address, chain);
      return NextResponse.json({
        whale: null,
        arkham,
        activity: [],
        followerCount: 0,
      }, { status: arkham ? 200 : 404 });
    }

    // Canonical key for the child-table lookups: whale_activity and
    // user_whale_follows store the normalized (lowercase EVM) address, so a
    // checksummed URL address must be normalized or the activity feed and
    // follower count come back empty even though the whale row matched via ilike.
    const normalizedAddress = normalizeAddress(address, whale.chain);

    // 2) DB activity
    const { data: storedActivity } = await supabase
      .from('whale_activity')
      .select('*')
      .eq('whale_address', normalizedAddress)
      .order('timestamp', { ascending: false })
      .limit(50);

    // 3) Followers
    const { count: followerCount } = await supabase
      .from('user_whale_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('whale_address', normalizedAddress);

    // 4) Arkham + live activity (parallel, best-effort, each time-boxed so a
    //    slow/down external source can never hang the whole route past the
    //    function limit and 504 the page).
    const [arkham, liveActivity] = await Promise.all([
      withTimeout(fetchArkhamLabel(address, whale.chain), 6000, null),
      !storedActivity || storedActivity.length === 0
        ? withTimeout(
            whale.chain === 'solana'
              ? fetchLiveActivitySolana(address)
              : fetchLiveActivityEvm(address, whale.chain),
            8000,
            [] as any[],
          )
        : Promise.resolve([] as any[]),
    ]);

    const activity = (storedActivity && storedActivity.length > 0) ? storedActivity : liveActivity;

    return NextResponse.json({
      whale,
      arkham,
      activity,
      followerCount: followerCount ?? 0,
      source: storedActivity && storedActivity.length > 0 ? 'db' : 'live',
    });
  } catch (err) {
    console.error('[api/whales/:addr]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});
