import 'server-only';

// Phase 8 — Cluster orchestrator.
// Runs all 5 detectors over fresh whale_activity rows, performs connected-components
// to derive cluster membership, computes archetype + risk + whale score, asks Claude
// to generate a narrative name + description, and persists to wallet_clusters +
// wallet_cluster_members + wallet_edges.
//
// The ambition is beyond Nansen/Arkham: those tools stop at labels + graphs. We add
// behavioral archetyping, risk scoring, temporal evolution, and LLM-generated narratives —
// turning a raw edge list into an actionable, searchable profile of each collective.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { runAllDetectors, type ActivityRow, type DetectedEdge } from './detection';

// ─── Types ──────────────────────────────────────────────────────────

export type Archetype =
  | 'alpha_hive'          // Coordinated smart-money hive acting in concert
  | 'sybil_farm'          // Mass-funded uniform wallets — airdrop farming
  | 'insider_ring'        // Tight cluster around a token launch/deployer
  | 'smart_money_pack'    // Independent wallets with shared high-win trades
  | 'bot_swarm'           // MEV / arbitrage / sniping bot network
  | 'institutional'       // Exchange or fund internal transfer ring
  | 'whale_syndicate'     // Large-balance wallets coordinating big moves
  | 'unknown';

export interface ClusterSummary {
  cluster_id: string;          // stable hash of sorted member addresses
  chain: string;
  member_count: number;
  edge_count: number;
  archetype: Archetype;
  whale_score: number;         // 0-100
  risk_score: number;          // 0-100 (high = sybil/rug-like)
  confidence: number;          // avg edge confidence
  ai_name: string;
  ai_narrative: string;
  top_edge_types: string[];
  token_focus: string | null;
  members: string[];
  hub: string | null;          // highest-degree node
  total_value_usd: number;
  first_seen_at: string;
  last_seen_at: string;
}

// ─── Connected components ───────────────────────────────────────────

function connectedComponents(edges: DetectedEdge[]): Map<string, string[]> {
  // Union-Find keyed by (address|chain).
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of edges) {
    // Only cluster within same chain.
    union(`${e.from_address}|${e.chain}`, `${e.to_address}|${e.chain}`);
  }

  const comps = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const root = find(key);
    const arr = comps.get(root) ?? [];
    arr.push(key);
    comps.set(root, arr);
  }
  return comps;
}

// ─── Stable cluster_id ─────────────────────────────────────────────

function hashClusterId(members: string[], chain: string): string {
  const joined = members.slice().sort().join(',') + '|' + chain;
  // Small FNV-1a for determinism + no external dep.
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `cl_${chain}_${h.toString(36)}_${members.length}`;
}

// ─── Archetype inference ───────────────────────────────────────────

function inferArchetype(
  members: string[],
  chainEdges: DetectedEdge[],
  memberActivity: Map<string, ActivityRow[]>,
): { archetype: Archetype; whale_score: number; risk_score: number } {
  const typeCount = new Map<string, number>();
  let totalConfidence = 0;
  for (const e of chainEdges) {
    typeCount.set(e.edge_type, (typeCount.get(e.edge_type) || 0) + 1);
    totalConfidence += e.confidence;
  }
  const avgConf = chainEdges.length ? totalConfidence / chainEdges.length : 0;
  const sybil = typeCount.get('sybil_pattern') || 0;
  const coord = typeCount.get('coordinated_trading') || 0;
  const funding = typeCount.get('common_funding') || 0;
  const direct = typeCount.get('direct_transfer') || 0;
  const behav = typeCount.get('behavioral_fingerprint') || 0;

  // Risk: sybil + tight funding dominates risk signal
  const risk_score = Math.min(
    100,
    Math.round(
      sybil * 14 +
      (funding > members.length * 2 ? 25 : funding * 4) +
      (members.length > 15 && sybil > 0 ? 20 : 0),
    ),
  );

  // Whale score: size + direct transfer volume + behavioral overlap
  const totalValue = chainEdges.reduce((s, e) => s + (e.total_value_usd || 0), 0);
  const valueScore = Math.min(40, Math.log10(Math.max(1, totalValue)) * 5);
  const whale_score = Math.min(
    100,
    Math.round(
      Math.min(30, members.length * 1.5) +
      valueScore +
      Math.min(15, behav * 2) +
      Math.min(15, avgConf * 15),
    ),
  );

  // Archetype priority cascade.
  let archetype: Archetype = 'unknown';
  if (sybil >= 3 || (funding >= members.length && members.length >= 8)) archetype = 'sybil_farm';
  else if (members.length >= 8 && coord >= 4 && behav >= 2) archetype = 'alpha_hive';
  else if (direct >= members.length && totalValue > 500_000) archetype = 'institutional';
  else if (coord >= 3 && behav >= 2 && members.length <= 6) archetype = 'insider_ring';
  else if (behav >= 3 && avgConf > 0.7) archetype = 'smart_money_pack';
  else if (coord >= 5 && members.length >= 5 && totalValue < 100_000) archetype = 'bot_swarm';
  else if (members.length >= 5 && totalValue > 1_000_000) archetype = 'whale_syndicate';

  return { archetype, whale_score, risk_score };
}

