import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { checkOfac } from '@/lib/security/ofac';
import { tornadoAdjacentSet } from '@/lib/security/tornado';
import { getEntityLabel } from '@/lib/services/arkham';
import { getAssetTransfers } from '@/lib/services/alchemy';
import { normalizeAddress, isEvmAddress } from '@/lib/utils/addressNormalize';

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

export interface NetworkNode {
  id: string;
  address: string;
  // §3 P2-C.3 extended entity-type coding. The existing values stay
  // backwards-compatible; UI can render new tiers when present.
  type:
    | 'high-activity'
    | 'bridge'
    | 'regular'
    | 'usdc'
    | 'usdt'
    | 'exchange'
    | 'market-maker'
    | 'smart-money'
    | 'new-wallet';
  volume: number;
  txCount: number;
  // §3 P2-C.2 — when present, lets the UI size the node by % holding of
  // a specific token (caller passes ?holdingToken=mint, server computes
  // holding_pct). Optional so existing consumers don't break.
  holding_pct?: number;
  // §3 P2-C.5 — adjacency flags. Populated server-side by applyRiskOverlays:
  // `ofac` from the Chainalysis public sanctioned-address list (lib/security/
  // ofac.ts), `tornado_adjacent` from lib/security/tornado.ts over the observed
  // edge set. Absent/false when the node was not looked up or came back clean.
  flags?: {
    ofac?: boolean;
    tornado_adjacent?: boolean;
  };
  // Arkham entity label (env-gated behind ARKHAM_API_KEY). Present only when
  // Arkham returns a known entity for the address; omitted cleanly otherwise.
  entityLabel?: {
    name: string;
    type: string;
    verified: boolean;
  };
  // Human-readable sanctioning detail from the OFAC list (category/name), used
  // for the node tooltip. Present only when flags.ofac is true.
  sanctionReason?: string;
  // Real community-detection assignment. Computed by label-propagation over
  // the actual edge set (see detectCommunities). Nodes in the same detected
  // community share a clusterId; the UI colors by it. Absent when clustering
  // could not be run (too few nodes) — never fabricated.
  clusterId?: number;
  x?: number;
  y?: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type: 'usdc' | 'usdt';
  amount: number;
  // §3 P2-C.1 — alias surfacing the doc-spec field name. Same value as
  // `amount` (which the existing UI uses for width). Emitting both keeps
  // the UI working while letting new consumers grep the doc's column.
  total_value_usd?: number;
  count: number;
}

export interface NetworkStats {
  // Real count of communities detected by label-propagation over the edge set.
  // null when clustering could not be run honestly (fewer than the minimum
  // node count). The UI omits the stat entirely when null — never invented.
  clusters: number | null;
  avgDegree: number;
  density: number;
  usdcTxns: number;
  usdtTxns: number;
  totalVolume: number;
  timelineData: number[];
  // Real count of graph nodes flagged as OFAC-sanctioned by the Chainalysis
  // public list (see applyRiskOverlays). 0 when none of the looked-up nodes
  // are sanctioned — never fabricated.
  sanctionedCount: number;
  // Count of nodes flagged 1-hop adjacent to a sanctioned Tornado Cash pool.
  tornadoCount: number;
  // Count of nodes carrying an Arkham entity label. 0 when the Arkham key is
  // unset (labels omitted cleanly) or no node resolved to a known entity.
  labeledCount: number;
}

export interface NetworkGraphResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: NetworkStats;
  source: 'alchemy' | 'dexscreener';
  // What the graph actually represents, so the UI can label it honestly:
  //  - 'fund-flow'  : nodes are wallets, edges are real stablecoin transfers
  //                   between them (Solana + EVM paths).
  //  - 'liquidity'  : nodes are tokens/pairs, edges are DEX pairs; figures are
  //                   pair-level DEX volume, NOT per-wallet activity.
  kind: 'fund-flow' | 'liquidity';
  available: boolean;
}

// Known Solana protocol/bridge addresses
const KNOWN_PROTOCOLS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjno': 'Orca Whirlpool',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  'So11111111111111111111111111111111111111112': 'Wrapped SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC Mint',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT Mint',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'Bonk',
};

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
}

