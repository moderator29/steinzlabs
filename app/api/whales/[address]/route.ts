import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { getAssetTransfers } from '@/lib/services/alchemy';

export const runtime = 'nodejs';

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
    return rows.slice(0, 50).map((t) => ({
      tx_hash: t.hash,
      from_address: t.from,
      to_address: t.to,
      value: parseFloat(t.value || '0'),
      token_symbol: t.asset || 'ETH',
      direction: t.direction,
      chain,
      block_number: t.blockNum,
      timestamp: null, // Alchemy getAssetTransfers doesn't include block ts; UI falls back to "recent".
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
    return sigs.map((s) => ({
      tx_hash: s.signature,
      from_address: address,
      to_address: null,
      value: null,
      token_symbol: null,
      direction: 'unknown',
      chain: 'solana',
      block_number: s.slot,
      timestamp: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
      source: 'helius_live',
    }));
  } catch {
    return [];
  }
}

export const GET = withTierGate('pro', async (
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) => {
  const { address } = await params;
  const chain = request.nextUrl.searchParams.get('chain') || undefined;
  const supabase = getSupabaseAdmin();

  try {
    // 1) DB whale row
    let query = supabase.from('whales').select('*').eq('address', address).eq('is_active', true);
    if (chain) query = query.eq('chain', chain);
    const { data: whale } = await query.maybeSingle();

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

    // 2) DB activity
    const { data: storedActivity } = await supabase
      .from('whale_activity')
      .select('*')
      .eq('whale_address', address)
      .order('timestamp', { ascending: false })
      .limit(50);

    // 3) Followers
    const { count: followerCount } = await supabase
      .from('user_whale_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('whale_address', address);

    // 4) Arkham + live activity (parallel, best-effort)
    const [arkham, liveActivity] = await Promise.all([
      fetchArkhamLabel(address, whale.chain),
      !storedActivity || storedActivity.length === 0
        ? whale.chain === 'solana'
          ? fetchLiveActivitySolana(address)
          : fetchLiveActivityEvm(address, whale.chain)
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