const ARCHETYPE_FALLBACK_NAMES: Record<Archetype, { name: string; narrative: string }> = {
  alpha_hive:        { name: 'Alpha Hive',          narrative: 'Coordinated smart-money wallets acting in concert — they frequently trade the same tokens within minutes.' },
  sybil_farm:        { name: 'Sybil Farm',          narrative: 'Mass-funded uniform wallets. Almost certainly airdrop-farming or sybil-attacking a protocol.' },
  insider_ring:      { name: 'Insider Ring',        narrative: 'Tight pre-launch cluster with shared funding and coordinated accumulation before public awareness.' },
  smart_money_pack:  { name: 'Smart Money Pack',    narrative: 'Independent wallets with a high overlap of profitable trades.' },
  bot_swarm:         { name: 'Bot Swarm',           narrative: 'Automated wallets firing coordinated transactions — likely MEV, sniping, or arbitrage.' },
  institutional:     { name: 'Institutional Ring',  narrative: 'High-value internal transfers — exchange or fund operational wallets.' },
  whale_syndicate:   { name: 'Whale Syndicate',     narrative: 'Large-balance wallets coordinating big moves. Market-moving collective.' },
  unknown:           { name: 'Unnamed Cluster',     narrative: 'Cluster detected; archetype not yet determined.' },
};

// ─── AI narrative generation (Claude) ──────────────────────────────

async function generateNarrative(
  archetype: Archetype,
  members: string[],
  chainEdges: DetectedEdge[],
  tokenFocus: string | null,
  chain: string,
): Promise<{ name: string; narrative: string }> {
  const fallback = ARCHETYPE_FALLBACK_NAMES[archetype];
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const edgeSummary = Array.from(
    chainEdges.reduce((m, e) => m.set(e.edge_type, (m.get(e.edge_type) || 0) + 1), new Map<string, number>()),
  ).map(([k, v]) => `${k}:${v}`).join(', ');

  const prompt = `You are a crypto on-chain intelligence analyst. Name and describe a wallet cluster.

Facts:
- Chain: ${chain}
- Members: ${members.length} wallets
- Edges by type: ${edgeSummary}
- Inferred archetype: ${archetype}
- Token focus: ${tokenFocus || 'none'}
- Sample addresses: ${members.slice(0, 5).join(', ')}

Return JSON only: { "name": "<2-4 words, vivid, evocative>", "narrative": "<1-2 sentences explaining what this cluster is doing and why someone should care>" }

Example: { "name": "Meme Flipper Collective", "narrative": "A dozen wallets that co-fund from a single source and rotate into the same memecoins within 60 seconds of each other. Historical hit-rate 60%+ on 10x moves." }`;

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as { name?: string; narrative?: string };
    return {
      name: parsed.name || fallback.name,
      narrative: parsed.narrative || fallback.narrative,
    };
  } catch {
    return fallback;
  }
}

// ─── Main entrypoint ───────────────────────────────────────────────