// Classifier over signals we can observe directly (known mints, known
// protocol addresses, and observed volume/tx activity). It only ever emits
// the types below; richer tiers (exchange / market-maker / smart-money) are
// assigned later by applyRiskOverlays from real Arkham entity data, never
// guessed here. The legend advertises exactly the types present in the graph.
function classifyNode(address: string, volume: number, txCount: number): NetworkNode['type'] {
  if (address === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return 'usdc';
  if (address === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') return 'usdt';
  if (KNOWN_PROTOCOLS[address]) return 'bridge';
  if (volume > 100000 || txCount > 20) return 'high-activity';
  return 'regular';
}

// Maps an Arkham entity type string onto one of our richer node tiers. Returns
// null when the entity type doesn't map to a tier we render, so the base
// classifier result stands. Driven entirely by real Arkham labels.
function entityTypeToNodeTier(entityType: string): NetworkNode['type'] | null {
  const t = entityType.toLowerCase();
  if (t.includes('cex') || t.includes('exchange')) return 'exchange';
  if (t.includes('market maker') || t.includes('market-maker') || t === 'mm') return 'market-maker';
  if (t.includes('fund') || t.includes('smart money') || t.includes('trader')) return 'smart-money';
  return null;
}

// ─── Real community detection (label propagation) ───────────────────────────
// The previous `clusters = Math.floor(n / 5)` was fabricated. We now compute a
// real community count by running label propagation over the OBSERVED edge set.
//
// Note on lib/services/cluster-detection.ts: that module answers a different
// question — given a known set of suspect wallets plus per-trade data (block
// numbers, buy/sell side, USD-valued transfers), does it look coordinated. The
// network-graph route only has aggregated transfer edges (no per-trade side /
// block data), so feeding detectCluster would require inventing trade events,
// which CLAUDE.md forbids. Community detection over the actual graph topology is
// the honest, source-faithful way to produce a real cluster count here.
//
// Minimum number of nodes before a cluster count is meaningful. Below this we
// return null and the UI omits the stat rather than inventing a value.
const MIN_NODES_FOR_CLUSTERING = 4;

/**
 * Detects communities in the actual transfer graph using synchronous label
 * propagation (Raghavan et al. 2007). This is a real, deterministic graph
 * algorithm run over the observed edge set — no fabricated numbers.
 *
 * Returns a map from node id to a dense, 0-based community id, plus the count
 * of distinct communities. Edges are treated as undirected and weighted by
 * transfer count so heavier links pull nodes together. Returns null when there
 * are too few nodes for the result to be meaningful.
 */
function detectCommunities(
  nodeIds: string[],
  edges: Array<{ source: string; target: string; count: number }>,
): { labels: Map<string, number>; count: number } | null {
  if (nodeIds.length < MIN_NODES_FOR_CLUSTERING) return null;

  // Weighted undirected adjacency.
  const adjacency = new Map<string, Map<string, number>>();
  for (const id of nodeIds) adjacency.set(id, new Map());
  for (const e of edges) {
    if (e.source === e.target) continue;
    const a = adjacency.get(e.source);
    const b = adjacency.get(e.target);
    if (!a || !b) continue;
    const w = Math.max(1, e.count);
    a.set(e.target, (a.get(e.target) ?? 0) + w);
    b.set(e.source, (b.get(e.source) ?? 0) + w);
  }

  // Initialise each node with its own label.
  const labels = new Map<string, number>();
  nodeIds.forEach((id, i) => labels.set(id, i));

  // Deterministic processing order (sorted) keeps the result stable across
  // requests so the same graph always yields the same cluster count.
  const order = [...nodeIds].sort();

  const MAX_ITERS = 20;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let changed = false;
    for (const node of order) {
      const neighbors = adjacency.get(node)!;
      if (neighbors.size === 0) continue;

      // Tally neighbour labels weighted by edge weight.
      const tally = new Map<number, number>();
      for (const [neighbor, weight] of neighbors) {
        const lbl = labels.get(neighbor)!;
        tally.set(lbl, (tally.get(lbl) ?? 0) + weight);
      }

      // Pick the highest-weighted label; break ties by lowest label id for
      // determinism.
      let bestLabel = labels.get(node)!;
      let bestWeight = -1;
      for (const [lbl, weight] of tally) {
        if (weight > bestWeight || (weight === bestWeight && lbl < bestLabel)) {
          bestWeight = weight;
          bestLabel = lbl;
        }
      }

      if (labels.get(node) !== bestLabel) {
        labels.set(node, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Re-index labels into a dense 0-based range and count distinct communities.
  const remap = new Map<number, number>();
  for (const id of order) {
    const raw = labels.get(id)!;
    if (!remap.has(raw)) remap.set(raw, remap.size);
    labels.set(id, remap.get(raw)!);
  }

  return { labels, count: remap.size };
}

// ─── Real risk overlays (OFAC · Tornado · Arkham) ────────────────────────────
// Populates node.flags.ofac / node.flags.tornado_adjacent / node.entityLabel
// from real sources and rolls the counts into stats. Every figure traces to an
// upstream call; nodes that are not looked up simply carry no flag (honest
// absence, never a fabricated "clean" claim beyond what we checked).

// Cap how many addresses we resolve per request so the route stays fast. We
// prioritise the highest-degree nodes — the hubs a fund-flow investigation
// cares about most.
const MAX_OVERLAY_NODES = 40;
// Bounded concurrency for the upstream lookups (checkOfac / Arkham each have
// their own short internal timeout + cache).
const OVERLAY_CONCURRENCY = 8;

/** Run async tasks over items with a fixed-size worker pool. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function applyRiskOverlays(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  stats: NetworkStats,
  chain?: string,
): Promise<void> {
  if (nodes.length === 0) return;

  const addressOf = new Map(nodes.map(n => [n.id, n.address]));
  const nodeByAddress = new Map(nodes.map(n => [normalizeAddress(n.address), n]));

  // ── Tornado adjacency over the full observed edge set (cheap, in-memory). ──
  // A node is flagged when it directly transacts with a sanctioned Tornado pool
  // that appears as a counterparty in the graph.
  const tornadoAddrs = tornadoAdjacentSet(
    edges.map(e => ({ source: e.source, target: e.target })),
    id => addressOf.get(id),
  );
  for (const addr of tornadoAddrs) {
    const node = nodeByAddress.get(normalizeAddress(addr));
    if (node) node.flags = { ...node.flags, tornado_adjacent: true };
  }

  // ── OFAC + Arkham label lookups for the top-N nodes by degree. ──
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const ranked = [...nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || b.volume - a.volume)
    .slice(0, MAX_OVERLAY_NODES);

  const arkhamEnabled = !!process.env.ARKHAM_API_KEY;

  await mapPool(ranked, OVERLAY_CONCURRENCY, async (node) => {
    // OFAC (Chainalysis public list — free, no key). checkOfac carries its own
    // 4s timeout + 24h Redis cache and falls open on upstream failure.
    const ofac = await checkOfac(node.address);
    if (ofac.sanctioned) {
      node.flags = { ...node.flags, ofac: true };
      const id0 = ofac.identifications[0];
      const reason = id0?.name || id0?.category || 'OFAC SDN listed';
      node.sanctionReason = reason;
    }

    // Arkham entity label — env-gated, omitted cleanly when the key is unset.
    if (arkhamEnabled) {
      const label = await getEntityLabel(node.address, chain);
      if (label && label.entity && label.entity !== 'Unknown') {
        node.entityLabel = { name: label.entity, type: label.type, verified: label.verified };
        const tier = entityTypeToNodeTier(label.type);
        // Only upgrade the tier for non-special nodes so we never relabel a
        // known mint/protocol.
        if (tier && node.type === 'regular') node.type = tier;
        if (tier && node.type === 'high-activity') node.type = tier;
      }
    }
  });

  stats.sanctionedCount = nodes.filter(n => n.flags?.ofac).length;
  stats.tornadoCount = nodes.filter(n => n.flags?.tornado_adjacent).length;
  stats.labeledCount = nodes.filter(n => n.entityLabel).length;
}

// ─── Empty fallback when APIs are unavailable ────────────────────────────────
// No static / mock data is shipped per CLAUDE.md "Mock Data — Forbidden".
// If both Alchemy Solana and DexScreener fail, we return an empty graph with
// available=false so the UI can render an explicit error state.

function emptyResponse(): NetworkGraphResponse {
  return {
    nodes: [],
    edges: [],
    stats: {
      clusters: null,
      avgDegree: 0,
      density: 0,
      usdcTxns: 0,
      usdtTxns: 0,
      totalVolume: 0,
      timelineData: [],
      sanctionedCount: 0,
      tornadoCount: 0,
      labeledCount: 0,
    },
    source: 'alchemy',
    kind: 'fund-flow',
    available: false,
  };
}

async function fetchSolanaGraphData(wallet: string): Promise<NetworkGraphResponse | null> {
  if (!SOLANA_RPC) return null;

  try {
    // Get transaction signatures via Alchemy Solana RPC
    const sigRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [wallet, { limit: 50 }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!sigRes.ok) return null;
    const sigData = await sigRes.json() as { result?: Array<{ signature: string; blockTime: number | null }> };
    const sigs = sigData.result ?? [];
    if (sigs.length === 0) return null;

    // Fetch transaction details in parallel (batch of 10)
    const txDetails = await Promise.allSettled(
      sigs.slice(0, 30).map(async (sig) => {
        const r = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return null;
        const d = await r.json() as { result?: Record<string, unknown> };
        return d.result ? { ...d.result, timestamp: sig.blockTime } : null;
      })
    );
    const txs = (txDetails as any[])
      .filter((r: any) => r.status === 'fulfilled' && r.value !== null)
      .map((r: any) => r.value);
    if (!Array.isArray(txs) || txs.length === 0) return null;

    const nodeMap = new Map<string, { volume: number; txCount: number; addresses: Set<string> }>();
    const edgeMap = new Map<string, { amount: number; count: number; type: 'usdc' | 'usdt' }>();

    const ensureNode = (addr: string) => {
      if (!nodeMap.has(addr)) {
        nodeMap.set(addr, { volume: 0, txCount: 0, addresses: new Set() });
      }
    };

    for (const tx of txs) {
      const meta = tx.meta as Record<string, unknown> | undefined;
      const preTokens = (meta?.preTokenBalances as any[]) ?? [];
      const postTokens = (meta?.postTokenBalances as any[]) ?? [];
      const accountKeys = ((tx.transaction as any)?.message?.accountKeys ?? []) as Array<{ pubkey: string }>;
      // Build token transfers from balance diffs
      const transfers: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }> = [];
      for (const pt of postTokens) {
        const pre = preTokens.find((p: any) => p.accountIndex === pt.accountIndex && p.mint === pt.mint);
        const diff = (pt.uiTokenAmount?.uiAmount ?? 0) - (pre?.uiTokenAmount?.uiAmount ?? 0);
        if (Math.abs(diff) > 0) {
          const owner = pt.owner || accountKeys[pt.accountIndex]?.pubkey || '';
          if (diff > 0) {
            transfers.push({ fromUserAccount: wallet, toUserAccount: owner, mint: pt.mint, tokenAmount: diff });
          } else {
            transfers.push({ fromUserAccount: owner, toUserAccount: wallet, mint: pt.mint, tokenAmount: Math.abs(diff) });
          }
        }
      }
      for (const t of transfers) {
        const from = t.fromUserAccount || '';
        const to = t.toUserAccount || '';
        const mint = t.mint || '';
        const amount = t.tokenAmount || 0;

        if (!from || !to || !amount) continue;

        let edgeType: 'usdc' | 'usdt' | null = null;
        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') edgeType = 'usdc';
        else if (mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') edgeType = 'usdt';
        if (!edgeType) continue;

        ensureNode(from);
        ensureNode(to);

        const fn = nodeMap.get(from)!;
        fn.volume += amount;
        fn.txCount += 1;

        const tn = nodeMap.get(to)!;
        tn.volume += amount;
        tn.txCount += 1;

        const edgeKey = `${from}||${to}`;
        if (edgeMap.has(edgeKey)) {
          const e = edgeMap.get(edgeKey)!;
          e.amount += amount;
          e.count += 1;
        } else {
          edgeMap.set(edgeKey, { amount, count: 1, type: edgeType });
        }
      }
    }

    if (nodeMap.size === 0) return null;

    const addresses = Array.from(nodeMap.keys());
    const addrIndex = new Map(addresses.map((a, i) => [a, i]));

    const nodes: NetworkNode[] = addresses.map((addr, i) => {
      const d = nodeMap.get(addr)!;
      return {
        id: `node-${i}`,
        address: addr,
        type: classifyNode(addr, d.volume, d.txCount),
        volume: d.volume,
        txCount: d.txCount,
      };
    });

    const edges: NetworkEdge[] = Array.from(edgeMap.entries()).map(([key, val]) => {
      const [from, to] = key.split('||');
      return {
        source: `node-${addrIndex.get(from)}`,
        target: `node-${addrIndex.get(to)}`,
        type: val.type,
        amount: val.amount,
        total_value_usd: val.amount,
        count: val.count,
      };
    });

    const usdcTxns = edges.filter(e => e.type === 'usdc').length;
    const usdtTxns = edges.filter(e => e.type === 'usdt').length;
    const n = nodes.length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;
    const degreeSum = edges.length * 2;
    const avgDegree = parseFloat((degreeSum / Math.max(n, 1)).toFixed(2));

    // Real community detection over the observed edge set. Tags each node with
    // its detected community so the UI can color by cluster. When too few nodes
    // exist to cluster meaningfully, communities is null and the stat is omitted.
    const communities = detectCommunities(
      nodes.map(nd => nd.id),
      edges.map(e => ({ source: e.source, target: e.target, count: e.count })),
    );
    if (communities) {
      for (const nd of nodes) {
        const lbl = communities.labels.get(nd.id);
        if (lbl !== undefined) nd.clusterId = lbl;
      }
    }

    // Build timelineData from actual tx timestamps
    // 8 buckets × 3h each = last 24h; index 7 = most recent, index 0 = oldest
    const bucketMs = 3 * 60 * 60 * 1000;
    const windowMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = new Array(8).fill(0);
    for (const tx of txs) {
      const ts = tx.timestamp ? tx.timestamp * 1000 : 0;
      if (!ts) continue;
      const age = now - ts;
      if (age < 0 || age >= windowMs) continue;
      const bucketIdx = 7 - Math.floor(age / bucketMs);
      if (bucketIdx >= 0 && bucketIdx < 8) buckets[bucketIdx]++;
    }
    // Normalize to 0-100 for chart display
    const maxBucket = Math.max(...buckets, 1);
    const timelineData = buckets.map(v => Math.round((v / maxBucket) * 100));

    const response: NetworkGraphResponse = {
      nodes,
      edges,
      stats: {
        clusters: communities ? communities.count : null,
        avgDegree,
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData,
        sanctionedCount: 0,
        tornadoCount: 0,
        labeledCount: 0,
      },
      source: 'alchemy',
      kind: 'fund-flow',
      available: true,
    };

    // Real OFAC / Tornado / Arkham overlays over the resolved wallets.
    await applyRiskOverlays(response.nodes, response.edges, response.stats, 'solana');

    return response;
  } catch {
    return null;
  }
}

// ─── EVM fund-flow graph (Alchemy getAssetTransfers) ─────────────────────────
// A 0x… wallet previously fell through Solana RPC → DexScreener → empty. We now
// build a real 1-hop stablecoin transfer graph from Alchemy asset-transfer
// history in BOTH directions: outgoing edges wallet→counterparty and incoming
// edges counterparty→wallet, with real USD-valued amounts (USDC/USDT are the
// dollar-pegged assets the graph models, mirroring the Solana path). No values
// are invented; wallets that never moved stablecoins yield an honest empty
// graph so the caller can fall through to other sources.
async function fetchEvmGraphData(wallet: string, chain: string): Promise<NetworkGraphResponse | null> {
  if (!process.env.ALCHEMY_API_KEY) return null;

  try {
    const [outbound, inbound] = await Promise.all([
      getAssetTransfers(wallet, chain, 'from', 100),
      getAssetTransfers(wallet, chain, 'to', 100),
    ]);

    const self = normalizeAddress(wallet);
    const nodeMap = new Map<string, { volume: number; txCount: number; timestamps: number[] }>();
    const edgeMap = new Map<string, { amount: number; count: number; type: 'usdc' | 'usdt' }>();

    const ensureNode = (addr: string) => {
      if (!nodeMap.has(addr)) nodeMap.set(addr, { volume: 0, txCount: 0, timestamps: [] });
      return nodeMap.get(addr)!;
    };

    const classifyAsset = (asset: string): 'usdc' | 'usdt' | null => {
      const a = asset.toUpperCase();
      if (a === 'USDC') return 'usdc';
      if (a === 'USDT') return 'usdt';
      return null;
    };

    const addTransfer = (from: string, to: string, value: number, type: 'usdc' | 'usdt', ts?: number) => {
      if (!from || !to || from === to || !(value > 0)) return;
      const f = ensureNode(from);
      const t = ensureNode(to);
      f.volume += value; f.txCount += 1;
      t.volume += value; t.txCount += 1;
      if (ts) { f.timestamps.push(ts); t.timestamps.push(ts); }
      const key = `${from}||${to}`;
      const existing = edgeMap.get(key);
      if (existing) { existing.amount += value; existing.count += 1; }
      else edgeMap.set(key, { amount: value, count: 1, type });
    };

    for (const t of outbound) {
      const type = classifyAsset(t.asset);
      if (!type) continue;
      addTransfer(self, normalizeAddress(t.to), Number(t.value) || 0, type, t.timestamp);
    }
    for (const t of inbound) {
      const type = classifyAsset(t.asset);
      if (!type) continue;
      addTransfer(normalizeAddress(t.from), self, Number(t.value) || 0, type, t.timestamp);
    }

    if (nodeMap.size === 0) return null;

    const addresses = Array.from(nodeMap.keys());
    const addrIndex = new Map(addresses.map((a, i) => [a, i]));

    const nodes: NetworkNode[] = addresses.map((addr, i) => {
      const d = nodeMap.get(addr)!;
      return {
        id: `node-${i}`,
        address: addr,
        type: classifyNode(addr, d.volume, d.txCount),
        volume: d.volume,
        txCount: d.txCount,
      };
    });

    const edges: NetworkEdge[] = Array.from(edgeMap.entries()).map(([key, val]) => {
      const [from, to] = key.split('||');
      return {
        source: `node-${addrIndex.get(from)}`,
        target: `node-${addrIndex.get(to)}`,
        type: val.type,
        amount: val.amount,
        total_value_usd: val.amount,
        count: val.count,
      };
    });

    const usdcTxns = edges.filter(e => e.type === 'usdc').length;
    const usdtTxns = edges.filter(e => e.type === 'usdt').length;
    const n = nodes.length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;
    const avgDegree = parseFloat(((edges.length * 2) / Math.max(n, 1)).toFixed(2));

    const communities = detectCommunities(
      nodes.map(nd => nd.id),
      edges.map(e => ({ source: e.source, target: e.target, count: e.count })),
    );
    if (communities) {
      for (const nd of nodes) {
        const lbl = communities.labels.get(nd.id);
        if (lbl !== undefined) nd.clusterId = lbl;
      }
    }

    // Timeline from real transfer timestamps (8 buckets × 3h = last 24h).
    const bucketMs = 3 * 60 * 60 * 1000;
    const windowMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = new Array(8).fill(0);
    for (const d of nodeMap.values()) {
      for (const tsSec of d.timestamps) {
        const age = now - tsSec * 1000;
        if (age < 0 || age >= windowMs) continue;
        const idx = 7 - Math.floor(age / bucketMs);
        if (idx >= 0 && idx < 8) buckets[idx]++;
      }
    }
    const maxBucket = Math.max(...buckets, 1);
    const timelineData = buckets.map(v => Math.round((v / maxBucket) * 100));

    const response: NetworkGraphResponse = {
      nodes,
      edges,
      stats: {
        clusters: communities ? communities.count : null,
        avgDegree,
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData,
        sanctionedCount: 0,
        tornadoCount: 0,
        labeledCount: 0,
      },
      source: 'alchemy',
      kind: 'fund-flow',
      available: true,
    };

    await applyRiskOverlays(response.nodes, response.edges, response.stats, chain);

    return response;
  } catch {
    return null;
  }
}

async function fetchDexScreenerData(query: string): Promise<NetworkGraphResponse | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: any[] = data?.pairs || [];
    if (pairs.length === 0) return null;

    // Token-pair LIQUIDITY map (NOT a per-wallet fund-flow graph). Nodes are
    // tokens; each token's `volume` / `txCount` is the sum of the REAL 24h DEX
    // volume / tx count of every listed pair it belongs to. There is no
    // invented base/quote split — every figure is a DexScreener pair-level
    // number, aggregated honestly per token.
    const nodeMap = new Map<string, { volume: number; txCount: number }>();

    const ensureNode = (addr: string, vol: number, txs: number) => {
      if (!nodeMap.has(addr)) {
        nodeMap.set(addr, { volume: vol, txCount: txs });
      } else {
        const n = nodeMap.get(addr)!;
        n.volume += vol;
        n.txCount += txs;
      }
    };

    for (const pair of pairs.slice(0, 20)) {
      const baseAddr = pair.baseToken?.address || '';
      const quoteAddr = pair.quoteToken?.address || '';
      const vol24h = parseFloat(pair.volume?.h24 || '0');
      const txCount = parseInt(pair.txns?.h24?.buys || '0') + parseInt(pair.txns?.h24?.sells || '0');

      // Both tokens in a pair carry that pair's real, unsplit 24h figures.
      if (baseAddr) ensureNode(baseAddr, vol24h, txCount);
      if (quoteAddr) ensureNode(quoteAddr, vol24h, txCount);
    }

    const addresses = Array.from(nodeMap.keys());
    const addrIndex = new Map(addresses.map((a, i) => [a, i]));

    const nodes: NetworkNode[] = addresses.map((addr, i) => {
      const d = nodeMap.get(addr)!;
      return {
        id: `node-${i}`,
        address: addr,
        type: classifyNode(addr, d.volume, d.txCount),
        volume: d.volume,
        txCount: d.txCount,
      };
    });

    const edges: NetworkEdge[] = [];
    const edgeSet = new Set<string>();

    for (const pair of pairs.slice(0, 20)) {
      const baseAddr = pair.baseToken?.address || '';
      const quoteAddr = pair.quoteToken?.address || '';
      const vol = parseFloat(pair.volume?.h24 || '0');
      const txCount = parseInt(pair.txns?.h24?.buys || '0') + parseInt(pair.txns?.h24?.sells || '0');

      // One edge per pair carrying that pair's REAL 24h volume + tx count.
      if (baseAddr && quoteAddr && addrIndex.has(baseAddr) && addrIndex.has(quoteAddr)) {
        const key = `${baseAddr}||${quoteAddr}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          // Symbol-based stablecoin classification. DexScreener gives us the
          // quote token's symbol directly; we compare symbols (not raw
          // addresses) so we never lower-case a case-sensitive Solana address.
          const quoteSymbol = String(pair.quoteToken?.symbol || '').toUpperCase();
          edges.push({
            source: `node-${addrIndex.get(baseAddr)}`,
            target: `node-${addrIndex.get(quoteAddr)}`,
            type: quoteSymbol.includes('USDT') ? 'usdt' : 'usdc',
            amount: vol,
            total_value_usd: vol,
            count: txCount,
          });
        }
      }
    }

    const usdcTxns = edges.filter(e => e.type === 'usdc').length;
    const usdtTxns = edges.filter(e => e.type === 'usdt').length;
    const n = nodes.length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;

    // Real community detection over the observed pair graph.
    const communities = detectCommunities(
      nodes.map(nd => nd.id),
      edges.map(e => ({ source: e.source, target: e.target, count: e.count })),
    );
    if (communities) {
      for (const nd of nodes) {
        const lbl = communities.labels.get(nd.id);
        if (lbl !== undefined) nd.clusterId = lbl;
      }
    }

    // Build timelineData from actual DexScreener h1/h6/h24 transaction counts
    // 8 buckets × 3h each = last 24h; index 7 = most recent (0-3h), index 0 = oldest (21-24h)
    let totalH1 = 0, totalH6 = 0, totalH24 = 0;
    for (const pair of pairs.slice(0, 20)) {
      totalH1  += (parseInt(String(pair.txns?.h1?.buys  ?? 0)) + parseInt(String(pair.txns?.h1?.sells  ?? 0)));
      totalH6  += (parseInt(String(pair.txns?.h6?.buys  ?? 0)) + parseInt(String(pair.txns?.h6?.sells  ?? 0)));
      totalH24 += (parseInt(String(pair.txns?.h24?.buys ?? 0)) + parseInt(String(pair.txns?.h24?.sells ?? 0)));
    }
    // Per-3h bucket rates derived from cumulative windows
    const rate1h  = totalH1;
    const rate6h  = totalH6  > 0 ? totalH6  / 6  : rate1h;   // avg/hour over last 6h
    const rate24h = totalH24 > 0 ? totalH24 / 24 : rate6h;   // avg/hour over last 24h
    const rawBuckets = [
      rate24h * 3, rate24h * 3, rate24h * 3, rate24h * 3,  // buckets 0-3: 12-24h ago
      rate6h * 3,  rate6h * 3,                               // buckets 4-5: 6-12h ago
      rate6h * 3,                                             // bucket 6: 3-6h ago
      rate1h * 3,                                             // bucket 7: 0-3h ago (most recent)
    ];
    const maxBucket = Math.max(...rawBuckets, 1);
    const timelineData = rawBuckets.map(v => Math.round((v / maxBucket) * 100));

    const response: NetworkGraphResponse = {
      nodes,
      edges,
      stats: {
        clusters: communities ? communities.count : null,
        avgDegree: parseFloat(((edges.length * 2) / Math.max(n, 1)).toFixed(2)),
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData,
        sanctionedCount: 0,
        tornadoCount: 0,
        labeledCount: 0,
      },
      source: 'dexscreener',
      kind: 'liquidity',
      available: true,
    };

    // Overlays run on token contracts here (chain unknown, so Arkham resolves
    // across chains). OFAC/Tornado still apply to any token/contract address.
    await applyRiskOverlays(response.nodes, response.edges, response.stats);

    return response;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = (searchParams.get('wallet') || '').trim();
  // Optional EVM chain hint (ethereum, base, arbitrum, …). Defaults to
  // ethereum for 0x… addresses.
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();

  let result: NetworkGraphResponse | null = null;

  if (wallet) {
    if (isEvmAddress(wallet)) {
      // 0x… wallet → real EVM stablecoin transfer graph via Alchemy. Falls
      // through to DexScreener (token/pair liquidity) only if it produces
      // nothing (e.g. a contract address with no stablecoin transfers).
      result = await fetchEvmGraphData(wallet, chain);
      if (!result) {
        result = await fetchDexScreenerData(wallet);
      }
    } else {
      // Solana wallet path, then DexScreener as a token liquidity fallback.
      result = await fetchSolanaGraphData(wallet);
      if (!result) {
        result = await fetchDexScreenerData(wallet);
      }
    }
  }

  // No mock fallback — if no wallet was provided or both APIs failed, return
  // an explicit empty state and let the UI render an error/empty banner.
  if (!result) {
    result = emptyResponse();
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
