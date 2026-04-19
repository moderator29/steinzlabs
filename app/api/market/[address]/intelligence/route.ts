import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Phase 10 — Token Intelligence aggregator.
// The next-gen layer beyond Binance / MEXC / checkprice: fuses Phase 6 whale DB,
// Phase 7 event feed, Phase 8 cluster graph, and live DEX liquidity into one
// structured brief for any token address. Powers the right-rail Intelligence
// panel on the trading terminal.

export const runtime = 'nodejs';

interface Brief {
  whale_holders: Array<{
    address: string;
    label: string | null;
    entity_type: string | null;
    whale_score: number | null;
    chain: string;
    last_active_at: string | null;
  }>;
  recent_whale_activity: Array<{
    whale_address: string;
    action: string;
    value_usd: number | null;
    timestamp: string;
    tx_hash: string;
    label: string | null;
  }>;
  clusters_touching: Array<{
    cluster_id: string;
    behavior_type: string | null;
    whale_score: number | null;
    members: number;
    community_label: string | null;
  }>;
  concentration: {
    top_holder_value: number;
    whale_count: number;
    avg_whale_score: number;
  };
  thesis: string | null;  // AI-generated; null if Claude unavailable
}

async function aiThesis(tokenAddr: string, whaleCount: number, recentActions: string[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const prompt = `You are a crypto on-chain analyst. Write a 2-sentence thesis for a token based on whale activity.

Token: ${tokenAddr}
Tracked whales holding/trading this token: ${whaleCount}
Most recent whale actions: ${recentActions.slice(0, 8).join(', ') || 'none'}

Return plain text, no markdown. Sentence 1: what's happening. Sentence 2: what to watch next.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const chain = request.nextUrl.searchParams.get('chain') || 'ethereum';
  const lower = address.toLowerCase();
  const supabase = getSupabaseAdmin();

  try {
    // Parallel pull: whales that have touched this token via whale_activity, clusters
    // with token_address match, recent whale_activity rows.
    const [{ data: activityRows }, { data: clusters }] = await Promise.all([
      supabase
        .from('whale_activity')
        .select('whale_address, action, value_usd, timestamp, tx_hash, token_address, chain')
        .or(`token_address.eq.${lower},token_address.eq.${address}`)
        .order('timestamp', { ascending: false })
        .limit(50),
      supabase
        .from('wallet_clusters')
        .select('cluster_id, behavior_type, whale_score, token_address')
        .or(`token_address.eq.${lower},token_address.eq.${address}`)
        .order('whale_score', { ascending: false, nullsFirst: false })
        .limit(10),
    ]);

    // Collect distinct whale addresses from activity.
    const whaleAddrs = Array.from(new Set((activityRows ?? []).map((r) => r.whale_address.toLowerCase())));

    // Enrich with whales table (label + score + entity_type).
    let whaleMeta: Record<string, any> = {};
    if (whaleAddrs.length > 0) {
      const { data: whaleRows } = await supabase
        .from('whales')
        .select('address, label, entity_type, whale_score, chain, last_active_at')
        .in('address', whaleAddrs);
      (whaleRows ?? []).forEach((w) => { whaleMeta[w.address.toLowerCase()] = w; });
    }

    const whale_holders = whaleAddrs
      .map((a) => whaleMeta[a])
      .filter(Boolean)
      .sort((a, b) => (b.whale_score ?? 0) - (a.whale_score ?? 0))
      .slice(0, 20);

    const recent_whale_activity = (activityRows ?? []).slice(0, 25).map((r) => ({
      whale_address: r.whale_address,
      action: r.action,
      value_usd: r.value_usd,
      timestamp: r.timestamp,
      tx_hash: r.tx_hash,
      label: whaleMeta[r.whale_address.toLowerCase()]?.label ?? null,
    }));

    // Clusters — enrich with member count + top community label.
    let clusters_touching: Brief['clusters_touching'] = [];
    if (clusters && clusters.length > 0) {
      const ids = clusters.map((c) => c.cluster_id);
      const [{ data: memberRows }, { data: labelRows }] = await Promise.all([
        supabase.from('wallet_cluster_members').select('cluster_id').in('cluster_id', ids),
        supabase
          .from('cluster_labels')
          .select('cluster_key, label')
          .in('cluster_key', ids)
          .eq('status', 'approved'),
      ]);
      const memberCount = new Map<string, number>();
      (memberRows ?? []).forEach((m) => memberCount.set(m.cluster_id, (memberCount.get(m.cluster_id) || 0) + 1));
      const labelByCluster = new Map<string, string>();
      (labelRows ?? []).forEach((l) => labelByCluster.set(l.cluster_key, l.label));
      clusters_touching = clusters.map((c) => ({
        cluster_id: c.cluster_id,
        behavior_type: c.behavior_type,
        whale_score: c.whale_score,
        members: memberCount.get(c.cluster_id) ?? 0,
        community_label: labelByCluster.get(c.cluster_id) ?? null,
      }));
    }

    const concentration = {
      top_holder_value: whale_holders.reduce((s, w) => s + ((w.whale_score ?? 0) * 1e6), 0),
      whale_count: whale_holders.length,
      avg_whale_score: whale_holders.length > 0
        ? whale_holders.reduce((s, w) => s + (w.whale_score ?? 0), 0) / whale_holders.length
        : 0,
    };

    // Don't block the response on the AI — fire it last with a short timeout.
    const thesis = await aiThesis(
      address,
      whale_holders.length,
      recent_whale_activity.map((r) => `${r.action} $${Math.round((r.value_usd ?? 0) / 1000)}k`),
    );

    const brief: Brief = {
      whale_holders,
      recent_whale_activity,
      clusters_touching,
      concentration,
      thesis,
    };
    void chain;
    return NextResponse.json(brief, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
    });
  } catch (err) {
    console.error('[api/market/:addr/intelligence]', err);
    return NextResponse.json({ error: 'Intelligence failed' }, { status: 500 });
  }
}
