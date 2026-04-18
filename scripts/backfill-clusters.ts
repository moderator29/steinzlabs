/**
 * Wallet cluster backfill. Target: top ~500 most-active addresses in
 * whale_activity over the last 30 days.
 *
 * Pipeline per address:
 *   1. Pull all whale_activity rows that touch the address.
 *   2. Run every detector in /lib/clusters/detection.ts.
 *   3. Persist unique edges into wallet_edges.
 *   4. Group into clusters via BFS over wallet_edges.
 *   5. For each cluster, call Claude Sonnet 4.6 to generate a 2-4 word
 *      creative label (archetype-style: "Memecoin Snipers", "OG DeFi
 *      Titans", "Bridge Looters"). Insert into cluster_cache +
 *      cluster_labels (ai_generated=true, status='approved').
 *
 * Run: npx tsx scripts/backfill-clusters.ts
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, BACKFILL_ADDRESS_LIMIT
 * (default 500). Rate-limits Anthropic calls to keep cost predictable.
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  runAllDetectors,
  type ActivityRow,
  type DetectedEdge,
} from "../lib/clusters/detection";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const LIMIT = Number(process.env.BACKFILL_ADDRESS_LIMIT ?? 500);
const LOOKBACK_DAYS = Number(process.env.BACKFILL_LOOKBACK_DAYS ?? 30);
const CLAUDE_MODEL = "claude-sonnet-4-6";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

interface TopAddress {
  whale_address: string;
  chain: string;
  move_count: number;
  volume_usd: number;
}

async function topActiveAddresses(): Promise<TopAddress[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("whale_activity")
    .select("whale_address,chain,value_usd")
    .gte("timestamp", since);
  const rows = (data ?? []) as Array<{
    whale_address: string;
    chain: string;
    value_usd: number | null;
  }>;
  const map = new Map<string, { chain: string; vol: number; count: number }>();
  for (const r of rows) {
    const k = `${r.chain}:${r.whale_address.toLowerCase()}`;
    const e = map.get(k) ?? { chain: r.chain, vol: 0, count: 0 };
    e.vol += Number(r.value_usd ?? 0);
    e.count += 1;
    map.set(k, e);
  }
  return Array.from(map.entries())
    .map(([key, v]) => {
      const addr = key.split(":")[1];
      return { whale_address: addr, chain: v.chain, move_count: v.count, volume_usd: v.vol };
    })
    .sort((a, b) => b.volume_usd - a.volume_usd)
    .slice(0, LIMIT);
}

async function pullActivityFor(addresses: string[]): Promise<ActivityRow[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const BATCH = 100;
  const out: ActivityRow[] = [];
  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    const { data } = await supabase
      .from("whale_activity")
      .select("whale_address,chain,action,token_address,value_usd,timestamp,tx_hash")
      .in("whale_address", batch)
      .gte("timestamp", since);
    for (const r of (data ?? []) as ActivityRow[]) out.push(r);
  }
  return out;
}

async function persistEdges(edges: DetectedEdge[]): Promise<number> {
  if (edges.length === 0) return 0;
  // De-dupe on (chain, from, to, type) before insert.
  const unique = new Map<string, DetectedEdge>();
  for (const e of edges) {
    const key = `${e.chain}:${e.from_address.toLowerCase()}:${e.to_address.toLowerCase()}:${e.edge_type}`;
    const prev = unique.get(key);
    if (!prev || e.confidence > prev.confidence) unique.set(key, e);
  }
  const rows = Array.from(unique.values()).map((e) => ({
    from_address: e.from_address.toLowerCase(),
    to_address: e.to_address.toLowerCase(),
    chain: e.chain,
    edge_type: e.edge_type,
    confidence: e.confidence,
    weight: e.weight,
    first_seen_at: e.first_seen_at,
    transaction_count: e.transaction_count,
    total_value_usd: e.total_value_usd,
    last_seen_at: new Date().toISOString(),
  }));
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("wallet_edges")
      .upsert(slice, { onConflict: "from_address,to_address,chain,edge_type" });
    if (error) {
      console.error("wallet_edges upsert failed:", error.message);
    } else {
      inserted += slice.length;
    }
  }
  return inserted;
}

interface Cluster {
  rootAddress: string;
  chain: string;
  members: string[];
  edgeTypes: Set<string>;
}

async function groupClusters(addresses: string[]): Promise<Cluster[]> {
  // BFS over wallet_edges from each address, capping cluster size at 50.
  const visitedGlobal = new Set<string>();
  const clusters: Cluster[] = [];
  for (const root of addresses) {
    const rootLc = root.toLowerCase();
    if (visitedGlobal.has(rootLc)) continue;

    const queue = [rootLc];
    const members = new Set<string>([rootLc]);
    const edgeTypes = new Set<string>();
    let chain: string | null = null;

    while (queue.length > 0 && members.size < 50) {
      const current = queue.shift()!;
      visitedGlobal.add(current);
      const { data } = await supabase
        .from("wallet_edges")
        .select("from_address,to_address,chain,edge_type,confidence")
        .or(`from_address.eq.${current},to_address.eq.${current}`)
        .gte("confidence", 0.5)
        .limit(30);
      for (const e of (data ?? []) as Array<{
        from_address: string;
        to_address: string;
        chain: string;
        edge_type: string;
        confidence: number;
      }>) {
        chain = chain ?? e.chain;
        edgeTypes.add(e.edge_type);
        const other = e.from_address === current ? e.to_address : e.from_address;
        if (!members.has(other)) {
          members.add(other);
          queue.push(other);
        }
      }
    }

    if (members.size >= 2) {
      clusters.push({
        rootAddress: rootLc,
        chain: chain ?? "ethereum",
        members: Array.from(members),
        edgeTypes,
      });
    }
  }
  return clusters;
}

async function nameCluster(cluster: Cluster): Promise<string> {
  const body = JSON.stringify(
    {
      size: cluster.members.length,
      chain: cluster.chain,
      edge_types: Array.from(cluster.edgeTypes),
      sample_addresses: cluster.members.slice(0, 5),
    },
    null,
    2,
  );
  const resp = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 32,
    messages: [
      {
        role: "user",
        content:
          "Generate a 2-4 word archetype label for this cluster of related crypto wallets. " +
          "Be creative and specific. Examples: Memecoin Snipers, OG DeFi Titans, Bridge Looters, " +
          "Rug Survivor Network. Reply with ONLY the label, no quotes, no punctuation.\n\n" +
          body,
      },
    ],
  });
  const block = resp.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") return "Connected Wallets";
  return block.text.trim().slice(0, 40) || "Connected Wallets";
}

async function main(): Promise<void> {
  console.log(
    `[backfill-clusters] lookback=${LOOKBACK_DAYS}d limit=${LIMIT} model=${CLAUDE_MODEL}`,
  );

  const top = await topActiveAddresses();
  console.log(`[backfill-clusters] top addresses: ${top.length}`);
  if (top.length === 0) {
    console.log("[backfill-clusters] no whale_activity rows in lookback window");
    return;
  }

  const addresses = top.map((t) => t.whale_address.toLowerCase());
  const activity = await pullActivityFor(addresses);
  console.log(`[backfill-clusters] activity rows: ${activity.length}`);

  const edges = runAllDetectors(activity);
  console.log(`[backfill-clusters] detected edges: ${edges.length}`);
  const persistedEdges = await persistEdges(edges);
  console.log(`[backfill-clusters] persisted edges: ${persistedEdges}`);

  const clusters = await groupClusters(addresses);
  console.log(`[backfill-clusters] clusters: ${clusters.length}`);

  let named = 0;
  for (const cluster of clusters) {
    try {
      const label = await nameCluster(cluster);
      await supabase.from("cluster_cache").upsert(
        {
          root_address: cluster.rootAddress,
          chain: cluster.chain,
          member_count: cluster.members.length,
          members: cluster.members,
          edge_types: Array.from(cluster.edgeTypes),
          ai_label: label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "root_address,chain" },
      );
      await supabase.from("cluster_labels").insert({
        root_address: cluster.rootAddress,
        chain: cluster.chain,
        label,
        ai_generated: true,
        status: "approved",
      });
      named++;
      if (named % 25 === 0) {
        console.log(`[backfill-clusters] named ${named}/${clusters.length}`);
      }
    } catch (err) {
      console.error(
        `[backfill-clusters] naming failed for ${cluster.rootAddress}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[backfill-clusters] done. named ${named} clusters.`);
}

main().catch((err) => {
  console.error("[backfill-clusters] fatal:", err);
  process.exit(1);
});