export async function buildClustersFromActivity(
  rows: ActivityRow[],
  opts: { minClusterSize?: number; persist?: boolean } = {},
): Promise<ClusterSummary[]> {
  const minSize = opts.minClusterSize ?? 3;
  const edges = runAllDetectors(rows);
  if (edges.length === 0) return [];

  const comps = connectedComponents(edges);

  // Pre-group activity by address for downstream archetyping.
  const memberActivity = new Map<string, ActivityRow[]>();
  for (const r of rows) {
    const key = r.whale_address.toLowerCase();
    const arr = memberActivity.get(key) ?? [];
    arr.push(r);
    memberActivity.set(key, arr);
  }

  const results: ClusterSummary[] = [];

  for (const [, group] of comps) {
    if (group.length < minSize) continue;

    const members = group.map((k) => k.split('|')[0]);
    const chain = group[0].split('|')[1];
    const chainEdges = edges.filter(
      (e) =>
        e.chain === chain &&
        (group.includes(`${e.from_address}|${chain}`) ||
         group.includes(`${e.to_address}|${chain}`)),
    );

    // Degree (hub detection)
    const degree = new Map<string, number>();
    for (const e of chainEdges) {
      degree.set(e.from_address, (degree.get(e.from_address) || 0) + 1);
      degree.set(e.to_address, (degree.get(e.to_address) || 0) + 1);
    }
    const hub = Array.from(degree.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Most-touched token (if the activity rows mention a token)
    const tokenCount = new Map<string, number>();
    for (const addr of members) {
      for (const r of memberActivity.get(addr) || []) {
        if (r.token_address) tokenCount.set(r.token_address, (tokenCount.get(r.token_address) || 0) + 1);
      }
    }
    const tokenFocus = Array.from(tokenCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const { archetype, whale_score, risk_score } = inferArchetype(members, chainEdges, memberActivity);

    const { name, narrative } = await generateNarrative(archetype, members, chainEdges, tokenFocus, chain);

    const totalValue = chainEdges.reduce((s, e) => s + (e.total_value_usd || 0), 0);
    const confidence =
      chainEdges.length > 0
        ? chainEdges.reduce((s, e) => s + e.confidence, 0) / chainEdges.length
        : 0;
    const timestamps = chainEdges.map((e) => [e.first_seen_at, e.last_seen_at]).flat().sort();
    const first_seen_at = timestamps[0] || new Date().toISOString();
    const last_seen_at = timestamps[timestamps.length - 1] || new Date().toISOString();

    const edgeTypes = Array.from(new Set(chainEdges.map((e) => e.edge_type)));
    const summary: ClusterSummary = {
      cluster_id: hashClusterId(members, chain),
      chain,
      member_count: members.length,
      edge_count: chainEdges.length,
      archetype,
      whale_score,
      risk_score,
      confidence,
      ai_name: name,
      ai_narrative: narrative,
      top_edge_types: edgeTypes,
      token_focus: tokenFocus,
      members,
      hub,
      total_value_usd: totalValue,
      first_seen_at,
      last_seen_at,
    };

    results.push(summary);
  }

  if (opts.persist) {
    await persistClusters(results, edges);
  }

  return results;
}

// ─── Persistence ───────────────────────────────────────────────────

async function persistClusters(summaries: ClusterSummary[], edges: DetectedEdge[]) {
  const supabase = getSupabaseAdmin();

  // Edges first — they're reusable across runs.
  if (edges.length > 0) {
    await supabase.from('wallet_edges').upsert(
      edges.map((e) => ({
        from_address: e.from_address,
        to_address: e.to_address,
        chain: e.chain,
        edge_type: e.edge_type,
        weight: e.weight,
        confidence: e.confidence,
        total_value_usd: e.total_value_usd,
        transaction_count: e.transaction_count,
        first_seen_at: e.first_seen_at,
        last_seen_at: e.last_seen_at,
      })),
      { onConflict: 'from_address,to_address,chain,edge_type' },
    );
  }

  for (const c of summaries) {
    await supabase.from('wallet_clusters').upsert(
      {
        cluster_id: c.cluster_id,
        token_address: c.token_focus,
        behavior_type: c.archetype,
        whale_score: c.whale_score,
      },
      { onConflict: 'cluster_id' },
    );

    // Members — hub gets role='hub', others 'leaf' unless they connect to 3+ others.
    const rows = c.members.map((addr) => ({
      cluster_id: c.cluster_id,
      address: addr,
      role: addr === c.hub ? 'hub' : 'leaf',
    }));
    await supabase.from('wallet_cluster_members').upsert(rows, { onConflict: 'cluster_id,address' });
  }
}
